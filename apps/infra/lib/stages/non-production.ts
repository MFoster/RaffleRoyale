import {
  CfnOutput,
  Stack,
  type StackProps,
  Tags,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  apiInternalUrl,
  ContainerRegistry,
  FargateServices,
  FargateWorkloads,
  GitHubOidcDeliveryRole,
  MigrationWorkload,
  NonProductionPlatform,
  type RaffleRoyaleEnvironmentConfig,
} from '@raffleroyale/cdk-constructs';

export class DeliveryStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    props?: StackProps,
  ) {
    super(scope, id, props);
    const delivery = new GitHubOidcDeliveryRole(this, 'Delivery', config);
    new CfnOutput(this, 'GitHubActionsRoleArn', {
      value: delivery.role.roleArn,
      description: 'Configure this ARN as the AWS_ROLE_TO_ASSUME GitHub secret',
    });
    tagStack(this, config);
  }
}

export class RegistryStack extends Stack {
  readonly registry: ContainerRegistry;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    props?: StackProps,
  ) {
    super(scope, id, props);
    this.registry = new ContainerRegistry(this, 'Registry', config);

    new CfnOutput(this, 'ApiRepositoryName', {
      value: this.registry.apiRepository.repositoryName,
    });
    new CfnOutput(this, 'WebRepositoryName', {
      value: this.registry.webRepository.repositoryName,
    });
    new CfnOutput(this, 'JobsRepositoryName', {
      value: this.registry.jobsRepository.repositoryName,
    });
    new CfnOutput(this, 'ApiInternalUrl', {
      value: apiInternalUrl(config),
    });
    tagStack(this, config);
  }
}

export class PlatformStack extends Stack {
  readonly platform: NonProductionPlatform;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    props?: StackProps,
  ) {
    super(scope, id, props);
    this.platform = new NonProductionPlatform(this, 'Platform', config);

    new CfnOutput(this, 'ClusterName', {
      value: this.platform.cluster.clusterName,
    });
    new CfnOutput(this, 'AlbUrl', {
      value: `http://${this.platform.loadBalancer.loadBalancerDnsName}`,
    });
    new CfnOutput(this, 'JobsQueueUrl', {
      value: this.platform.jobsQueue.queueUrl,
    });
    new CfnOutput(this, 'JobsQueueArn', {
      value: this.platform.jobsQueue.queueArn,
    });
    new CfnOutput(this, 'SchedulerGroupName', {
      value: this.platform.schedulerGroup.name ?? '',
    });
    new CfnOutput(this, 'SchedulerTargetRoleArn', {
      value: this.platform.schedulerTargetRole.roleArn,
    });
    new CfnOutput(this, 'DatabaseSecretArn', {
      value: this.platform.databaseSecret.secretArn,
    });
    new CfnOutput(this, 'UploadsFileSystemId', {
      value: this.platform.uploadsFileSystem.fileSystemId,
    });
    tagStack(this, config);
  }
}

export class WorkloadsStack extends Stack {
  readonly migration: MigrationWorkload;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
    props?: StackProps,
  ) {
    super(scope, id, props);
    this.migration = new MigrationWorkload(
      this,
      'Migration',
      config,
      registry,
      platform,
    );

    new CfnOutput(this, 'JobsTaskDefinitionArn', {
      value: this.migration.taskDefinition.taskDefinitionArn,
    });
    new CfnOutput(this, 'JobsContainerName', {
      value: this.migration.container.containerName,
    });
    new CfnOutput(this, 'ClusterName', {
      value: platform.cluster.clusterName,
    });
    new CfnOutput(this, 'ApplicationSubnetIds', {
      value: platform.vpc
        .selectSubnets({ subnetGroupName: 'application' })
        .subnetIds.join(','),
    });
    new CfnOutput(this, 'JobsSecurityGroupId', {
      value: platform.jobsSecurityGroup.securityGroupId,
    });
    tagStack(this, config);
  }
}

export class ServicesStack extends Stack {
  readonly services: FargateServices;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
    registry: ContainerRegistry,
    platform: NonProductionPlatform,
    props?: StackProps,
  ) {
    super(scope, id, props);
    const workloads = new FargateWorkloads(
      this,
      'Workloads',
      config,
      registry,
      platform,
    );
    this.services = new FargateServices(
      this,
      'Services',
      config,
      platform,
      workloads,
    );

    new CfnOutput(this, 'AlbUrl', {
      value: `http://${platform.loadBalancer.loadBalancerDnsName}`,
    });
    new CfnOutput(this, 'ClusterName', {
      value: platform.cluster.clusterName,
    });
    new CfnOutput(this, 'ApiServiceName', {
      value: this.services.apiService.serviceName,
    });
    new CfnOutput(this, 'WebServiceName', {
      value: this.services.webService.serviceName,
    });
    new CfnOutput(this, 'JobsServiceName', {
      value: this.services.jobsService.serviceName,
    });
    tagStack(this, config);
  }
}

function tagStack(
  stack: Stack,
  config: RaffleRoyaleEnvironmentConfig,
): void {
  const tagOptions = {
    excludeResourceTypes: ['AWS::ElasticLoadBalancingV2::ListenerRule'],
  };
  Tags.of(stack).add('Application', config.projectName, tagOptions);
  Tags.of(stack).add('Environment', config.environmentName, tagOptions);
  Tags.of(stack).add('ManagedBy', 'aws-cdk', tagOptions);
  Tags.of(stack).add('Owner', config.githubOwner, tagOptions);
}
