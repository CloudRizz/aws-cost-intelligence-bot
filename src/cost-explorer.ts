import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';

// Defines the structured cost data returned by Cost Explorer.
type CostData = {
  date: string;
  amount: number;
  currency: string;
};

// Creates the AWS client used to query Cost Explorer.
const costExplorerClient = new CostExplorerClient({
  region: 'us-east-1',
});

// Formats a date as YYYY-MM-DD for the Cost Explorer API.
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Retrieves yesterday's AWS cost from Cost Explorer.
export const getYesterdayCost = async (): Promise<CostData> => {
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

  // Extracts yesterday's result from the Cost Explorer response.
  const result = response.ResultsByTime?.[0];

  // Converts the returned cost amount into a number and defaults missing cost to zero.
  const amount = Number(result?.Total?.UnblendedCost?.Amount ?? '0');

  // Uses the returned currency unit and defaults to USD when unavailable.
  const currency = result?.Total?.UnblendedCost?.Unit ?? 'USD';

  // Returns yesterday's cost in a consistent structure for further analysis.
  return {
    date: formatDate(yesterday),
    amount,
    currency,
  };
};

// Retrieves the current month's AWS cost to date from Cost Explorer.
export const getMonthToDateCost = async (): Promise<CostData> => {
  // Calculates today's date and the first day of the current month in UTC.
  const today = new Date();
  const monthStart = new Date(today);

  monthStart.setUTCDate(1);

  // Builds the Cost Explorer request for the current month's unblended cost.
  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: formatDate(monthStart),
      End: formatDate(today),
    },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
  });

  // Sends the request to Cost Explorer.
  const response = await costExplorerClient.send(command);

  // Extracts the month-to-date result from the Cost Explorer response.
  const result = response.ResultsByTime?.[0];

  // Converts the returned cost amount into a number and defaults missing cost to zero.
  const amount = Number(result?.Total?.UnblendedCost?.Amount ?? '0');

  // Uses the returned currency unit and defaults to USD when unavailable.
  const currency = result?.Total?.UnblendedCost?.Unit ?? 'USD';

  // Returns the month-to-date cost in a consistent structure for further analysis.
  return {
    date: formatDate(monthStart),
    amount,
    currency,
  };
};
