import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AwsCostIntelligenceBotStack } from '../lib/aws-cost-intelligence-bot-stack';

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
