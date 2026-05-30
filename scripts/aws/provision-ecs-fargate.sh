#!/usr/bin/env bash

set -euo pipefail

: "${AWS_REGION:=us-east-1}"
: "${APP_NAME:=raffle-royale}"
: "${ECS_CLUSTER_NAME:=raffle-royale}"
: "${ECS_API_SERVICE_NAME:=raffle-royale-api}"
: "${ECS_WEB_SERVICE_NAME:=raffle-royale-web}"
: "${ECS_ALB_NAME:=raffle-royale-alb}"
: "${ECS_API_TG_NAME:=raffle-royale-api-tg}"
: "${ECS_WEB_TG_NAME:=raffle-royale-web-tg}"
: "${ECR_REPOSITORY_PREFIX:=raffle-royale}"
: "${API_DATABASE_URL:=postgresql://postgres:postgres@localhost:5432/raffle_royale?schema=public}"
: "${JWT_SECRET:=change-me-jwt-secret}"
: "${JWT_REFRESH_SECRET:=change-me-jwt-refresh-secret}"

AWS_PAGER=""
export AWS_PAGER AWS_REGION

ACCOUNT_ID="$(aws sts get-caller-identity --query 'Account' --output text)"

VPC_ID="$(aws ec2 describe-vpcs \
  --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)"

if [[ "${VPC_ID}" == "None" ]]; then
  echo "No default VPC found. Create a VPC/subnets first, then rerun." >&2
  exit 1
fi

read -r -a SUBNETS <<<"$(aws ec2 describe-subnets \
  --filters Name=vpc-id,Values="${VPC_ID}" Name=default-for-az,Values=true \
  --query 'Subnets[].SubnetId' \
  --output text)"

if [[ "${#SUBNETS[@]}" -lt 2 ]]; then
  echo "Need at least 2 default subnets for ALB." >&2
  exit 1
fi

SUBNET_LIST="$(IFS=,; echo "${SUBNETS[*]}")"

ensure_sg() {
  local name="$1"
  local description="$2"
  local sg_id
  sg_id="$(aws ec2 describe-security-groups \
    --filters Name=vpc-id,Values="${VPC_ID}" Name=group-name,Values="${name}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text)"
  if [[ "${sg_id}" == "None" ]]; then
    sg_id="$(aws ec2 create-security-group \
      --group-name "${name}" \
      --description "${description}" \
      --vpc-id "${VPC_ID}" \
      --query 'GroupId' \
      --output text)"
  fi
  echo "${sg_id}"
}

ALB_SG_ID="$(ensure_sg "${APP_NAME}-alb-sg" "ALB SG for ${APP_NAME}")"
WEB_SG_ID="$(ensure_sg "${APP_NAME}-web-sg" "Web task SG for ${APP_NAME}")"
API_SG_ID="$(ensure_sg "${APP_NAME}-api-sg" "API task SG for ${APP_NAME}")"

aws ec2 authorize-security-group-ingress \
  --group-id "${ALB_SG_ID}" \
  --ip-permissions '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]' \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${WEB_SG_ID}" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":3000,\"ToPort\":3000,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG_ID}\"}]}]" \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${API_SG_ID}" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":3001,\"ToPort\":3001,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG_ID}\"}]}]" \
  >/dev/null 2>&1 || true

ALB_ARN="$(aws elbv2 describe-load-balancers \
  --names "${ECS_ALB_NAME}" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || true)"

if [[ -z "${ALB_ARN}" || "${ALB_ARN}" == "None" ]]; then
  ALB_ARN="$(aws elbv2 create-load-balancer \
    --name "${ECS_ALB_NAME}" \
    --type application \
    --scheme internet-facing \
    --subnets "${SUBNETS[@]}" \
    --security-groups "${ALB_SG_ID}" \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)"
fi

ALB_DNS_NAME="$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "${ALB_ARN}" \
  --query 'LoadBalancers[0].DNSName' \
  --output text)"

ensure_tg() {
  local name="$1"
  local port="$2"
  local health_path="$3"
  local tg_arn
  tg_arn="$(aws elbv2 describe-target-groups \
    --names "${name}" \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text 2>/dev/null || true)"
  if [[ -z "${tg_arn}" || "${tg_arn}" == "None" ]]; then
    tg_arn="$(aws elbv2 create-target-group \
      --name "${name}" \
      --protocol HTTP \
      --port "${port}" \
      --vpc-id "${VPC_ID}" \
      --target-type ip \
      --health-check-path "${health_path}" \
      --query 'TargetGroups[0].TargetGroupArn' \
      --output text)"
  fi
  echo "${tg_arn}"
}

WEB_TG_ARN="$(ensure_tg "${ECS_WEB_TG_NAME}" "3000" "/")"
API_TG_ARN="$(ensure_tg "${ECS_API_TG_NAME}" "3001" "/")"

LISTENER_ARN="$(aws elbv2 describe-listeners \
  --load-balancer-arn "${ALB_ARN}" \
  --query 'Listeners[?Port==`80`].ListenerArn | [0]' \
  --output text)"

if [[ "${LISTENER_ARN}" == "None" ]]; then
  LISTENER_ARN="$(aws elbv2 create-listener \
    --load-balancer-arn "${ALB_ARN}" \
    --protocol HTTP \
    --port 80 \
    --default-actions "Type=forward,TargetGroupArn=${WEB_TG_ARN}" \
    --query 'Listeners[0].ListenerArn' \
    --output text)"
fi

API_RULE_ARN="$(aws elbv2 describe-rules \
  --listener-arn "${LISTENER_ARN}" \
  --query "Rules[?Priority=='10'].RuleArn | [0]" \
  --output text)"

if [[ "${API_RULE_ARN}" == "None" ]]; then
  aws elbv2 create-rule \
    --listener-arn "${LISTENER_ARN}" \
    --priority 10 \
    --conditions 'Field=path-pattern,Values=/api,/api/*' \
    --actions "Type=forward,TargetGroupArn=${API_TG_ARN}" \
    >/dev/null
fi

CLUSTER_STATUS="$(aws ecs describe-clusters \
  --clusters "${ECS_CLUSTER_NAME}" \
  --query 'clusters[0].status' \
  --output text 2>/dev/null || true)"

if [[ -z "${CLUSTER_STATUS}" || "${CLUSTER_STATUS}" == "None" || "${CLUSTER_STATUS}" == "MISSING" ]]; then
  aws ecs create-cluster --cluster-name "${ECS_CLUSTER_NAME}" >/dev/null
fi

aws logs create-log-group --log-group-name "/ecs/${APP_NAME}-api" >/dev/null 2>&1 || true
aws logs create-log-group --log-group-name "/ecs/${APP_NAME}-web" >/dev/null 2>&1 || true

EXECUTION_ROLE_NAME="ecsTaskExecutionRole"
TASK_ROLE_NAME="RaffleRoyaleEcsTaskRole"

cat > /tmp/rr-ecs-task-trust-policy.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

aws iam get-role --role-name "${EXECUTION_ROLE_NAME}" >/dev/null 2>&1 || \
  aws iam create-role \
    --role-name "${EXECUTION_ROLE_NAME}" \
    --assume-role-policy-document file:///tmp/rr-ecs-task-trust-policy.json >/dev/null

aws iam attach-role-policy \
  --role-name "${EXECUTION_ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null

aws iam get-role --role-name "${TASK_ROLE_NAME}" >/dev/null 2>&1 || \
  aws iam create-role \
    --role-name "${TASK_ROLE_NAME}" \
    --assume-role-policy-document file:///tmp/rr-ecs-task-trust-policy.json >/dev/null

rm -f /tmp/rr-ecs-task-trust-policy.json

aws ecr describe-repositories --repository-names "${ECR_REPOSITORY_PREFIX}-api" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${ECR_REPOSITORY_PREFIX}-api" >/dev/null
aws ecr describe-repositories --repository-names "${ECR_REPOSITORY_PREFIX}-web" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "${ECR_REPOSITORY_PREFIX}-web" >/dev/null

escape_for_sed() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

FRONTEND_URL="http://${ALB_DNS_NAME}"
API_IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_PREFIX}-api:main"
WEB_IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_PREFIX}-web:main"

API_TASK_DEF_FILE="$(mktemp)"
WEB_TASK_DEF_FILE="$(mktemp)"

sed \
  -e "s/__AWS_ACCOUNT_ID__/${ACCOUNT_ID}/g" \
  -e "s/__AWS_REGION__/${AWS_REGION}/g" \
  -e "s|REPLACE_API_IMAGE|$(escape_for_sed "${API_IMAGE}")|g" \
  -e "s|__FRONTEND_URL__|$(escape_for_sed "${FRONTEND_URL}")|g" \
  -e "s|__DATABASE_URL__|$(escape_for_sed "${API_DATABASE_URL}")|g" \
  -e "s|__JWT_SECRET__|$(escape_for_sed "${JWT_SECRET}")|g" \
  -e "s|__JWT_REFRESH_SECRET__|$(escape_for_sed "${JWT_REFRESH_SECRET}")|g" \
  .aws/ecs/task-definition-api.json > "${API_TASK_DEF_FILE}"

sed \
  -e "s/__AWS_ACCOUNT_ID__/${ACCOUNT_ID}/g" \
  -e "s/__AWS_REGION__/${AWS_REGION}/g" \
  -e "s|REPLACE_WEB_IMAGE|$(escape_for_sed "${WEB_IMAGE}")|g" \
  .aws/ecs/task-definition-web.json > "${WEB_TASK_DEF_FILE}"

API_TASK_DEFINITION_ARN="$(aws ecs register-task-definition \
  --cli-input-json "file://${API_TASK_DEF_FILE}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"

WEB_TASK_DEFINITION_ARN="$(aws ecs register-task-definition \
  --cli-input-json "file://${WEB_TASK_DEF_FILE}" \
  --query 'taskDefinition.taskDefinitionArn' \
  --output text)"

rm -f "${API_TASK_DEF_FILE}" "${WEB_TASK_DEF_FILE}"

create_or_update_service() {
  local service_name="$1"
  local task_definition_arn="$2"
  local target_group_arn="$3"
  local container_name="$4"
  local container_port="$5"
  local service_sg="$6"

  local existing_service
  existing_service="$(aws ecs describe-services \
    --cluster "${ECS_CLUSTER_NAME}" \
    --services "${service_name}" \
    --query 'services[0].serviceName' \
    --output text 2>/dev/null || true)"

  if [[ -z "${existing_service}" || "${existing_service}" == "None" ]]; then
    aws ecs create-service \
      --cluster "${ECS_CLUSTER_NAME}" \
      --service-name "${service_name}" \
      --task-definition "${task_definition_arn}" \
      --desired-count 1 \
      --launch-type FARGATE \
      --platform-version LATEST \
      --load-balancers "targetGroupArn=${target_group_arn},containerName=${container_name},containerPort=${container_port}" \
      --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_LIST}],securityGroups=[${service_sg}],assignPublicIp=ENABLED}" \
      >/dev/null
  else
    aws ecs update-service \
      --cluster "${ECS_CLUSTER_NAME}" \
      --service "${service_name}" \
      --task-definition "${task_definition_arn}" \
      --force-new-deployment \
      >/dev/null
  fi
}

create_or_update_service \
  "${ECS_API_SERVICE_NAME}" \
  "${API_TASK_DEFINITION_ARN}" \
  "${API_TG_ARN}" \
  "api" \
  "3001" \
  "${API_SG_ID}"

create_or_update_service \
  "${ECS_WEB_SERVICE_NAME}" \
  "${WEB_TASK_DEFINITION_ARN}" \
  "${WEB_TG_ARN}" \
  "web" \
  "3000" \
  "${WEB_SG_ID}"

aws ecs wait services-stable \
  --cluster "${ECS_CLUSTER_NAME}" \
  --services "${ECS_API_SERVICE_NAME}" "${ECS_WEB_SERVICE_NAME}"

cat <<EOF
Provisioning complete.
ALB URL: http://${ALB_DNS_NAME}
Cluster: ${ECS_CLUSTER_NAME}
Services: ${ECS_API_SERVICE_NAME}, ${ECS_WEB_SERVICE_NAME}
API task definition: ${API_TASK_DEFINITION_ARN}
Web task definition: ${WEB_TASK_DEFINITION_ARN}

Set these GitHub repository variables:
- AWS_REGION=${AWS_REGION}
- ECR_REPOSITORY_PREFIX=${ECR_REPOSITORY_PREFIX}
- WEB_API_PROXY_TARGET=http://${ALB_DNS_NAME}
- ECS_CLUSTER=${ECS_CLUSTER_NAME}
- ECS_API_SERVICE=${ECS_API_SERVICE_NAME}
- ECS_WEB_SERVICE=${ECS_WEB_SERVICE_NAME}
- ECS_FRONTEND_URL=http://${ALB_DNS_NAME}

Set these GitHub repository secrets:
- ECS_API_DATABASE_URL
- ECS_JWT_SECRET
- ECS_JWT_REFRESH_SECRET
EOF
