import * as cdk from 'aws-cdk-lib';
import { AwsCostIntelligenceBotStack } from '../lib/aws-cost-intelligence-bot-stack';
import { Capture, Match, Template } from 'aws-cdk-lib/assertions';

// Creates a synthesized template used to validate the infrastructure configuration.
const app = new cdk.App();
const stack = new AwsCostIntelligenceBotStack(app, 'TestStack');
const template = Template.fromStack(stack);

// Verifies that the application deploys exactly one Lambda function.
test('creates one Lambda function', () => {
  template.resourceCountIs('AWS::Lambda::Function', 1);
});

// Verifies the Lambda uses the expected runtime and resource configuration.
test('configures Lambda correctly', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs22.x',
    Handler: 'index.handler',
    MemorySize: 256,
    Timeout: 30,
  });
});

// Verifies that CloudWatch logs are automatically expired after seven days.
test('configures seven day log retention', () => {
  template.hasResourceProperties('AWS::Logs::LogGroup', {
    RetentionInDays: 7,
  });
});

// Verifies the Lambda can retrieve cost and usage data from Cost Explorer.
test('grants Cost Explorer read permission', () => {
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'ce:GetCostAndUsage',
          Effect: 'Allow',
          Resource: '*',
        }),
      ]),
    },
  });
});

// Verifies the Lambda can read only the two expected Telegram parameters.
test('grants restricted Telegram SSM read permission', () => {
  // Captures the exact resources granted to the SSM permission.
  const resources = new Capture();

  // Locates the SSM permission in the Lambda IAM policy.
  template.hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'ssm:GetParameter',
          Effect: 'Allow',
          Resource: resources,
        }),
      ]),
    },
  });

  // Confirms the policy contains exactly two parameter resources.
  expect(resources.asArray()).toHaveLength(2);

  // Confirms neither resource grants wildcard access.
  expect(resources.asArray()).not.toContain('*');

  // Confirms the expected Telegram parameter paths are present.
  expect(JSON.stringify(resources.asArray())).toContain('cloudrizz/cost-bot/telegram/chat-id');
  expect(JSON.stringify(resources.asArray())).toContain('cloudrizz/cost-bot/telegram/token');
});

// Verifies the Lambda is limited to one concurrent execution.
test('limits Lambda concurrency to one', () => {
  template.hasResourceProperties('AWS::Lambda::Function', {
    ReservedConcurrentExecutions: 1,
  });
});
