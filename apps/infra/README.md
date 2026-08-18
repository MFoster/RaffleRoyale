# RaffleRoyale non-production AWS CDK

This app is the authoritative definition of the AWS non-production environment
and creates it in five deployment layers:

1. `RaffleRoyaleNonprodDelivery` – GitHub OIDC delivery role.
2. `RaffleRoyaleNonprodRegistry` – immutable ECR repositories.
3. `RaffleRoyaleNonprodPlatform` – VPC, ALB, ECS cluster, Aurora, EFS, SQS, and Scheduler group.
4. `RaffleRoyaleNonprodWorkloads` – isolated migration task definition.
5. `RaffleRoyaleNonprodServices` – service task definitions, ECS services, listener routing, recurring jobs, and alarms.

The immutable `imageTag` context value is required and must be a full lowercase
40-character Git commit SHA.

## First-time account setup

Bootstrap CDK with an administrator session, then deploy the delivery stack once.
The standard CDK bootstrap template attaches `AdministratorAccess` only to the
CloudFormation execution role. GitHub cannot assume that role directly; it can
only assume the four narrowly scoped CDK action roles, which delegate stack
changes to CloudFormation.

```bash
export AWS_REGION=us-east-1
export CDK_DEFAULT_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
export CDK_DEFAULT_REGION="$AWS_REGION"

npx cdk bootstrap "aws://${CDK_DEFAULT_ACCOUNT}/${CDK_DEFAULT_REGION}" \
  --app "npx tsx apps/infra/bin/infra.ts" \
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess \
  --context imageTag=0000000000000000000000000000000000000000

npm run synth -w @raffleroyale/infra -- \
  --context imageTag=0000000000000000000000000000000000000000

npx cdk deploy RaffleRoyaleNonprodDelivery \
  --app "npx tsx apps/infra/bin/infra.ts" \
  --exclusively \
  --require-approval never \
  --context imageTag=0000000000000000000000000000000000000000
```

Set the `GitHubActionsRoleArn` output as the repository environment secret
`AWS_ROLE_TO_ASSUME`. The default configuration imports the standard GitHub
Actions OIDC provider at
`arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com`.
For a new account without that provider, deploy once with
`--context createGithubOidcProvider=true`.

The `non-production` GitHub environment should protect deployments as needed.
Because every AWS deployment job declares this environment, GitHub issues an
OIDC token with this exact subject:

```text
repo:MFoster/RaffleRoyale:environment:non-production
```

Using a GitHub environment replaces the branch-based OIDC subject; it does not
produce `repo:MFoster/RaffleRoyale:ref:refs/heads/main`. The delivery role
trusts both subjects so a direct main-branch job and an environment-scoped job
can authenticate. Repository owner, repository name, and environment matching
in IAM are case-sensitive.

For a nonstandard provider ARN, pass it explicitly:

```bash
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export GITHUB_OIDC_PROVIDER_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

npx cdk deploy RaffleRoyaleNonprodDelivery \
  --app "npx tsx apps/infra/bin/infra.ts" \
  --require-approval never \
  --context imageTag=0000000000000000000000000000000000000000 \
  --context createGithubOidcProvider=false \
  --context githubOidcProviderArn="$GITHUB_OIDC_PROVIDER_ARN"
```

Do not pass `--trust` for this same-account deployment. The standard bootstrap
roles trust the account principal, while the delivery role's identity policy
limits `sts:AssumeRole` to the exact lookup, file-publishing,
image-publishing, and deploy role ARNs. `--trust` is account-scoped (not
role-scoped) and is only needed for cross-account deployments.

Before enabling the workflow, verify the bootstrap marker and delivery role:

```bash
aws ssm get-parameter \
  --region "$AWS_REGION" \
  --name /cdk-bootstrap/hnb659fds/version \
  --query Parameter.Value \
  --output text

aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name RaffleRoyaleNonprodDelivery \
  --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsRoleArn'].OutputValue | [0]" \
  --output text
```

To diagnose an OIDC denial without printing a token, compare the deployed role
trust policy with the failed request's subject in CloudTrail:

```bash
aws iam get-role \
  --role-name raffle-royale-nonprod-github-deploy \
  --query 'Role.AssumeRolePolicyDocument'

aws cloudtrail lookup-events \
  --region "$AWS_REGION" \
  --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --max-results 20
```

The deployment workflow reads CloudFormation outputs rather than requiring ECS,
EFS, database, queue, or ALB values to be duplicated in GitHub variables.

## Runtime notes

- The VPC has public workload subnets and isolated data subnets, with no NAT
  Gateway. Fargate tasks receive public IPs for outbound access, but their
  security groups have no public ingress. Only the ALB can reach API/web, and
  only API/jobs (including migrations) can reach Aurora on port 5432.
- Aurora PostgreSQL Serverless v2 is private, uses 0–1 ACU by default, and
  auto-pauses after five idle minutes. Non-production data is disposable.
- API and jobs construct `DATABASE_URL` inside the container from generated
  Secrets Manager credentials; secret values are not placed in task-definition
  plaintext.
- API, web, and jobs services default to zero tasks with maximum capacity one.
  A cold ALB request increments `HTTPCode_ELB_503_Count` when there are no
  healthy targets and wakes both API and web. The initial request can receive
  503; retry after roughly one to several minutes while Fargate and Aurora
  resume. Both services return to zero after ten idle minutes.
- Jobs wake when visible or in-flight SQS demand is non-zero and return to zero
  only after the queue has remained drained for five minutes.
- API cron flags are disabled and native Scheduler integration is enabled.
  One-time raffle schedules send signed `expire-raffle` messages to SQS.
- EventBridge rules run `reconcile-expired-raffles` every five minutes and
  `cleanup-pending-images` hourly as one-off ECS tasks. The jobs task mounts the
  uploads access point so cleanup removes both database rows and EFS files.
- Deployments temporarily wake API and web, wait for stability, retry cold
  migrations and smoke tests, and restore desired count zero on exit.
- Legacy `.aws/ecs` definitions and `scripts/aws` provisioning are deprecated
  and are not part of the non-production deployment workflow. They remain
  undeleted because all external/manual uses have not been disproven.

Cost controls are typed CDK context values in `cdk.json`:
`auroraServerlessMaxCapacity`, `auroraAutoPauseMinutes`,
`serviceIdleMinutes`, and `jobsDrainMinutes`.
