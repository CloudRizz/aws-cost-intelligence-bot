import * as kms from 'aws-cdk-lib/aws-kms';

import * as cdk from 'aws-cdk-lib';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

import * as path from 'path';

export class AwsCostIntelligenceBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

     // Creates an SNS topic for CloudWatch failure and recovery notifications.
    // Customer-managed KMS key encrypts SNS alarm notifications at rest.
    const snsKey = new kms.Key(this, 'CostIntelligenceSnsKey', {
      description: 'Encrypts AWS Cost Intelligence Bot SNS alerts',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Grants CloudWatch permission to encrypt alarm notifications.
    snsKey.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowCloudWatchAlarms',
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudwatch.amazonaws.com')],
      actions: ['kms:GenerateDataKey*', 'kms:Decrypt'],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': cdk.Stack.of(this).account,
        },
      },
    }));

    // SNS topic delivers encrypted operational alerts by email.
    const costIntelligenceAlertsTopic = new sns.Topic(this, 'CostIntelligenceAlertsTopic', {
      displayName: 'AWS Cost Intelligence Bot Alerts',
      masterKey: snsKey,
    });

        // Subscribes the monitoring email address to SNS failure notifications.
    costIntelligenceAlertsTopic.addSubscription(
      new subscriptions.EmailSubscription('hello@twrz.co.uk'),
    );

    // Creates a dedicated CloudWatch log group with controlled retention.
    const costIntelligenceLogGroup = new logs.LogGroup(this, 'CostIntelligenceLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Creates an SQS dead-letter queue to store failed asynchronous Lambda events.
    const costIntelligenceDlq = new sqs.Queue(this, 'CostIntelligenceDlq', {

      // Retains failed events for seven days before automatically deleting them.
      retentionPeriod: cdk.Duration.days(3),

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

    // Creates an IAM role allowing EventBridge Scheduler to invoke the Lambda.
    const schedulerRole = new iam.Role(this, 'CostIntelligenceSchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // Grants permission to invoke only the cost intelligence Lambda.
    costIntelligenceLambda.grantInvoke(schedulerRole);

    // Runs the cost report every day at 19:00 UK local time.
    new scheduler.CfnSchedule(this, 'CostIntelligenceDailySchedule', {
      description: 'Sends the daily AWS cost report to Telegram at 19:00 UK time.',
      scheduleExpression: 'cron(0 19 * * ? *)',
      scheduleExpressionTimezone: 'Europe/London',
      flexibleTimeWindow: {
        mode: 'OFF',
      },
      target: {
        arn: costIntelligenceLambda.functionArn,
        roleArn: schedulerRole.roleArn,
        input: '{}',
      },
      state: 'ENABLED',
    });

    // Detects Lambda execution errors during a five-minute monitoring period.
    const lambdaErrorsAlarm = new cloudwatch.Alarm(this, 'CostIntelligenceLambdaErrorsAlarm', {
      metric: costIntelligenceLambda.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),

      // Triggers when one or more Lambda execution errors occur.
      threshold: 1,
      evaluationPeriods: 1,

      // Avoids treating periods without Lambda executions as failures.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

      // Explains the purpose of the alarm in CloudWatch.
      alarmDescription: 'AWS Cost Intelligence Bot Lambda execution failed.',
    });

    // Sends Lambda execution failure alarms to the shared SNS topic.
    lambdaErrorsAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(costIntelligenceAlertsTopic),
    );

    // Sends an email when the Lambda errors alarm returns to OK.
    lambdaErrorsAlarm.addOkAction(
      new cloudwatchActions.SnsAction(costIntelligenceAlertsTopic),
    );

    // Detects failed asynchronous events waiting in the SQS dead-letter queue.
    const dlqMessagesAlarm = new cloudwatch.Alarm(this, 'CostIntelligenceDlqMessagesAlarm', {
      metric: costIntelligenceDlq.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: 'Maximum',
      }),

      // Triggers when at least one failed event is visible in the queue.
      threshold: 1,
      evaluationPeriods: 1,

      // Avoids alarming when the queue has no published metric data.
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

      // Explains the purpose of the alarm in CloudWatch.
      alarmDescription: 'AWS Cost Intelligence Bot dead-letter queue contains failed events.',
    });

    // Sends dead-letter queue failure alarms to the shared SNS topic.
    dlqMessagesAlarm.addAlarmAction(
      new cloudwatchActions.SnsAction(costIntelligenceAlertsTopic),
    );

    // Sends an email when the dead-letter queue alarm returns to OK.
    dlqMessagesAlarm.addOkAction(
      new cloudwatchActions.SnsAction(costIntelligenceAlertsTopic),
    );
  }
}
