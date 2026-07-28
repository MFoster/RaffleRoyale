# RaffleRoyale non-production AWS CDK

This app creates a fresh non-production environment in five deployment layers:

1. `RaffleRoyaleNonprodDelivery` – GitHub OIDC provider/role.
2. `RaffleRoyaleNonprodRegistry` – immutable ECR repositories.
3. `RaffleRoyaleNonprodPlatform` – VPC, ALB, ECS cluster, RDS, EFS, SQS, and Scheduler group.
4. `RaffleRoyaleNonprodWorkloads` – isolated migration task definition.
5. `RaffleRoyaleNonprodServices` – service task definitions, ECS services, listener routing, recurring jobs, and alarms.

The immutable `imageTag` context value is required and must be a full lowercase
40-character Git commit SHA.

## First-time account setup

Bootstrap CDK with an administrator session, then deploy the delivery stack once:

```bash
export AWS_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
export CDK_DEFAULT_REGION="$AWS_REGION"

npx cdk bootstrap "aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}" \
  --app "npx tsx apps/infra/bin/infra.ts" \
  --context imageTag=0000000000000000000000000000000000000000

npm run synth -w @raffleroyale/infra -- \
  --context imageTag=0000000000000000000000000000000000000000

npx cdk deploy RaffleRoyaleNonprodDelivery \
  --app "npx tsx apps/infra/bin/infra.ts" \
  --require-approval never \
  --context imageTag=0000000000000000000000000000000000000000
```

Set the `GitHubActionsRoleArn` output as the repository environment secret
`AWS_ROLE_TO_ASSUME`. If the account already has the GitHub Actions OIDC
provider, set `createGithubOidcProvider=false` and provide
`githubOidcProviderArn` in CDK context before deploying the delivery stack.

The `non-production` GitHub environment should protect deployments as needed.
The deployment workflow reads CloudFormation outputs rather than requiring ECS,
EFS, database, queue, or ALB values to be duplicated in GitHub variables.

## Runtime notes

- RDS is private and single-instance by design.
- API and jobs construct `DATABASE_URL` inside the container from generated
  Secrets Manager credentials; secret values are not placed in task-definition
  plaintext.
- API cron flags are disabled and native Scheduler integration is enabled.
  One-time raffle schedules send signed `expire-raffle` messages to SQS.
- EventBridge rules run `reconcile-expired-raffles` every five minutes and
  `cleanup-pending-images` hourly as one-off ECS tasks. The jobs task mounts the
  uploads access point so cleanup removes both database rows and EFS files.
- Legacy `.aws/ecs` definitions and `scripts/aws` provisioning remain available
  until the CDK environment is validated.
