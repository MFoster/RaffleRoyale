import {
  Duration,
  RemovalPolicy,
  Stack,
  aws_ecs as ecs,
  aws_iam as iam,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { type RaffleRoyaleEnvironmentConfig } from './config';
import { NonProductionPlatform } from './platform';
import { ContainerRegistry } from './registry';

type ServiceTask = {
  taskDefinition: ecs.FargateTaskDefinition;
  container: ecs.ContainerDefinition;
};

export class MigrationWorkload extends Construct {
  readonly taskDefinition: ecs.FargateTaskDefinition;
  readonly container: ecs.ContainerDefinition;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
  ) {
    super(scope, id);

    const executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `${platform.prefix}-migration-execution`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    });
    platform.databaseSecret.grantRead(executionRole);

    this.taskDefinition = new ecs.FargateTaskDefinition(
      this,
      'TaskDefinition',
      {
        family: `${platform.prefix}-migration`,
        cpu: 256,
        memoryLimitMiB: 512,
        executionRole,
        taskRole: new iam.Role(this, 'TaskRole', {
          roleName: `${platform.prefix}-migration-task`,
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        }),
      },
    );

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${platform.prefix}/migration`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.container = this.taskDefinition.addContainer('Container', {
      containerName: 'migration',
      image: ecs.ContainerImage.fromEcrRepository(
        registry.jobsRepository,
        config.imageTag,
      ),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: 'migration',
      }),
      entryPoint: ['/bin/sh', '-c'],
      command: [
        [
          `export DATABASE_URL="postgresql://\${DB_USERNAME}:\${DB_PASSWORD}@${platform.database.clusterEndpoint.hostname}:${platform.database.clusterEndpoint.port}/${config.databaseName}?schema=public"`,
          'exec node apps/jobs/dist/index.js migrate',
        ].join('; '),
      ],
      secrets: {
        DB_USERNAME: ecs.Secret.fromSecretsManager(
          platform.databaseSecret,
          'username',
        ),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(
          platform.databaseSecret,
          'password',
        ),
      },
    });
  }
}

export class FargateWorkloads extends Construct {
  readonly api: ServiceTask;
  readonly web: ServiceTask;
  readonly jobs: ServiceTask;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
  ) {
    super(scope, id);

    this.api = this.apiTask(config, registry, platform);
    this.web = this.webTask(config, registry, platform);
    this.jobs = this.jobsTask(config, registry, platform);
  }

  private apiTask(
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
  ): ServiceTask {
    const roles = this.roles('Api', platform.prefix, [
      platform.databaseSecret,
      platform.jwtSecret,
      platform.jwtRefreshSecret,
      platform.queueSigningSecret,
    ]);
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'ApiTaskDefinition', {
      family: `${platform.prefix}-api`,
      cpu: 512,
      memoryLimitMiB: 1024,
      executionRole: roles.executionRole,
      taskRole: roles.taskRole,
    });
    taskDefinition.addVolume({
      name: 'api-uploads',
      efsVolumeConfiguration: {
        fileSystemId: platform.uploadsFileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: platform.uploadsAccessPoint.accessPointId,
          iam: 'ENABLED',
        },
      },
    });
    roles.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:ClientWrite',
        ],
        resources: [platform.uploadsFileSystem.fileSystemArn],
        conditions: {
          StringEquals: {
            'elasticfilesystem:AccessPointArn':
              platform.uploadsAccessPoint.accessPointArn,
          },
        },
      }),
    );

    roles.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'scheduler:CreateSchedule',
          'scheduler:GetSchedule',
          'scheduler:UpdateSchedule',
          'scheduler:DeleteSchedule',
        ],
        resources: [
          Stack.of(this).formatArn({
            service: 'scheduler',
            resource: 'schedule',
            resourceName: `${platform.schedulerGroup.name}/*`,
          }),
        ],
      }),
    );
    roles.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [platform.schedulerTargetRole.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' },
        },
      }),
    );

    const container = taskDefinition.addContainer('ApiContainer', {
      containerName: 'api',
      image: ecs.ContainerImage.fromEcrRepository(
        registry.apiRepository,
        config.imageTag,
      ),
      logging: this.logging('api', platform.prefix),
      entryPoint: ['/bin/sh', '-c'],
      command: [
        this.databaseCommand(
          platform,
          'exec npm run start:prod',
          config.databaseName,
        ),
      ],
      environment: {
        AWS_REGION: Stack.of(this).region,
        NODE_ENV: 'production',
        PORT: '3001',
        FRONTEND_URL: `http://${platform.loadBalancer.loadBalancerDnsName}`,
        UPLOADS_DIRECTORY: '/workspace/apps/api/uploads',
        RAFFLE_EXPIRATION_CRON_ENABLED: 'false',
        RAFFLE_IMAGE_UPLOAD_CLEANUP_ENABLED: 'false',
        RAFFLE_EVENTBRIDGE_SCHEDULER_ENABLED: 'true',
        JOBS_SQS_QUEUE_URL: platform.jobsQueue.queueUrl,
        JOBS_SQS_QUEUE_ARN: platform.jobsQueue.queueArn,
        EVENTBRIDGE_SCHEDULER_GROUP_NAME:
          platform.schedulerGroup.name ?? '',
        EVENTBRIDGE_SCHEDULER_ROLE_ARN:
          platform.schedulerTargetRole.roleArn,
      },
      secrets: {
        DB_USERNAME: ecs.Secret.fromSecretsManager(
          platform.databaseSecret,
          'username',
        ),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(
          platform.databaseSecret,
          'password',
        ),
        JWT_SECRET: ecs.Secret.fromSecretsManager(platform.jwtSecret),
        JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(
          platform.jwtRefreshSecret,
        ),
        QUEUE_MESSAGE_SIGNING_KEY: ecs.Secret.fromSecretsManager(
          platform.queueSigningSecret,
        ),
      },
      healthCheck: {
        command: [
          'CMD-SHELL',
          'node -e "fetch(\'http://127.0.0.1:3001/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"',
        ],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        retries: 3,
        startPeriod: Duration.seconds(30),
      },
    });
    container.addPortMappings({ containerPort: 3001 });
    container.addMountPoints({
      sourceVolume: 'api-uploads',
      containerPath: '/workspace/apps/api/uploads',
      readOnly: false,
    });
    return { taskDefinition, container };
  }

  private webTask(
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
  ): ServiceTask {
    const roles = this.roles('Web', platform.prefix, []);
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'WebTaskDefinition', {
      family: `${platform.prefix}-web`,
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: roles.executionRole,
      taskRole: roles.taskRole,
    });
    const container = taskDefinition.addContainer('WebContainer', {
      containerName: 'web',
      image: ecs.ContainerImage.fromEcrRepository(
        registry.webRepository,
        config.imageTag,
      ),
      logging: this.logging('web', platform.prefix),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        NEXT_SERVER_ORIGIN: 'http://127.0.0.1:3000',
        API_PROXY_TARGET:
          `http://${platform.loadBalancer.loadBalancerDnsName}/api`,
      },
    });
    container.addPortMappings({ containerPort: 3000 });
    return { taskDefinition, container };
  }

  private jobsTask(
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
  ): ServiceTask {
    const roles = this.roles('Jobs', platform.prefix, [
      platform.databaseSecret,
      platform.queueSigningSecret,
    ]);
    platform.jobsQueue.grantConsumeMessages(roles.taskRole);

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'JobsTaskDefinition', {
      family: `${platform.prefix}-jobs`,
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole: roles.executionRole,
      taskRole: roles.taskRole,
    });
    taskDefinition.addVolume({
      name: 'api-uploads',
      efsVolumeConfiguration: {
        fileSystemId: platform.uploadsFileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: platform.uploadsAccessPoint.accessPointId,
          iam: 'ENABLED',
        },
      },
    });
    roles.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:ClientWrite',
        ],
        resources: [platform.uploadsFileSystem.fileSystemArn],
        conditions: {
          StringEquals: {
            'elasticfilesystem:AccessPointArn':
              platform.uploadsAccessPoint.accessPointArn,
          },
        },
      }),
    );
    const container = taskDefinition.addContainer('JobsContainer', {
      containerName: 'jobs',
      image: ecs.ContainerImage.fromEcrRepository(
        registry.jobsRepository,
        config.imageTag,
      ),
      logging: this.logging('jobs', platform.prefix),
      entryPoint: ['/bin/sh', '-c'],
      command: [
        this.databaseCommand(
          platform,
          'exec node apps/jobs/dist/index.js',
          config.databaseName,
        ),
      ],
      environment: {
        AWS_REGION: Stack.of(this).region,
        NODE_ENV: 'production',
        JOBS_SQS_QUEUE_URL: platform.jobsQueue.queueUrl,
        UPLOADS_DIRECTORY: '/workspace/apps/api/uploads',
      },
      secrets: {
        DB_USERNAME: ecs.Secret.fromSecretsManager(
          platform.databaseSecret,
          'username',
        ),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(
          platform.databaseSecret,
          'password',
        ),
        QUEUE_MESSAGE_SIGNING_KEY: ecs.Secret.fromSecretsManager(
          platform.queueSigningSecret,
        ),
      },
      stopTimeout: Duration.seconds(120),
    });
    container.addMountPoints({
      sourceVolume: 'api-uploads',
      containerPath: '/workspace/apps/api/uploads',
      readOnly: false,
    });
    return { taskDefinition, container };
  }

  private roles(
    service: string,
    prefix: string,
    secrets: Array<{ grantRead(grantee: iam.IGrantable): unknown }>,
  ): { executionRole: iam.Role; taskRole: iam.Role } {
    const executionRole = new iam.Role(this, `${service}ExecutionRole`, {
      roleName: `${prefix}-${service.toLowerCase()}-execution`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy',
        ),
      ],
    });
    const taskRole = new iam.Role(this, `${service}TaskRole`, {
      roleName: `${prefix}-${service.toLowerCase()}-task`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    for (const secret of secrets) {
      secret.grantRead(executionRole);
    }
    return { executionRole, taskRole };
  }

  private logging(service: string, prefix: string): ecs.LogDriver {
    const logGroup = new logs.LogGroup(this, `${service}LogGroup`, {
      logGroupName: `/ecs/${prefix}/${service}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    return ecs.LogDrivers.awsLogs({
      logGroup,
      streamPrefix: service,
    });
  }

  private databaseCommand(
    platform: NonProductionPlatform,
    command: string,
    databaseName: string,
  ): string {
    return [
      `export DATABASE_URL="postgresql://\${DB_USERNAME}:\${DB_PASSWORD}@${platform.database.clusterEndpoint.hostname}:${platform.database.clusterEndpoint.port}/${databaseName}?schema=public"`,
      command,
    ].join('; ');
  }
}
