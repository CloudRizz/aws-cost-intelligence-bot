import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';

// Creates the AWS client used to query Cost Explorer.
const costExplorerClient = new CostExplorerClient({
  region: 'us-east-1',
});

// Formats a date as YYYY-MM-DD for the Cost Explorer API.
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Retrieves yesterday's AWS cost from Cost Explorer.
export const getYesterdayCost = async (): Promise<void> => {
  // Calculates today's and yesterday's dates in UTC.
  const today = new Date();
  const yesterday = new Date(today);

  yesterday.setUTCDate(today.getUTCDate() - 1);

  // Builds the Cost Explorer request for yesterday's unblended cost.
  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: formatDate(yesterday),
      End: formatDate(today),
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
  });

  // Sends the request to Cost Explorer.
  const response = await costExplorerClient.send(command);

  // Logs the initial response so we can inspect the returned structure.
  console.log(JSON.stringify(response.ResultsByTime));
};
