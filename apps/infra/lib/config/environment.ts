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
    true,
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
    apiDesiredCount: numberContext(app, 'apiDesiredCount', 1),
    webDesiredCount: numberContext(app, 'webDesiredCount', 1),
    jobsDesiredCount: numberContext(app, 'jobsDesiredCount', 1),
    raffleSweepMinutes: numberContext(app, 'raffleSweepMinutes', 5),
    imageCleanupMinutes: numberContext(app, 'imageCleanupMinutes', 60),
  };
}
