# ---- set these first ----
 export AWS_REGION=us-east-1
 export VPC_ID=vpc-xxxxxxxx
 export SUBNET_A=subnet-aaaaaaaa   # public subnet (AZ1)
 export SUBNET_B=subnet-bbbbbbbb   # public subnet (AZ2)
 export DB_CLUSTER_ID=raffle-royale-aurora
 export DB_INSTANCE_ID=raffle-royale-aurora-writer
 export DB_SUBNET_GROUP=raffle-royale-aurora-public
 export DB_SG_NAME=raffle-royale-aurora-sg
 export DB_NAME=raffleroyale
 export DB_USER=raffle_api
 export DB_PASS="$(openssl rand -hex 32)"   # URL-safe password
 export MY_IP_CIDR="$(curl -s https://checkip.amazonaws.com)/32"

 # 1) Security group (allow Postgres from your IP)
 SG_ID=$(aws ec2 create-security-group \
   --region "$AWS_REGION" \
   --group-name "$DB_SG_NAME" \
   --description "Aurora Postgres access" \
   --vpc-id "$VPC_ID" \
   --query 'GroupId' --output text)
 
 aws ec2 authorize-security-group-ingress \
   --region "$AWS_REGION" \
   --group-id "$SG_ID" \
   --protocol tcp --port 5432 --cidr "$MY_IP_CIDR"

 # 2) DB subnet group (must use 2+ public subnets in different AZs)
 aws rds create-db-subnet-group \
   --region "$AWS_REGION" \
   --db-subnet-group-name "$DB_SUBNET_GROUP" \
   --db-subnet-group-description "Public subnets for Aurora" \
   --subnet-ids "$SUBNET_A" "$SUBNET_B"

 # 3) Aurora cluster with manual credentials (password auth)
 aws rds create-db-cluster \
   --region "$AWS_REGION" \
   --engine aurora-postgresql \
   --db-cluster-identifier "$DB_CLUSTER_ID" \
   --database-name "$DB_NAME" \
   --master-username "$DB_USER" \
   --master-user-password "$DB_PASS" \
   --db-subnet-group-name "$DB_SUBNET_GROUP" \
   --vpc-security-group-ids "$SG_ID"

 # 4) Writer instance (publicly accessible = internet reachable)
 aws rds create-db-instance \
   --region "$AWS_REGION" \
   --db-instance-identifier "$DB_INSTANCE_ID" \
   --db-cluster-identifier "$DB_CLUSTER_ID" \
   --engine aurora-postgresql \
   --db-instance-class db.t4g.medium \
   --publicly-accessible

 # 5) Wait + print endpoint + app URL
 aws rds wait db-instance-available --region "$AWS_REGION" --db-instance-identifier "$DB_INSTANCE_ID"
 
 ENDPOINT=$(aws rds describe-db-clusters \
   --region "$AWS_REGION" \
   --db-cluster-identifier "$DB_CLUSTER_ID" \
   --query 'DBClusters[0].Endpoint' --output text)
 
 echo "Cluster endpoint: $ENDPOINT"
 echo "ECS_API_DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${ENDPOINT}:5432/${DB_NAME}?schema=public&sslmode=require"
