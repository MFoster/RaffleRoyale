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
: "${ECS_API_UPLOADS_EFS_CREATION_TOKEN:=${APP_NAME}-api-uploads}"
: "${ECS_API_UPLOADS_EFS_ACCESS_POINT_PATH:=/api-uploads}"
: "${ECS_PRIVATE_DNS_NAMESPACE:=${APP_NAME}.internal}"
: "${ECS_API_DISCOVERY_SERVICE_NAME:=${ECS_API_SERVICE_NAME}}"
: "${EXPOSE_API_VIA_ALB:=false}"
: "${PUBLIC_DOMAIN:=}"
: "${ROUTE53_HOSTED_ZONE_ID:=}"
: "${ACM_CERTIFICATE_ARN:=}"
: "${ENABLE_HTTPS:=false}"
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
EFS_SG_ID="$(ensure_sg "${APP_NAME}-efs-sg" "EFS SG for ${APP_NAME} uploads")"

aws ec2 authorize-security-group-ingress \
  --group-id "${ALB_SG_ID}" \
  --ip-permissions '[{"IpProtocol":"tcp","FromPort":80,"ToPort":80,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]' \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${ALB_SG_ID}" \
  --ip-permissions '[{"IpProtocol":"tcp","FromPort":443,"ToPort":443,"IpRanges":[{"CidrIp":"0.0.0.0/0"}]}]' \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${WEB_SG_ID}" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":3000,\"ToPort\":3000,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG_ID}\"}]}]" \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${API_SG_ID}" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":3001,\"ToPort\":3001,\"UserIdGroupPairs\":[{\"GroupId\":\"${ALB_SG_ID}\"}]}]" \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${API_SG_ID}" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":3001,\"ToPort\":3001,\"UserIdGroupPairs\":[{\"GroupId\":\"${WEB_SG_ID}\"}]}]" \
  >/dev/null 2>&1 || true

aws ec2 authorize-security-group-ingress \
  --group-id "${EFS_SG_ID}" \
  --ip-permissions "[{\"IpProtocol\":\"tcp\",\"FromPort\":2049,\"ToPort\":2049,\"UserIdGroupPairs\":[{\"GroupId\":\"${API_SG_ID}\"}]}]" \
  >/dev/null 2>&1 || true

EFS_FILE_SYSTEM_ID="$(aws efs describe-file-systems \
  --creation-token "${ECS_API_UPLOADS_EFS_CREATION_TOKEN}" \
  --query 'FileSystems[0].FileSystemId' \
  --output text 2>/dev/null || true)"

if [[ -z "${EFS_FILE_SYSTEM_ID}" || "${EFS_FILE_SYSTEM_ID}" == "None" ]]; then
  EFS_FILE_SYSTEM_ID="$(aws efs create-file-system \
    --creation-token "${ECS_API_UPLOADS_EFS_CREATION_TOKEN}" \
    --encrypted \
    --performance-mode generalPurpose \
    --throughput-mode bursting \
    --tags "Key=Name,Value=${APP_NAME}-api-uploads" \
    --query 'FileSystemId' \
    --output text)"
fi

wait_for_efs_available() {
  local fs_id="$1"
  local max_attempts=60
  local sleep_seconds=5
  local attempt=1

  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    local lifecycle_state
    lifecycle_state="$(aws efs describe-file-systems \
      --file-system-id "${fs_id}" \
      --query 'FileSystems[0].LifeCycleState' \
      --output text)"

    if [[ "${lifecycle_state}" == "available" ]]; then
      return 0
    fi

    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  echo "Timed out waiting for EFS file system ${fs_id} to become available." >&2
  exit 1
}

wait_for_efs_available "${EFS_FILE_SYSTEM_ID}"

for subnet_id in "${SUBNETS[@]}"; do
  mount_target_id="$(aws efs describe-mount-targets \
    --file-system-id "${EFS_FILE_SYSTEM_ID}" \
    --query "MountTargets[?SubnetId=='${subnet_id}'].MountTargetId | [0]" \
    --output text)"

  if [[ -z "${mount_target_id}" || "${mount_target_id}" == "None" ]]; then
    aws efs create-mount-target \
      --file-system-id "${EFS_FILE_SYSTEM_ID}" \
      --subnet-id "${subnet_id}" \
      --security-groups "${EFS_SG_ID}" \
      >/dev/null
  else
    aws efs modify-mount-target-security-groups \
      --mount-target-id "${mount_target_id}" \
      --security-groups "${EFS_SG_ID}" \
      >/dev/null
  fi
done

EFS_ACCESS_POINT_ID="$(aws efs describe-access-points \
  --file-system-id "${EFS_FILE_SYSTEM_ID}" \
  --query "AccessPoints[?RootDirectory.Path=='${ECS_API_UPLOADS_EFS_ACCESS_POINT_PATH}'].AccessPointId | [0]" \
  --output text)"

if [[ -z "${EFS_ACCESS_POINT_ID}" || "${EFS_ACCESS_POINT_ID}" == "None" ]]; then
  EFS_ACCESS_POINT_ID="$(aws efs create-access-point \
    --file-system-id "${EFS_FILE_SYSTEM_ID}" \
    --root-directory "Path=${ECS_API_UPLOADS_EFS_ACCESS_POINT_PATH},CreationInfo={OwnerUid=0,OwnerGid=0,Permissions=0775}" \
    --tags "Key=Name,Value=${APP_NAME}-api-uploads-ap" \
    --query 'AccessPointId' \
    --output text)"
fi

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

ALB_HOSTED_ZONE_ID="$(aws elbv2 describe-load-balancers \
  --load-balancer-arns "${ALB_ARN}" \
  --query 'LoadBalancers[0].CanonicalHostedZoneId' \
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

wait_for_certificate_issued() {
  local certificate_arn="$1"
  local max_attempts=60
  local sleep_seconds=10
  local attempt=1

  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    local certificate_status
    certificate_status="$(aws acm describe-certificate \
      --certificate-arn "${certificate_arn}" \
      --query 'Certificate.Status' \
      --output text)"

    if [[ "${certificate_status}" == "ISSUED" ]]; then
      return 0
    fi

    if [[ "${certificate_status}" == "FAILED" || "${certificate_status}" == "EXPIRED" || "${certificate_status}" == "VALIDATION_TIMED_OUT" || "${certificate_status}" == "REVOKED" ]]; then
      echo "ACM certificate ${certificate_arn} is in terminal status: ${certificate_status}" >&2
      exit 1
    fi

    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  echo "Timed out waiting for ACM certificate ${certificate_arn} to become ISSUED." >&2
  exit 1
}

upsert_route53_cname_record() {
  local hosted_zone_id="$1"
  local record_name="$2"
  local record_value="$3"
  local change_batch_file
  change_batch_file="$(mktemp)"

  cat > "${change_batch_file}" <<JSON
{
  "Comment": "ACM DNS validation record",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${record_name}",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [
          { "Value": "${record_value}" }
        ]
      }
    }
  ]
}
JSON

  aws route53 change-resource-record-sets \
    --hosted-zone-id "${hosted_zone_id}" \
    --change-batch "file://${change_batch_file}" \
    >/dev/null

  rm -f "${change_batch_file}"
}

upsert_route53_alias_record() {
  local hosted_zone_id="$1"
  local record_name="$2"
  local alb_dns_name="$3"
  local alb_hosted_zone_id="$4"
  local change_batch_file
  change_batch_file="$(mktemp)"

  cat > "${change_batch_file}" <<JSON
{
  "Comment": "ALB alias record",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${record_name}",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "${alb_hosted_zone_id}",
          "DNSName": "dualstack.${alb_dns_name}",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
JSON

  aws route53 change-resource-record-sets \
    --hosted-zone-id "${hosted_zone_id}" \
    --change-batch "file://${change_batch_file}" \
    >/dev/null

  rm -f "${change_batch_file}"
}

CERTIFICATE_ARN="${ACM_CERTIFICATE_ARN}"
PUBLIC_ENDPOINT_SCHEME="http"
PUBLIC_ENDPOINT_HOST="${ALB_DNS_NAME}"

if [[ "${ENABLE_HTTPS}" == "true" ]]; then
  if [[ -z "${CERTIFICATE_ARN}" && -n "${PUBLIC_DOMAIN}" ]]; then
    CERTIFICATE_ARN="$(aws acm list-certificates \
      --certificate-statuses ISSUED PENDING_VALIDATION INACTIVE \
      --query "CertificateSummaryList[?DomainName=='${PUBLIC_DOMAIN}'] | [0].CertificateArn" \
      --output text)"

    if [[ "${CERTIFICATE_ARN}" == "None" ]]; then
      CERTIFICATE_ARN=""
    fi
  fi

  if [[ -z "${CERTIFICATE_ARN}" && -n "${PUBLIC_DOMAIN}" && -n "${ROUTE53_HOSTED_ZONE_ID}" ]]; then
    CERTIFICATE_ARN="$(aws acm request-certificate \
      --domain-name "${PUBLIC_DOMAIN}" \
      --validation-method DNS \
      --idempotency-token "$(printf '%s' "${APP_NAME}" | tr -cd '[:alnum:]' | cut -c1-32)" \
      --query 'CertificateArn' \
      --output text)"
  fi

  if [[ -n "${CERTIFICATE_ARN}" && -n "${ROUTE53_HOSTED_ZONE_ID}" ]]; then
    validation_records=""
    for _ in {1..30}; do
      validation_records="$(aws acm describe-certificate \
        --certificate-arn "${CERTIFICATE_ARN}" \
        --query 'Certificate.DomainValidationOptions[?ResourceRecord!=null].ResourceRecord.[Name,Type,Value]' \
        --output text)"
      if [[ -n "${validation_records}" ]]; then
        break
      fi
      sleep 5
    done

    if [[ -z "${validation_records}" ]]; then
      echo "Could not fetch ACM DNS validation records for ${CERTIFICATE_ARN}." >&2
      exit 1
    fi

    while IFS=$'\t' read -r record_name record_type record_value; do
      if [[ -n "${record_name}" && "${record_type}" == "CNAME" && -n "${record_value}" ]]; then
        upsert_route53_cname_record "${ROUTE53_HOSTED_ZONE_ID}" "${record_name}" "${record_value}"
      fi
    done <<< "${validation_records}"
  fi

  if [[ -z "${CERTIFICATE_ARN}" ]]; then
    echo "ENABLE_HTTPS=true requires ACM_CERTIFICATE_ARN, or PUBLIC_DOMAIN with ROUTE53_HOSTED_ZONE_ID." >&2
    exit 1
  fi

  wait_for_certificate_issued "${CERTIFICATE_ARN}"

  PUBLIC_ENDPOINT_SCHEME="https"
  if [[ -n "${PUBLIC_DOMAIN}" ]]; then
    PUBLIC_ENDPOINT_HOST="${PUBLIC_DOMAIN}"
  fi

  if [[ -n "${PUBLIC_DOMAIN}" && -n "${ROUTE53_HOSTED_ZONE_ID}" ]]; then
    upsert_route53_alias_record "${ROUTE53_HOSTED_ZONE_ID}" "${PUBLIC_DOMAIN}" "${ALB_DNS_NAME}" "${ALB_HOSTED_ZONE_ID}"
  fi
else
  echo "WARNING: ENABLE_HTTPS=false; provisioning HTTP-only public listener." >&2
fi

HTTP_LISTENER_ARN="$(aws elbv2 describe-listeners \
  --load-balancer-arn "${ALB_ARN}" \
  --query 'Listeners[?Port==`80`].ListenerArn | [0]' \
  --output text)"

if [[ "${HTTP_LISTENER_ARN}" == "None" ]]; then
  if [[ "${PUBLIC_ENDPOINT_SCHEME}" == "https" ]]; then
    HTTP_LISTENER_ARN="$(aws elbv2 create-listener \
      --load-balancer-arn "${ALB_ARN}" \
      --protocol HTTP \
      --port 80 \
      --default-actions '[{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","StatusCode":"HTTP_301","Host":"#{host}","Path":"/#{path}","Query":"#{query}"}}]' \
      --query 'Listeners[0].ListenerArn' \
      --output text)"
  else
    HTTP_LISTENER_ARN="$(aws elbv2 create-listener \
      --load-balancer-arn "${ALB_ARN}" \
      --protocol HTTP \
      --port 80 \
      --default-actions "Type=forward,TargetGroupArn=${WEB_TG_ARN}" \
      --query 'Listeners[0].ListenerArn' \
      --output text)"
  fi
elif [[ "${PUBLIC_ENDPOINT_SCHEME}" == "https" ]]; then
  aws elbv2 modify-listener \
    --listener-arn "${HTTP_LISTENER_ARN}" \
    --default-actions '[{"Type":"redirect","RedirectConfig":{"Protocol":"HTTPS","Port":"443","StatusCode":"HTTP_301","Host":"#{host}","Path":"/#{path}","Query":"#{query}"}}]' \
    >/dev/null
else
  aws elbv2 modify-listener \
    --listener-arn "${HTTP_LISTENER_ARN}" \
    --default-actions "Type=forward,TargetGroupArn=${WEB_TG_ARN}" \
    >/dev/null
fi

ROUTING_LISTENER_ARN="${HTTP_LISTENER_ARN}"

if [[ "${PUBLIC_ENDPOINT_SCHEME}" == "https" ]]; then
  HTTPS_LISTENER_ARN="$(aws elbv2 describe-listeners \
    --load-balancer-arn "${ALB_ARN}" \
    --query 'Listeners[?Port==`443`].ListenerArn | [0]' \
    --output text)"

  if [[ "${HTTPS_LISTENER_ARN}" == "None" ]]; then
    HTTPS_LISTENER_ARN="$(aws elbv2 create-listener \
      --load-balancer-arn "${ALB_ARN}" \
      --protocol HTTPS \
      --port 443 \
      --certificates "CertificateArn=${CERTIFICATE_ARN}" \
      --ssl-policy ELBSecurityPolicy-TLS13-1-2-Res-2021-06 \
      --default-actions "Type=forward,TargetGroupArn=${WEB_TG_ARN}" \
      --query 'Listeners[0].ListenerArn' \
      --output text)"
  else
    aws elbv2 modify-listener \
      --listener-arn "${HTTPS_LISTENER_ARN}" \
      --certificates "CertificateArn=${CERTIFICATE_ARN}" \
      --ssl-policy ELBSecurityPolicy-TLS13-1-2-Res-2021-06 \
      --default-actions "Type=forward,TargetGroupArn=${WEB_TG_ARN}" \
      >/dev/null
  fi

  ROUTING_LISTENER_ARN="${HTTPS_LISTENER_ARN}"
fi

set_or_remove_api_rule() {
  local listener_arn="$1"
  if [[ -z "${listener_arn}" || "${listener_arn}" == "None" ]]; then
    return 0
  fi

  local api_rule_arn
  api_rule_arn="$(aws elbv2 describe-rules \
    --listener-arn "${listener_arn}" \
    --query "Rules[?Priority=='10'].RuleArn | [0]" \
    --output text)"

  if [[ "${EXPOSE_API_VIA_ALB}" == "true" ]]; then
    if [[ "${api_rule_arn}" == "None" ]]; then
      aws elbv2 create-rule \
        --listener-arn "${listener_arn}" \
        --priority 10 \
        --conditions 'Field=path-pattern,Values=/api,/api/*' \
        --actions "Type=forward,TargetGroupArn=${API_TG_ARN}" \
        >/dev/null
    fi
  elif [[ "${api_rule_arn}" != "None" ]]; then
    aws elbv2 delete-rule --rule-arn "${api_rule_arn}" >/dev/null
  fi
}

set_or_remove_api_rule "${HTTP_LISTENER_ARN}"
if [[ "${ROUTING_LISTENER_ARN}" != "${HTTP_LISTENER_ARN}" ]]; then
  set_or_remove_api_rule "${ROUTING_LISTENER_ARN}"
fi

CLUSTER_STATUS="$(aws ecs describe-clusters \
  --clusters "${ECS_CLUSTER_NAME}" \
  --query 'clusters[0].status' \
  --output text 2>/dev/null || true)"

if [[ -z "${CLUSTER_STATUS}" || "${CLUSTER_STATUS}" == "None" || "${CLUSTER_STATUS}" == "MISSING" ]]; then
  aws ecs create-cluster --cluster-name "${ECS_CLUSTER_NAME}" >/dev/null
fi

wait_for_namespace_operation() {
  local operation_id="$1"
  local max_attempts=60
  local sleep_seconds=5
  local attempt=1

  while [[ "${attempt}" -le "${max_attempts}" ]]; do
    local operation_status
    operation_status="$(aws servicediscovery get-operation \
      --operation-id "${operation_id}" \
      --query 'Operation.Status' \
      --output text)"

    if [[ "${operation_status}" == "SUCCESS" ]]; then
      aws servicediscovery get-operation \
        --operation-id "${operation_id}" \
        --query 'Operation.Targets.NAMESPACE' \
        --output text
      return 0
    fi

    if [[ "${operation_status}" == "FAIL" ]]; then
      echo "Cloud Map operation ${operation_id} failed." >&2
      exit 1
    fi

    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  echo "Timed out waiting for Cloud Map operation ${operation_id}." >&2
  exit 1
}

PRIVATE_DNS_NAMESPACE_ID="$(aws servicediscovery list-namespaces \
  --query "Namespaces[?Name=='${ECS_PRIVATE_DNS_NAMESPACE}' && Type=='DNS_PRIVATE'].Id | [0]" \
  --output text)"

if [[ -z "${PRIVATE_DNS_NAMESPACE_ID}" || "${PRIVATE_DNS_NAMESPACE_ID}" == "None" ]]; then
  create_namespace_operation_id="$(aws servicediscovery create-private-dns-namespace \
    --name "${ECS_PRIVATE_DNS_NAMESPACE}" \
    --vpc "${VPC_ID}" \
    --creator-request-id "${APP_NAME}-private-dns-namespace" \
    --query 'OperationId' \
    --output text)"
  PRIVATE_DNS_NAMESPACE_ID="$(wait_for_namespace_operation "${create_namespace_operation_id}")"
fi

API_DISCOVERY_SERVICE_ID="$(aws servicediscovery list-services \
  --filters "Name=NAMESPACE_ID,Values=${PRIVATE_DNS_NAMESPACE_ID},Condition=EQ" \
  --query "Services[?Name=='${ECS_API_DISCOVERY_SERVICE_NAME}'].Id | [0]" \
  --output text)"

if [[ -z "${API_DISCOVERY_SERVICE_ID}" || "${API_DISCOVERY_SERVICE_ID}" == "None" ]]; then
  API_DISCOVERY_SERVICE_ID="$(aws servicediscovery create-service \
    --name "${ECS_API_DISCOVERY_SERVICE_NAME}" \
    --dns-config "NamespaceId=${PRIVATE_DNS_NAMESPACE_ID},DnsRecords=[{Type=A,TTL=10}],RoutingPolicy=MULTIVALUE" \
    --query 'Service.Id' \
    --output text)"
fi

API_DISCOVERY_SERVICE_ARN="$(aws servicediscovery get-service \
  --id "${API_DISCOVERY_SERVICE_ID}" \
  --query 'Service.Arn' \
  --output text)"

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

FRONTEND_URL="${PUBLIC_ENDPOINT_SCHEME}://${PUBLIC_ENDPOINT_HOST}"
API_INTERNAL_URL="http://${ECS_API_DISCOVERY_SERVICE_NAME}.${ECS_PRIVATE_DNS_NAMESPACE}:3001"
API_IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_PREFIX}-api:main"
WEB_IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_PREFIX}-web:main"

API_TASK_DEF_FILE="$(mktemp)"
WEB_TASK_DEF_FILE="$(mktemp)"

sed \
  -e "s/__AWS_ACCOUNT_ID__/${ACCOUNT_ID}/g" \
  -e "s/__AWS_REGION__/${AWS_REGION}/g" \
  -e "s|REPLACE_API_IMAGE|$(escape_for_sed "${API_IMAGE}")|g" \
  -e "s|__FRONTEND_URL__|$(escape_for_sed "${FRONTEND_URL}")|g" \
  -e "s/__ECS_API_UPLOADS_EFS_FILESYSTEM_ID__/${EFS_FILE_SYSTEM_ID}/g" \
  -e "s/__ECS_API_UPLOADS_EFS_ACCESS_POINT_ID__/${EFS_ACCESS_POINT_ID}/g" \
  -e "s|__DATABASE_URL__|$(escape_for_sed "${API_DATABASE_URL}")|g" \
  -e "s|__JWT_SECRET__|$(escape_for_sed "${JWT_SECRET}")|g" \
  -e "s|__JWT_REFRESH_SECRET__|$(escape_for_sed "${JWT_REFRESH_SECRET}")|g" \
  .aws/ecs/task-definition-api.json > "${API_TASK_DEF_FILE}"

sed \
  -e "s/__AWS_ACCOUNT_ID__/${ACCOUNT_ID}/g" \
  -e "s/__AWS_REGION__/${AWS_REGION}/g" \
  -e "s|__WEB_API_PROXY_TARGET__|$(escape_for_sed "${API_INTERNAL_URL}")|g" \
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
  local service_registry_arn="${7:-}"
  local should_attach_load_balancer="false"

  if [[ -n "${target_group_arn}" ]]; then
    should_attach_load_balancer="true"
  fi

  local existing_service
  existing_service="$(aws ecs describe-services \
    --cluster "${ECS_CLUSTER_NAME}" \
    --services "${service_name}" \
    --query 'services[0].serviceName' \
    --output text 2>/dev/null || true)"

  if [[ -n "${existing_service}" && "${existing_service}" != "None" ]]; then
    local existing_lb_count
    existing_lb_count="$(aws ecs describe-services \
      --cluster "${ECS_CLUSTER_NAME}" \
      --services "${service_name}" \
      --query 'length(services[0].loadBalancers)' \
      --output text)"

    local existing_has_load_balancer="false"
    if [[ "${existing_lb_count}" != "0" ]]; then
      existing_has_load_balancer="true"
    fi

    if [[ "${existing_has_load_balancer}" != "${should_attach_load_balancer}" ]]; then
      aws ecs delete-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service "${service_name}" \
        --force \
        >/dev/null
      aws ecs wait services-inactive \
        --cluster "${ECS_CLUSTER_NAME}" \
        --services "${service_name}"
      existing_service="None"
    fi
  fi

  if [[ -z "${existing_service}" || "${existing_service}" == "None" ]]; then
    if [[ "${should_attach_load_balancer}" == "true" && -n "${service_registry_arn}" ]]; then
      aws ecs create-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service-name "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --desired-count 1 \
        --launch-type FARGATE \
        --platform-version LATEST \
        --load-balancers "targetGroupArn=${target_group_arn},containerName=${container_name},containerPort=${container_port}" \
        --service-registries "registryArn=${service_registry_arn}" \
        --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_LIST}],securityGroups=[${service_sg}],assignPublicIp=ENABLED}" \
        >/dev/null
    elif [[ "${should_attach_load_balancer}" == "true" ]]; then
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
    elif [[ -n "${service_registry_arn}" ]]; then
      aws ecs create-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service-name "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --desired-count 1 \
        --launch-type FARGATE \
        --platform-version LATEST \
        --service-registries "registryArn=${service_registry_arn}" \
        --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_LIST}],securityGroups=[${service_sg}],assignPublicIp=ENABLED}" \
        >/dev/null
    else
      aws ecs create-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service-name "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --desired-count 1 \
        --launch-type FARGATE \
        --platform-version LATEST \
        --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_LIST}],securityGroups=[${service_sg}],assignPublicIp=ENABLED}" \
        >/dev/null
    fi
  else
    if [[ "${should_attach_load_balancer}" == "true" && -n "${service_registry_arn}" ]]; then
      aws ecs update-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --load-balancers "targetGroupArn=${target_group_arn},containerName=${container_name},containerPort=${container_port}" \
        --service-registries "registryArn=${service_registry_arn}" \
        --force-new-deployment \
        >/dev/null
    elif [[ "${should_attach_load_balancer}" == "true" ]]; then
      aws ecs update-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --load-balancers "targetGroupArn=${target_group_arn},containerName=${container_name},containerPort=${container_port}" \
        --force-new-deployment \
        >/dev/null
    elif [[ -n "${service_registry_arn}" ]]; then
      aws ecs update-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --service-registries "registryArn=${service_registry_arn}" \
        --force-new-deployment \
        >/dev/null
    else
      aws ecs update-service \
        --cluster "${ECS_CLUSTER_NAME}" \
        --service "${service_name}" \
        --task-definition "${task_definition_arn}" \
        --force-new-deployment \
        >/dev/null
    fi
  fi
}

API_SERVICE_TARGET_GROUP_ARN=""
if [[ "${EXPOSE_API_VIA_ALB}" == "true" ]]; then
  API_SERVICE_TARGET_GROUP_ARN="${API_TG_ARN}"
fi

create_or_update_service \
  "${ECS_API_SERVICE_NAME}" \
  "${API_TASK_DEFINITION_ARN}" \
  "${API_SERVICE_TARGET_GROUP_ARN}" \
  "api" \
  "3001" \
  "${API_SG_ID}" \
  "${API_DISCOVERY_SERVICE_ARN}"

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
Public URL: ${FRONTEND_URL}
Cluster: ${ECS_CLUSTER_NAME}
Services: ${ECS_API_SERVICE_NAME}, ${ECS_WEB_SERVICE_NAME}
API task definition: ${API_TASK_DEFINITION_ARN}
Web task definition: ${WEB_TASK_DEFINITION_ARN}
ACM certificate: ${CERTIFICATE_ARN:-not-configured}
API internal URL: ${API_INTERNAL_URL}
API exposed via ALB path rule: ${EXPOSE_API_VIA_ALB}

Set these GitHub repository variables:
- AWS_REGION=${AWS_REGION}
- ECR_REPOSITORY_PREFIX=${ECR_REPOSITORY_PREFIX}
- WEB_API_PROXY_TARGET=${API_INTERNAL_URL}
- ECS_CLUSTER=${ECS_CLUSTER_NAME}
- ECS_API_SERVICE=${ECS_API_SERVICE_NAME}
- ECS_WEB_SERVICE=${ECS_WEB_SERVICE_NAME}
- ECS_FRONTEND_URL=${FRONTEND_URL}
- ECS_API_UPLOADS_EFS_FILESYSTEM_ID=${EFS_FILE_SYSTEM_ID}
- ECS_API_UPLOADS_EFS_ACCESS_POINT_ID=${EFS_ACCESS_POINT_ID}

Set these GitHub repository secrets:
- ECS_API_DATABASE_URL
- ECS_JWT_SECRET
- ECS_JWT_REFRESH_SECRET
EOF
