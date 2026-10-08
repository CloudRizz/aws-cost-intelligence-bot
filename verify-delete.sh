#!/usr/bin/env bash
set -uo pipefail
REGION="eu-west-2"
STACK="AwsCostIntelligenceBotStack"
FAIL=0
WARN=0
ACCOUNT=$(aws sts get-caller-identity --query Account --output text) || exit 2
echo "AWS account: $ACCOUNT | Region: $REGION"

check() {
  local label="$1" output="$2"
  if [[ -n "$output" && "$output" != "None" && "$output" != "[]" ]]; then
    echo "REVIEW: $label"
    echo "$output"
    WARN=1
  else
    echo "CLEAR: $label"
  fi
}

STATUS=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query 'Stacks[0].StackStatus' --output text 2>&1)
if [[ "$STATUS" == "DELETE_COMPLETE" ]]; then echo 'CLEAR: stack DELETE_COMPLETE'
elif [[ "$STATUS" == *'does not exist'* ]]; then echo 'CLEAR: stack not present'
else echo "REVIEW: stack status: $STATUS"; FAIL=1; fi

for P in /cloudrizz/cost-bot/telegram/token /cloudrizz/cost-bot/telegram/chat-id; do
  R=$(aws ssm get-parameter --region "$REGION" --name "$P" --query 'Parameter.Name' --output text 2>&1)
  if [[ "$R" == *'ParameterNotFound'* ]]; then echo "CLEAR: $P"
  else echo "REVIEW: $P ($R)"; FAIL=1; fi
done

# Discovery checks are deliberately read-only. Name matching is a candidate, not proof of ownership.
for ENTRY in \
  'Lambda functions|aws lambda list-functions --region eu-west-2 --query Functions[].FunctionName --output text' \
  'EventBridge schedules|aws scheduler list-schedules --region eu-west-2 --query Schedules[].Name --output text' \
  'SQS queues|aws sqs list-queues --region eu-west-2 --query QueueUrls --output text' \
  'SNS topics|aws sns list-topics --region eu-west-2 --query Topics[].TopicArn --output text' \
  'CloudWatch log groups|aws logs describe-log-groups --region eu-west-2 --query logGroups[].logGroupName --output text' \
  'CloudWatch alarms|aws cloudwatch describe-alarms --region eu-west-2 --query MetricAlarms[].AlarmName --output text' \
  'KMS keys aliases|aws kms list-aliases --region eu-west-2 --query Aliases[].AliasName --output text'; do
  LABEL=${ENTRY%%|*}; CMD=${ENTRY#*|}
  OUTPUT=$(eval "$CMD" 2>&1)
  if [[ $? -ne 0 ]]; then echo "UNKNOWN: $LABEL - $OUTPUT"; FAIL=1; continue; fi
  MATCHES=$(printf '%s\n' "$OUTPUT" | tr '\t' '\n' | grep -Ei 'cost.?intelligence|cost.?bot|AwsCostIntelligenceBotStack' || true)
  check "$LABEL matching project name" "$MATCHES"
done

echo
if [[ $FAIL -ne 0 ]]; then echo 'INCOMPLETE: one or more checks failed or could not confirm absence'; exit 2
elif [[ $WARN -ne 0 ]]; then echo 'REVIEW REQUIRED: possible project resources remain; do not assume they belong to this stack'; exit 1
else echo 'NO PROJECT-NAMED RESOURCES FOUND in checked services. This is not a billing guarantee.'; exit 0; fi
