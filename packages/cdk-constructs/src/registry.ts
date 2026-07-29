import {
  RemovalPolicy,
  aws_ecr as ecr,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  type RaffleRoyaleEnvironmentConfig,
  resourcePrefix,
} from './config';

export class ContainerRegistry extends Construct {
  readonly apiRepository: ecr.Repository;
  readonly webRepository: ecr.Repository;
  readonly jobsRepository: ecr.Repository;

  constructor(
    scope: Construct,
    id: string,
    config: RaffleRoyaleEnvironmentConfig,
  ) {
    super(scope, id);

    const prefix = resourcePrefix(config);
    const createRepository = (service: string): ecr.Repository => {
      const repository = new ecr.Repository(this, `${service}Repository`, {
        repositoryName: `${prefix}-${service}`,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        encryption: ecr.RepositoryEncryption.AES_256,
        removalPolicy: RemovalPolicy.RETAIN,
        emptyOnDelete: false,
        lifecycleRules: [
          {
            description: 'Retain the most recent non-production images',
            maxImageCount: 30,
          },
        ],
      });

      return repository;
    };

    this.apiRepository = createRepository('api');
    this.webRepository = createRepository('web');
    this.jobsRepository = createRepository('jobs');
  }
}
