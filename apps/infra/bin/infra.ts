#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { loadEnvironmentConfig } from '../lib/config/environment';
import {
  DeliveryStack,
  PlatformStack,
  RegistryStack,
  ServicesStack,
  WorkloadsStack,
} from '../lib/stages/non-production';

const app = new App();
const config = loadEnvironmentConfig(app);
const environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'us-east-1',
};
const stackPrefix = 'RaffleRoyaleNonprod';

const delivery = new DeliveryStack(app, `${stackPrefix}Delivery`, config, {
  env: environment,
  description: 'GitHub OIDC delivery role for RaffleRoyale non-production',
});
const registry = new RegistryStack(app, `${stackPrefix}Registry`, config, {
  env: environment,
  description: 'Immutable ECR repositories for RaffleRoyale non-production',
});
const platform = new PlatformStack(app, `${stackPrefix}Platform`, config, {
  env: environment,
  description: 'Network, data, messaging, and shared platform resources',
});
const workloads = new WorkloadsStack(
  app,
  `${stackPrefix}Workloads`,
  config,
  registry.registry,
  platform.platform,
  {
    env: environment,
    description: 'Fargate task definitions and least-privilege workload roles',
  },
);
const services = new ServicesStack(
  app,
  `${stackPrefix}Services`,
  config,
  registry.registry,
  platform.platform,
  {
    env: environment,
    description: 'Fargate services, ALB routing, schedules, and alarms',
  },
);

platform.addStackDependency(registry);
workloads.addStackDependency(platform);
services.addStackDependency(workloads);

app.synth();
