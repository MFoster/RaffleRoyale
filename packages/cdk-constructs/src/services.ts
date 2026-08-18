import {
  Duration,
  aws_applicationautoscaling as appscaling,
  aws_cloudwatch as cloudwatch,
  aws_cloudwatch_actions as cloudwatchActions,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_events as events,
  aws_events_targets as targets,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type RaffleRoyaleEnvironmentConfig } from './config';
import { NonProductionPlatform } from './platform';
import { FargateWorkloads } from './workloads';

export class FargateServices extends Construct {
  readonly apiService: ecs.FargateService;
  readonly webService: ecs.FargateService;
  readonly jobsService: ecs.FargateService;
  readonly listener: elbv2.ApplicationListener;
  readonly apiWakeAlarm: cloudwatch.Alarm;
  readonly webWakeAlarm: cloudwatch.Alarm;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    platform: NonProductionPlatform,
    workloads: FargateWorkloads,
  ) {
    super(scope, id);

    this.apiService = this.service(
      'Api',
      config.apiDesiredCount,
      platform,
      workloads.api.taskDefinition,
      platform.apiSecurityGroup,
    );
    this.webService = this.service(
      'Web',
      config.webDesiredCount,
      platform,
      workloads.web.taskDefinition,
      platform.webSecurityGroup,
    );
    this.jobsService = this.service(
      'Jobs',
      config.jobsDesiredCount,
      platform,
      workloads.jobs.taskDefinition,
      platform.jobsSecurityGroup,
    );

    const webTargetGroup = new elbv2.ApplicationTargetGroup(this, 'WebTargetGroup', {
      targetGroupName: `${platform.prefix}-web`,
      vpc: platform.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        healthyHttpCodes: '200-399',
        interval: Duration.seconds(30),
      },
      deregistrationDelay: Duration.seconds(30),
    });
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTargetGroup', {
      targetGroupName: `${platform.prefix}-api`,
      vpc: platform.vpc,
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        healthyHttpCodes: '200',
        interval: Duration.seconds(30),
      },
      deregistrationDelay: Duration.seconds(30),
    });
    this.webService.attachToApplicationTargetGroup(webTargetGroup);
    this.apiService.attachToApplicationTargetGroup(apiTargetGroup);

    this.listener = new elbv2.ApplicationListener(this, 'HttpListener', {
      loadBalancer: platform.loadBalancer,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [webTargetGroup],
    });
    const apiRule = new elbv2.ApplicationListenerRule(this, 'ApiRoutes', {
      listener: this.listener,
      priority: 10,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api', '/api/*']),
      ],
      action: elbv2.ListenerAction.forward([apiTargetGroup]),
    });
    const cfnApiRule = apiRule.node.defaultChild as elbv2.CfnListenerRule;
    cfnApiRule.transforms = [
      {
        type: 'url-rewrite',
        urlRewriteConfig: {
          rewrites: [
            {
              regex: '^/api/?(.*)$',
              replace: '/$1',
            },
          ],
        },
      },
    ];

    this.recurringJobRule(
      'RaffleReconciliationRule',
      `${platform.prefix}-raffle-reconciliation`,
      'Repair missed expirations and advance eligible draws',
      config.raffleSweepMinutes,
      'reconcile-expired-raffles',
      platform,
      workloads,
      config,
    );
    this.recurringJobRule(
      'PendingImageCleanupRule',
      `${platform.prefix}-pending-image-cleanup`,
      'Delete expired unclaimed upload records and EFS files',
      config.imageCleanupMinutes,
      'cleanup-pending-images',
      platform,
      workloads,
      config,
    );

    const wakeAlarms = this.configureScaling(config, platform);
    this.apiWakeAlarm = wakeAlarms.api;
    this.webWakeAlarm = wakeAlarms.web;
    this.queueAlarms(platform);
    this.serviceAlarms(platform, webTargetGroup, apiTargetGroup);
  }

  private recurringJobRule(
    id: string,
    ruleName: string,
    description: string,
    intervalMinutes: number,
    commandName: string,
    platform: NonProductionPlatform,
    workloads: FargateWorkloads,
    config: RaffleRoyaleEnvironmentConfig,
  ): void {
    new events.Rule(this, id, {
      ruleName,
      description,
      schedule: events.Schedule.rate(
        Duration.minutes(intervalMinutes),
      ),
      targets: [
        new targets.EcsTask({
          cluster: platform.cluster,
          taskDefinition: workloads.jobs.taskDefinition,
          taskCount: 1,
          subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
          assignPublicIp: true,
          securityGroups: [platform.jobsSecurityGroup],
          containerOverrides: [
            {
              containerName: workloads.jobs.container.containerName,
              command: [
                'export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@'
                  + `${platform.database.clusterEndpoint.hostname}:`
                  + `${platform.database.clusterEndpoint.port}/${config.databaseName}?schema=public"; `
                  + `exec node apps/jobs/dist/index.js ${commandName}`,
              ],
            },
          ],
        }),
      ],
    });
  }

  private service(
    id: string,
    desiredCount: number,
    platform: NonProductionPlatform,
    taskDefinition: ecs.FargateTaskDefinition,
    securityGroup: ec2.SecurityGroup,
  ): ecs.FargateService {
    return new ecs.FargateService(this, `${id}Service`, {
      serviceName: `${platform.prefix}-${id.toLowerCase()}`,
      cluster: platform.cluster,
      taskDefinition,
      desiredCount,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [securityGroup],
      circuitBreaker: { rollback: true },
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: id === 'Jobs' ? undefined : Duration.seconds(60),
      enableExecuteCommand: true,
    });
  }

  private configureScaling(
    config: RaffleRoyaleEnvironmentConfig,
    platform: NonProductionPlatform,
  ): { api: cloudwatch.Alarm; web: cloudwatch.Alarm } {
    // RequestCount is not emitted without registered targets. The ALB-originated
    // 503 metric captures the cold response and can wake both proxying services.
    const coldResponses = new cloudwatch.Metric({
      namespace: 'AWS/ApplicationELB',
      metricName: 'HTTPCode_ELB_503_Count',
      dimensionsMap: {
        LoadBalancer: platform.loadBalancer.loadBalancerFullName,
      },
      period: Duration.minutes(1),
      statistic: 'Sum',
    });
    const albRequests = platform.loadBalancer.metrics.requestCount({
      period: Duration.minutes(1),
      statistic: 'Sum',
    });
    const wakeAlarms = {} as Record<'Api' | 'Web', cloudwatch.Alarm>;
    for (const [name, service] of [
      ['Api', this.apiService],
      ['Web', this.webService],
    ] as const) {
      const target = service.autoScaleTaskCount({
        minCapacity: 0,
        maxCapacity: 1,
      });
      wakeAlarms[name] = this.exactCapacityAlarm(
        `${name}Wake`,
        `${platform.prefix}-${name.toLowerCase()}-wake`,
        target,
        coldResponses,
        1,
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        1,
        1,
        cloudwatch.TreatMissingData.NOT_BREACHING,
      );
      this.exactCapacityAlarm(
        `${name}Idle`,
        `${platform.prefix}-${name.toLowerCase()}-idle`,
        target,
        albRequests,
        1,
        cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        config.serviceIdleMinutes,
        0,
        cloudwatch.TreatMissingData.BREACHING,
      );
    }

    const queueDemand = new cloudwatch.MathExpression({
      expression: 'FILL(visible,0) + FILL(inflight,0)',
      usingMetrics: {
        visible: platform.jobsQueue.metricApproximateNumberOfMessagesVisible({
          period: Duration.minutes(1),
          statistic: 'Maximum',
        }),
        inflight:
          platform.jobsQueue.metricApproximateNumberOfMessagesNotVisible({
            period: Duration.minutes(1),
            statistic: 'Maximum',
          }),
      },
      period: Duration.minutes(1),
      label: 'Visible and in-flight jobs',
    });
    const jobsTarget = this.jobsService.autoScaleTaskCount({
      minCapacity: 0,
      maxCapacity: 1,
    });
    this.exactCapacityAlarm(
      'JobsWake',
      `${platform.prefix}-jobs-wake`,
      jobsTarget,
      queueDemand,
      1,
      cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      1,
      1,
      cloudwatch.TreatMissingData.NOT_BREACHING,
    );
    this.exactCapacityAlarm(
      'JobsDrained',
      `${platform.prefix}-jobs-drained`,
      jobsTarget,
      queueDemand,
      1,
      cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      config.jobsDrainMinutes,
      0,
      cloudwatch.TreatMissingData.BREACHING,
    );
    return { api: wakeAlarms.Api, web: wakeAlarms.Web };
  }

  private exactCapacityAlarm(
    id: string,
    alarmName: string,
    target: ecs.ScalableTaskCount,
    metric: cloudwatch.IMetric,
    threshold: number,
    comparisonOperator: cloudwatch.ComparisonOperator,
    evaluationPeriods: number,
    capacity: number,
    treatMissingData: cloudwatch.TreatMissingData,
  ): cloudwatch.Alarm {
    const action = new appscaling.StepScalingAction(this, `${id}Action`, {
      scalingTarget: target,
      adjustmentType: appscaling.AdjustmentType.EXACT_CAPACITY,
      cooldown: Duration.minutes(1),
    });
    action.addAdjustment(
      comparisonOperator ===
        cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        ? { adjustment: capacity, lowerBound: 0 }
        : { adjustment: capacity, upperBound: 0 },
    );
    const alarm = new cloudwatch.Alarm(this, `${id}Alarm`, {
      alarmName,
      metric,
      threshold,
      comparisonOperator,
      evaluationPeriods,
      datapointsToAlarm: evaluationPeriods,
      treatMissingData,
    });
    alarm.addAlarmAction(
      new cloudwatchActions.ApplicationScalingAction(action),
    );
    return alarm;
  }

  private queueAlarms(platform: NonProductionPlatform): void {
    new cloudwatch.Alarm(this, 'JobsQueueDepthAlarm', {
      alarmName: `${platform.prefix}-jobs-queue-depth`,
      metric: platform.jobsQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 10,
      evaluationPeriods: 2,
    });
    new cloudwatch.Alarm(this, 'JobsQueueAgeAlarm', {
      alarmName: `${platform.prefix}-jobs-oldest-message`,
      metric: platform.jobsQueue.metricApproximateAgeOfOldestMessage(),
      threshold: Duration.minutes(5).toSeconds(),
      evaluationPeriods: 2,
    });
    new cloudwatch.Alarm(this, 'JobsDeadLetterAlarm', {
      alarmName: `${platform.prefix}-jobs-dlq-not-empty`,
      metric:
        platform.jobsDeadLetterQueue.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
    });
  }

  private serviceAlarms(
    platform: NonProductionPlatform,
    webTargetGroup: elbv2.ApplicationTargetGroup,
    apiTargetGroup: elbv2.ApplicationTargetGroup,
  ): void {
    for (const [name, targetGroup] of [
      ['web', webTargetGroup],
      ['api', apiTargetGroup],
    ] as const) {
      new cloudwatch.Alarm(this, `${name}UnhealthyTargetsAlarm`, {
        alarmName: `${platform.prefix}-${name}-unhealthy-targets`,
        metric: targetGroup.metrics.unhealthyHostCount(),
        threshold: 1,
        evaluationPeriods: 2,
      });
    }

    new cloudwatch.Alarm(this, 'AlbServerErrorsAlarm', {
      alarmName: `${platform.prefix}-alb-5xx`,
      metric: platform.loadBalancer.metrics.httpCodeElb(
        elbv2.HttpCodeElb.ELB_5XX_COUNT,
      ),
      threshold: 5,
      evaluationPeriods: 2,
    });
    new cloudwatch.Alarm(this, 'JobsMemoryAlarm', {
      alarmName: `${platform.prefix}-jobs-memory-high`,
      metric: this.jobsService.metricMemoryUtilization(),
      threshold: 85,
      evaluationPeriods: 3,
    });
  }
}
