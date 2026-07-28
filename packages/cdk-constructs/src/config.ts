export type RaffleRoyaleEnvironmentConfig = {
  projectName: string;
  environmentName: string;
  imageTag: string;
  githubOwner: string;
  githubRepository: string;
  githubEnvironment: string;
  createGithubOidcProvider: boolean;
  githubOidcProviderArn?: string;
  databaseName: string;
  retainData: boolean;
  apiDesiredCount: number;
  webDesiredCount: number;
  jobsDesiredCount: number;
  raffleSweepMinutes: number;
  imageCleanupMinutes: number;
};

export function resourcePrefix(
  config: Pick<RaffleRoyaleEnvironmentConfig, 'projectName' | 'environmentName'>,
): string {
  return `${config.projectName}-${config.environmentName}`.toLowerCase();
}

export function privateNamespaceName(
  config: Pick<RaffleRoyaleEnvironmentConfig, 'projectName' | 'environmentName'>,
): string {
  return `${config.environmentName}.${config.projectName}.internal`.toLowerCase();
}

export function apiInternalUrl(
  config: Pick<RaffleRoyaleEnvironmentConfig, 'projectName' | 'environmentName'>,
): string {
  return `http://api.${privateNamespaceName(config)}:3001`;
}
