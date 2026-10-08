
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class AwsCostIntelligenceBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Creates a dedicated CloudWatch log group with controlled retention.
    const costIntelligenceLogGroup = new logs.LogGroup(this, 'CostIntelligenceLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Creates an SQS dead-letter queue to store failed asynchronous Lambda events.
    const costIntelligenceDlq = new sqs.Queue(this, 'CostIntelligenceDlq', {

      // Retains failed events for seven days before automatically deleting them.
      retentionPeriod: cdk.Duration.days(7),

      // Encrypts messages at rest using SQS-managed encryption.
      encryption: sqs.QueueEncryption.SQS_MANAGED,

      // Deletes the queue when the CDK stack is destroyed.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Creates the TypeScript Lambda responsible for running the cost intelligence workflow.
    const costIntelligenceLambda = new NodejsFunction(this, 'CostIntelligenceLambda', {
      entry: path.join(__dirname, '../src/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,

      // Limits execution time because the Lambda performs short API requests and calculations.
      timeout: cdk.Duration.seconds(30),

      // Provides sufficient memory for this lightweight serverless workload.
      memorySize: 256,

      // Uses the dedicated log group so retention is managed directly by CDK.
      logGroup: costIntelligenceLogGroup,

      // Produces a small deployment bundle while retaining useful TypeScript debugging information.
      bundling: {
        minify: true,
        sourceMap: true,
      },

      // Prevents overlapping Lambda executions.
      reservedConcurrentExecutions: 1,

      // Enables failure handling for asynchronous Lambda invocations.
      deadLetterQueueEnabled: true,

      // Sends failed asynchronous events to the SQS queue after retries are exhausted.
      deadLetterQueue: costIntelligenceDlq,
    });

    // Grants the Lambda permission to retrieve AWS cost and usage data.
    costIntelligenceLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ce:GetCostAndUsage'],
        resources: ['*'],
      }),
    );

    // Grants the Lambda read access to the Telegram parameters in SSM.
    costIntelligenceLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: 'cloudrizz/cost-bot/telegram/token',
          }),
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: 'cloudrizz/cost-bot/telegram/chat-id',
          }),
        ],
      }),
    );
  }
}
