import {
  Duration,
  RemovalPolicy,
  Stack,
  aws_ec2 as ec2,
  aws_ecs as ecs,
  aws_efs as efs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_rds as rds,
  aws_scheduler as scheduler,
  aws_secretsmanager as secretsmanager,
  aws_sqs as sqs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  type RaffleRoyaleEnvironmentConfig,
  resourcePrefix,
} from './config';

export class NonProductionPlatform extends Construct {
  readonly prefix: string;
  readonly vpc: ec2.Vpc;
  readonly cluster: ecs.Cluster;
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  readonly database: rds.DatabaseCluster;
  readonly databaseSecret: secretsmanager.Secret;
  readonly jwtSecret: secretsmanager.Secret;
  readonly jwtRefreshSecret: secretsmanager.Secret;
  readonly queueSigningSecret: secretsmanager.Secret;
  readonly uploadsFileSystem: efs.FileSystem;
  readonly uploadsAccessPoint: efs.AccessPoint;
  readonly jobsQueue: sqs.Queue;
  readonly jobsDeadLetterQueue: sqs.Queue;
  readonly schedulerGroup: scheduler.CfnScheduleGroup;
  readonly schedulerTargetRole: iam.Role;
  readonly albSecurityGroup: ec2.SecurityGroup;
  readonly apiSecurityGroup: ec2.SecurityGroup;
  readonly webSecurityGroup: ec2.SecurityGroup;
  readonly jobsSecurityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
  ) {
    super(scope, id);
    this.prefix = resourcePrefix(config);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${this.prefix}-vpc`,
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'application',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: this.prefix,
      vpc: this.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    this.albSecurityGroup = this.securityGroup('AlbSecurityGroup', 'Public ALB');
    this.apiSecurityGroup = this.securityGroup('ApiSecurityGroup', 'API tasks');
    this.webSecurityGroup = this.securityGroup('WebSecurityGroup', 'web tasks');
    this.jobsSecurityGroup = this.securityGroup('JobsSecurityGroup', 'jobs tasks');
    const databaseSecurityGroup = this.securityGroup(
      'DatabaseSecurityGroup',
      'PostgreSQL database',
    );
    const efsSecurityGroup = this.securityGroup(
      'EfsSecurityGroup',
      'API uploads EFS',
    );

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Public HTTP ingress',
    );
    this.apiSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3001),
      'ALB to API',
    );
    this.webSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(3000),
      'ALB to web',
    );
    databaseSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(5432),
      'API to PostgreSQL',
    );
    databaseSecurityGroup.addIngressRule(
      this.jobsSecurityGroup,
      ec2.Port.tcp(5432),
      'jobs to PostgreSQL',
    );
    efsSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.tcp(2049),
      'API to EFS',
    );
    efsSecurityGroup.addIngressRule(
      this.jobsSecurityGroup,
      ec2.Port.tcp(2049),
      'cleanup jobs to EFS',
    );

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      loadBalancerName: `${this.prefix}-alb`,
      vpc: this.vpc,
      internetFacing: true,
      securityGroup: this.albSecurityGroup,
      vpcSubnets: { subnetGroupName: 'public' },
    });

    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `${this.prefix}/database`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'raffleroyale' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });
    this.databaseSecret.applyRemovalPolicy(
      config.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    );

    this.database = new rds.DatabaseCluster(this, 'AuroraDatabase', {
      clusterIdentifier: `${this.prefix}-aurora-postgres`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_13,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: false,
      }),
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      defaultDatabaseName: config.databaseName,
      vpc: this.vpc,
      vpcSubnets: { subnetGroupName: 'database' },
      securityGroups: [databaseSecurityGroup],
      storageEncrypted: true,
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: config.auroraServerlessMaxCapacity,
      serverlessV2AutoPauseDuration: Duration.minutes(
        config.auroraAutoPauseMinutes,
      ),
      backup: { retention: Duration.days(1) },
      deletionProtection: config.retainData,
      deleteAutomatedBackups: !config.retainData,
      removalPolicy: config.retainData
        ? RemovalPolicy.SNAPSHOT
        : RemovalPolicy.DESTROY,
    });

    this.jwtSecret = this.generatedSecret('JwtSecret', 'jwt');
    this.jwtRefreshSecret = this.generatedSecret('JwtRefreshSecret', 'jwt-refresh');
    this.queueSigningSecret = this.generatedSecret(
      'QueueSigningSecret',
      'queue-signing',
    );

    this.uploadsFileSystem = new efs.FileSystem(this, 'UploadsFileSystem', {
      fileSystemName: `${this.prefix}-uploads`,
      vpc: this.vpc,
      vpcSubnets: { subnetGroupName: 'database' },
      securityGroup: efsSecurityGroup,
      encrypted: true,
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
      removalPolicy: config.retainData
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    });
    this.uploadsAccessPoint = this.uploadsFileSystem.addAccessPoint(
      'ApiUploadsAccessPoint',
      {
        path: '/api-uploads',
        createAcl: {
          ownerUid: '1000',
          ownerGid: '1000',
          permissions: '0775',
        },
        posixUser: { uid: '1000', gid: '1000' },
      },
    );

    this.jobsDeadLetterQueue = new sqs.Queue(this, 'JobsDeadLetterQueue', {
      queueName: `${this.prefix}-jobs-dlq`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.jobsQueue = new sqs.Queue(this, 'JobsQueue', {
      queueName: `${this.prefix}-jobs`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      receiveMessageWaitTime: Duration.seconds(20),
      visibilityTimeout: Duration.minutes(5),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: this.jobsDeadLetterQueue,
        maxReceiveCount: 5,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.schedulerGroup = new scheduler.CfnScheduleGroup(this, 'SchedulerGroup', {
      name: `${this.prefix}-raffle-expirations`,
    });
    this.schedulerTargetRole = new iam.Role(this, 'SchedulerTargetRole', {
      roleName: `${this.prefix}-scheduler-target`,
      assumedBy: new iam.ServicePrincipal(
        'scheduler.amazonaws.com',
      ).withConditions({
        StringEquals: {
          'aws:SourceAccount': Stack.of(this).account,
        },
        ArnLike: {
          'aws:SourceArn': Stack.of(this).formatArn({
            service: 'scheduler',
            resource: 'schedule',
            resourceName: `${this.schedulerGroup.name}/*`,
          }),
        },
      }),
      description: 'Allows EventBridge Scheduler to enqueue signed raffle jobs',
    });
    this.jobsQueue.grantSendMessages(this.schedulerTargetRole);
  }

  private securityGroup(id: string, description: string): ec2.SecurityGroup {
    return new ec2.SecurityGroup(this, id, {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: `${this.prefix} ${description}`,
    });
  }

  private generatedSecret(id: string, suffix: string): secretsmanager.Secret {
    const secret = new secretsmanager.Secret(this, id, {
      secretName: `${this.prefix}/${suffix}`,
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
    });
    secret.applyRemovalPolicy(RemovalPolicy.DESTROY);
    return secret;
  }
}
