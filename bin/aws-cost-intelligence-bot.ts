#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AwsCostIntelligenceBotStack } from '../lib/aws-cost-intelligence-bot-stack';

const app = new cdk.App();
new AwsCostIntelligenceBotStack(app, 'AwsCostIntelligenceBotStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-west-2',
  },  
});
