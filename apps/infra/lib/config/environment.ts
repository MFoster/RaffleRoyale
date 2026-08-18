import { App } from 'aws-cdk-lib';
import { type RaffleRoyaleEnvironmentConfig } from '@raffleroyale/cdk-constructs';

function stringContext(app: App, key: string, fallback?: string): string {
  const value = app.node.tryGetContext(key) as unknown;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`CDK context "${key}" is required`);
}

function booleanContext(app: App, key: string, fallback: boolean): boolean {
  const value = app.node.tryGetContext(key) as unknown;
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  throw new Error(`CDK context "${key}" must be true or false`);
}

function numberContext(app: App, key: string, fallback: number): number {
  const value = app.node.tryGetContext(key) as unknown;
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`CDK context "${key}" must be a non-negative integer`);
  }
  return parsed;
}

function positiveNumberContext(app: App, key: string, fallback: number): number {
  const value = app.node.tryGetContext(key) as unknown;
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`CDK context "${key}" must be a positive number`);
  }
  return parsed;
}

function auroraCapacityContext(app: App): number {
  const value = positiveNumberContext(app, 'auroraServerlessMaxCapacity', 1);
  if (value < 1 || value > 4 || !Number.isInteger(value * 2)) {
    throw new Error(
      'CDK context "auroraServerlessMaxCapacity" must be a half-step between 1 and 4 ACU',
    );
  }
  return value;
}

function integerRangeContext(
  app: App,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = numberContext(app, key, fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `CDK context "${key}" must be an integer between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

export function loadEnvironmentConfig(app: App): RaffleRoyaleEnvironmentConfig {
  const imageTag = stringContext(app, 'imageTag');
  if (!/^[a-f0-9]{40}$/.test(imageTag)) {
    throw new Error(
      'CDK context "imageTag" must be an immutable, lowercase 40-character Git commit SHA',
    );
  }

  const createGithubOidcProvider = booleanContext(
    app,
    'createGithubOidcProvider',
    false,
  );
  const githubOidcProviderArn = app.node.tryGetContext(
    'githubOidcProviderArn',
  ) as string | undefined;

  return {
    projectName: stringContext(app, 'projectName', 'raffle-royale'),
    environmentName: stringContext(app, 'environmentName', 'nonprod'),
    imageTag,
    githubOwner: stringContext(app, 'githubOwner', 'MFoster'),
    githubRepository: stringContext(app, 'githubRepository', 'RaffleRoyale'),
    githubEnvironment: stringContext(
      app,
      'githubEnvironment',
      'non-production',
    ),
    createGithubOidcProvider,
    ...(githubOidcProviderArn ? { githubOidcProviderArn } : {}),
    databaseName: stringContext(app, 'databaseName', 'raffleroyale'),
    retainData: booleanContext(app, 'retainData', false),
    auroraServerlessMaxCapacity: auroraCapacityContext(app),
    auroraAutoPauseMinutes: integerRangeContext(
      app,
      'auroraAutoPauseMinutes',
      5,
      5,
      1440,
    ),
    apiDesiredCount: integerRangeContext(app, 'apiDesiredCount', 0, 0, 1),
    webDesiredCount: integerRangeContext(app, 'webDesiredCount', 0, 0, 1),
    jobsDesiredCount: integerRangeContext(app, 'jobsDesiredCount', 0, 0, 1),
    serviceIdleMinutes: integerRangeContext(
      app,
      'serviceIdleMinutes',
      10,
      1,
      60,
    ),
    jobsDrainMinutes: integerRangeContext(
      app,
      'jobsDrainMinutes',
      5,
      1,
      60,
    ),
    raffleSweepMinutes: numberContext(app, 'raffleSweepMinutes', 5),
    imageCleanupMinutes: numberContext(app, 'imageCleanupMinutes', 60),
  };
}
