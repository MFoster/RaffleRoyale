import assert from 'node:assert/strict';
import test from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { type RaffleRoyaleEnvironmentConfig } from '@raffleroyale/cdk-constructs';
import {
  DeliveryStack,
  PlatformStack,
  RegistryStack,
  ServicesStack,
  WorkloadsStack,
} from '../lib/stages/non-production';
import { loadEnvironmentConfig } from '../lib/config/environment';

const config: RaffleRoyaleEnvironmentConfig = {
  projectName: 'raffle-royale',
  environmentName: 'nonprod',
  imageTag: '0123456789abcdef0123456789abcdef01234567',
  githubOwner: 'MFoster',
  githubRepository: 'RaffleRoyale',
  githubEnvironment: 'non-production',
  createGithubOidcProvider: true,
  databaseName: 'raffleroyale',
  retainData: false,
  auroraServerlessMaxCapacity: 1,
  auroraAutoPauseMinutes: 5,
  apiDesiredCount: 0,
  webDesiredCount: 0,
  jobsDesiredCount: 0,
  serviceIdleMinutes: 10,
  jobsDrainMinutes: 5,
  raffleSweepMinutes: 5,
  imageCleanupMinutes: 60,
};

function stacks() {
  const app = new App();
  const delivery = new DeliveryStack(app, 'Delivery', config);
  const registry = new RegistryStack(app, 'Registry', config);
  const platform = new PlatformStack(app, 'Platform', config);
  const workloads = new WorkloadsStack(
    app,
    'Workloads',
    config,
    registry.registry,
    platform.platform,
  );
  const services = new ServicesStack(
    app,
    'Services',
    config,
    registry.registry,
    platform.platform,
  );
  return { delivery, registry, platform, workloads, services };
}

test('environment config defaults to bounded scale-to-zero capacity', () => {
  const app = new App({
    context: {
      imageTag: '0123456789abcdef0123456789abcdef01234567',
    },
  });
  const loaded = loadEnvironmentConfig(app);
  assert.equal(loaded.auroraServerlessMaxCapacity, 1);
  assert.equal(loaded.auroraAutoPauseMinutes, 5);
  assert.equal(loaded.apiDesiredCount, 0);
  assert.equal(loaded.webDesiredCount, 0);
  assert.equal(loaded.jobsDesiredCount, 0);
  assert.equal(loaded.serviceIdleMinutes, 10);
  assert.equal(loaded.jobsDrainMinutes, 5);
});

test('environment config rejects unsafe non-production capacity', () => {
  const app = new App({
    context: {
      imageTag: '0123456789abcdef0123456789abcdef01234567',
      auroraServerlessMaxCapacity: 8,
    },
  });
  assert.throws(
    () => loadEnvironmentConfig(app),
    /auroraServerlessMaxCapacity/,
  );

  const fractionalMinutes = new App({
    context: {
      imageTag: '0123456789abcdef0123456789abcdef01234567',
      serviceIdleMinutes: 1.5,
    },
  });
  assert.throws(
    () => loadEnvironmentConfig(fractionalMinutes),
    /serviceIdleMinutes/,
  );
});

test('delivery role trusts only the repository and can inspect migration tasks', () => {
  const template = Template.fromStack(stacks().delivery);
  template.hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'raffle-royale-nonprod-github-deploy',
    AssumeRolePolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'sts:AssumeRoleWithWebIdentity',
          Condition: Match.objectLike({
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            },
            StringLike: {
              'token.actions.githubusercontent.com:sub': [
                'repo:MFoster/RaffleRoyale:ref:refs/heads/main',
                'repo:MFoster/RaffleRoyale:environment:non-production',
              ],
            },
          }),
        }),
      ]),
    },
  });
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: Match.arrayWith(['ecs:DescribeTaskDefinition']),
          Effect: 'Allow',
        }),
      ]),
    },
  });
  const policies = JSON.stringify(template.findResources('AWS::IAM::Policy'));
  for (const role of [
    'lookup',
    'file-publishing',
    'image-publishing',
    'deploy',
  ]) {
    assert.match(policies, new RegExp(`cdk-hnb659fds-${role}-role-`));
  }
  assert.match(policies, /ssm:GetParameter/);
  assert.match(policies, /parameter\/cdk-bootstrap\/hnb659fds\/version/);
  const policyResources = Object.values(
    template.findResources('AWS::IAM::Policy'),
  ) as Array<{
    Properties: {
      PolicyDocument: {
        Statement: Array<{
          Action: string | string[];
          Resource: unknown;
        }>;
      };
    };
  }>;
  const statements = policyResources.flatMap(
    ({ Properties }) => Properties.PolicyDocument.Statement,
  );
  assert.deepEqual(
    statements.find(
      ({ Action }) => Action === 'ecr:GetAuthorizationToken',
    )?.Resource,
    '*',
  );
  const ecrPush = statements.find(
    ({ Action }) => Array.isArray(Action) && Action.includes('ecr:PutImage'),
  );
  assert.ok(ecrPush);
  assert.ok(Array.isArray(ecrPush.Action));
  assert.ok(ecrPush.Action.includes('ecr:BatchGetImage'));
  const ecrResources = JSON.stringify(ecrPush.Resource);
  for (const service of ['api', 'web', 'jobs']) {
    assert.match(
      ecrResources,
      new RegExp(`:repository/raffle-royale-nonprod-${service}`),
    );
  }
  assert.doesNotMatch(policies, /repository\/raffle-royale-nonprod-\*/);
});

test('registry uses immutable tags for all service repositories', () => {
  const template = Template.fromStack(stacks().registry);
  template.resourceCountIs('AWS::ECR::Repository', 3);
  template.allResourcesProperties('AWS::ECR::Repository', {
    ImageTagMutability: 'IMMUTABLE',
    ImageScanningConfiguration: { ScanOnPush: true },
  });
});

test('platform creates isolated two-AZ data and messaging resources', () => {
  const template = Template.fromStack(stacks().platform);
  template.resourceCountIs('AWS::EC2::NatGateway', 0);
  // Preserve the former application subnets for a safe cross-stack rollout.
  // They have no hourly charge and no NAT route after this change.
  template.resourceCountIs('AWS::EC2::Subnet', 6);
  template.resourceCountIs('AWS::RDS::DBCluster', 1);
  template.hasResourceProperties('AWS::RDS::DBCluster', {
    DatabaseName: 'raffleroyale',
    Engine: 'aurora-postgresql',
    Port: 5432,
    ServerlessV2ScalingConfiguration: {
      MinCapacity: 0,
      MaxCapacity: 1,
      SecondsUntilAutoPause: 300,
    },
    StorageEncrypted: true,
  });
  template.hasResourceProperties('AWS::RDS::DBInstance', {
    DBInstanceClass: 'db.serverless',
    PubliclyAccessible: false,
  });
  template.hasResourceProperties('AWS::SQS::Queue', {
    RedrivePolicy: Match.objectLike({
      maxReceiveCount: 5,
    }),
    ReceiveMessageWaitTimeSeconds: 20,
  });
  template.resourceCountIs('AWS::Scheduler::ScheduleGroup', 1);
  template.resourceCountIs('AWS::EFS::AccessPoint', 1);
  const ingress = Object.values(
    template.findResources('AWS::EC2::SecurityGroupIngress'),
  ) as Array<{
    Properties: {
      FromPort: number;
      ToPort: number;
      SourceSecurityGroupId?: unknown;
      CidrIp?: string;
    };
  }>;
  const databaseIngress = ingress.filter(
    ({ Properties }) =>
      Properties.FromPort === 5432 && Properties.ToPort === 5432,
  );
  assert.equal(databaseIngress.length, 2);
  assert.ok(
    databaseIngress.every(
      ({ Properties }) =>
        Properties.SourceSecurityGroupId && !Properties.CidrIp,
    ),
  );
  assert.equal(
    ingress.filter(({ Properties }) => Properties.FromPort === 3001).length,
    1,
  );
});

test('migration workload keeps database credentials out of plaintext', () => {
  const template = Template.fromStack(stacks().workloads);
  template.resourceCountIs('AWS::ECS::TaskDefinition', 1);
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    Family: 'raffle-royale-nonprod-migration',
  });
});

test('service workloads keep secrets out of plaintext and disable API cron', () => {
  const template = Template.fromStack(stacks().services);
  template.resourceCountIs('AWS::ECS::TaskDefinition', 3);
  const definitions = template.findResources('AWS::ECS::TaskDefinition');
  const api = Object.values(definitions).find(
    (resource) =>
      (resource as { Properties?: { Family?: string } }).Properties?.Family ===
      'raffle-royale-nonprod-api',
  ) as {
    Properties: {
      ContainerDefinitions: Array<{
        Environment: Array<{ Name: string; Value: string }>;
        Secrets: Array<{ Name: string }>;
      }>;
    };
  };
  assert.ok(api);
  const [container] = api.Properties.ContainerDefinitions;
  assert.ok(container);
  const environment = Object.fromEntries(
    container.Environment.map(({ Name, Value }) => [Name, Value]),
  );
  assert.equal(environment.RAFFLE_EXPIRATION_CRON_ENABLED, 'false');
  assert.equal(environment.RAFFLE_IMAGE_UPLOAD_CLEANUP_ENABLED, 'false');
  assert.equal(environment.RAFFLE_EVENTBRIDGE_SCHEDULER_ENABLED, 'true');
  assert.ok('JOBS_SQS_QUEUE_URL' in environment);
  assert.ok('JOBS_SQS_QUEUE_ARN' in environment);
  assert.ok('EVENTBRIDGE_SCHEDULER_GROUP_NAME' in environment);
  assert.ok('EVENTBRIDGE_SCHEDULER_ROLE_ARN' in environment);
  const secretNames = new Set(container.Secrets.map(({ Name }) => Name));
  assert.ok(secretNames.has('JWT_SECRET'));
  assert.ok(secretNames.has('DB_PASSWORD'));
  assert.ok(
    Object.keys(template.findResources('AWS::IAM::Role')).length >= 6,
  );
});

test('API and jobs share the writable uploads EFS access point', () => {
  const template = Template.fromStack(stacks().services);
  const definitions = Object.values(
    template.findResources('AWS::ECS::TaskDefinition'),
  ) as Array<{
    Properties: {
      Family: string;
      Volumes?: Array<{
        Name: string;
        EFSVolumeConfiguration?: {
          AuthorizationConfig?: { AccessPointId?: unknown };
        };
      }>;
      ContainerDefinitions: Array<{
        Environment: Array<{ Name: string; Value: unknown }>;
        MountPoints?: Array<{
          SourceVolume: string;
          ContainerPath: string;
          ReadOnly: boolean;
        }>;
      }>;
    };
  }>;

  for (const family of [
    'raffle-royale-nonprod-api',
    'raffle-royale-nonprod-jobs',
  ]) {
    const task = definitions.find(
      (definition) => definition.Properties.Family === family,
    );
    assert.ok(task);
    assert.equal(task.Properties.Volumes?.[0]?.Name, 'api-uploads');
    assert.ok(
      task.Properties.Volumes?.[0]?.EFSVolumeConfiguration
        ?.AuthorizationConfig?.AccessPointId,
    );

    const container = task.Properties.ContainerDefinitions[0];
    assert.ok(container);
    assert.deepEqual(container.MountPoints?.[0], {
      SourceVolume: 'api-uploads',
      ContainerPath: '/workspace/apps/api/uploads',
      ReadOnly: false,
    });
    assert.ok(
      container.Environment.some(
        ({ Name, Value }) =>
          Name === 'UPLOADS_DIRECTORY' &&
          Value === '/workspace/apps/api/uploads',
      ),
    );
  }
});

test('services expose web by default and route API paths', () => {
  const template = Template.fromStack(stacks().services);
  assert.doesNotMatch(
    JSON.stringify(template.toJSON()),
    /RaffleRoyaleNonprodWorkloads|Workloads:ExportsOutput/,
  );
  template.resourceCountIs('AWS::ECS::Service', 3);
  template.allResourcesProperties('AWS::ECS::Service', {
    DesiredCount: 0,
    NetworkConfiguration: {
      AwsvpcConfiguration: Match.objectLike({
        AssignPublicIp: 'ENABLED',
      }),
    },
  });
  template.resourceCountIs(
    'AWS::ApplicationAutoScaling::ScalableTarget',
    3,
  );
  template.resourceCountIs(
    'AWS::ApplicationAutoScaling::ScalingPolicy',
    6,
  );
  template.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
    Conditions: Match.arrayWith([
      Match.objectLike({
        Field: 'path-pattern',
        PathPatternConfig: {
          Values: ['/api', '/api/*'],
        },
      }),
    ]),
    Priority: 10,
    Transforms: Match.arrayWith([
      Match.objectLike({
        Type: 'url-rewrite',
      }),
    ]),
  });
  template.resourceCountIs('AWS::Events::Rule', 2);
  const rules = Object.values(template.findResources('AWS::Events::Rule')) as Array<{
    Properties: {
      Targets: Array<{
        EcsParameters?: unknown;
        Input?: unknown;
      }>;
    };
  }>;
  const serializedRules = JSON.stringify(rules);
  assert.ok(rules.every((rule) => rule.Properties.Targets[0]?.EcsParameters));
  assert.match(serializedRules, /reconcile-expired-raffles/);
  assert.match(serializedRules, /cleanup-pending-images/);
  assert.match(serializedRules, /AssignPublicIp":"ENABLED/);
  assert.doesNotMatch(serializedRules, /MessageBody|QueueUrl/);
  const alarms = template.findResources('AWS::CloudWatch::Alarm');
  assert.ok(Object.keys(alarms).length >= 12);
  const serializedAlarms = JSON.stringify(alarms);
  assert.match(serializedAlarms, /AWS\/ApplicationELB/);
  assert.match(serializedAlarms, /HTTPCode_ELB_503_Count/);
  assert.match(serializedAlarms, /RequestCount/);
  assert.match(
    serializedAlarms,
    /FILL\(visible,0\) \+ FILL\(inflight,0\)/,
  );
});
