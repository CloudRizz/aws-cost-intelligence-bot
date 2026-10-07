import { getYesterdayCost } from './cost-explorer';

// Defines the Lambda entry point for the AWS Cost Intelligence Bot.
export const handler = async (): Promise<void> => {
  // Records each execution start for operational visibility in CloudWatch.
  console.log('AWS Cost Intelligence Bot started');

  // Retrieves yesterday's AWS cost from Cost Explorer.
  await getYesterdayCost();
};
