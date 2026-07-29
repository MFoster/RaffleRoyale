import {
  Aws,
  Duration,
  Stack,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  type RaffleRoyaleEnvironmentConfig,
  resourcePrefix,
} from './config';

export class GitHubOidcDeliveryRole extends Construct {
  readonly role: iam.Role;
  readonly provider: iam.IOpenIdConnectProvider;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
  ) {
    super(scope, id);
    const prefix = resourcePrefix(config);

    if (config.createGithubOidcProvider) {
      this.provider = new iam.OpenIdConnectProvider(this, 'Provider', {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      });
    } else {
      if (!config.githubOidcProviderArn) {
        throw new Error(
          'githubOidcProviderArn is required when createGithubOidcProvider is false',
        );
      }
      this.provider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
        this,
        'Provider',
        config.githubOidcProviderArn,
      );
    }

    const repository = `${config.githubOwner}/${config.githubRepository}`;
    this.role = new iam.Role(this, 'DeploymentRole', {
      roleName: `${prefix}-github-deploy`,
      description: `GitHub Actions deployment role for ${repository}`,
      assumedBy: new iam.FederatedPrincipal(
        this.provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': [
              `repo:${repository}:ref:refs/heads/main`,
              `repo:${repository}:environment:${config.githubEnvironment}`,
            ],
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      maxSessionDuration: Duration.hours(2),
    });

    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          Stack.of(this).formatArn({
            service: 'iam',
            region: '',
            resource: 'role',
            resourceName: `cdk-*-${Aws.ACCOUNT_ID}-${Aws.REGION}`,
          }),
        ],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:DescribeImages',
          'ecr:DescribeRepositories',
          'ecr:GetDownloadUrlForLayer',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
        ],
        resources: [
          Stack.of(this).formatArn({
            service: 'ecr',
            resource: 'repository',
            resourceName: `${prefix}-*`,
          }),
        ],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'cloudformation:DescribeStacks',
          'ecs:DescribeClusters',
          'ecs:DescribeServices',
          'ecs:DescribeTaskDefinition',
          'ecs:DescribeTasks',
          'ecs:ListTasks',
        ],
        resources: ['*'],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [
          Stack.of(this).formatArn({
            service: 'ecs',
            resource: 'task-definition',
            resourceName: `${prefix}-migration:*`,
          }),
        ],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [
          Stack.of(this).formatArn({
            service: 'iam',
            region: '',
            resource: 'role',
            resourceName: `${prefix}-*`,
          }),
        ],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' },
        },
      }),
    );
  }
}
