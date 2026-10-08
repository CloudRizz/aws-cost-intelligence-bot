#!/usr/bin/env bash
set -Eeuo pipefail

REGION="eu-west-2"
STACK="AwsCostIntelligenceBotStack"
PARAMS=("/cloudrizz/cost-bot/telegram/token" "/cloudrizz/cost-bot/telegram/chat-id")

command -v aws >/dev/null || { echo 'AWS CLI is required'; exit 2; }
command -v npx >/dev/null || { echo 'Node/npm/npx are required'; exit 2; }
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "Account: $ACCOUNT | Region: $REGION | Stack: $STACK"
echo 'This deletes the named CDK stack and two SSM parameters.'
echo 'It does NOT delete shared CDK bootstrap infrastructure, unrelated resources or historical billing data.'
read -r -p "Type DELETE $STACK to continue: " CONFIRM
[[ "$CONFIRM" == "DELETE $STACK" ]] || { echo 'Cancelled'; exit 1; }

# Prefer direct CloudFormation deletion: no dependency on the local CDK environment.
if aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" >/dev/null 2>&1; then
  echo 'Deleting CloudFormation stack...'
  aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK"
  aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$STACK"
  echo 'CloudFormation stack deletion completed.'
else
  echo 'No active CloudFormation stack found (or access denied).'
fi

for PARAM in "${PARAMS[@]}"; do
  if aws ssm get-parameter --region "$REGION" --name "$PARAM" --query 'Parameter.Name' --output text >/dev/null 2>&1; then
    aws ssm delete-parameter --region "$REGION" --name "$PARAM"
    echo "Deleted SSM parameter: $PARAM"
  else
    echo "SSM parameter not found (or access denied): $PARAM"
  fi
done

echo
 echo 'IMPORTANT: CloudWatch log groups can survive stack deletion if retained or created outside the stack.'
echo 'Review potential project log groups below; delete ONLY ones confirmed to belong to this bot:'
aws logs describe-log-groups --region "$REGION" --query 'logGroups[].[logGroupName,storedBytes]' --output text | grep -Ei 'cost.?intelligence|cost.?bot|AwsCostIntelligenceBotStack' || true

echo 'Review remaining project-related resources using the companion verification script.'
