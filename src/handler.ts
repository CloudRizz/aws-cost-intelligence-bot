import { compareDailyCosts } from './cost-analysis';
import {
  getMonthToDateCost,
  getYesterdayCost,
  getPreviousDayCost,
} from './cost-explorer';


// Defines the Lambda entry point for the AWS Cost Intelligence Bot.
export const handler = async (): Promise<void> => {
  // Records each execution start for operational visibility in CloudWatch.
  console.log('AWS Cost Intelligence Bot started');

  // Retrieves yesterday's AWS cost from Cost Explorer.
  const yesterdayCost = await getYesterdayCost();

  // Retrieves the current month's AWS cost to date from Cost Explorer.
  const monthToDateCost = await getMonthToDateCost();

  // Retrieves the previous day's AWS cost from Cost Explorer.
  const previousDayCost = await getPreviousDayCost();

  // Compares yesterday's AWS spending against the previous day.
  const comparison = compareDailyCosts(
    yesterdayCost.amount,
    previousDayCost.amount,
  );

  // Logs yesterday's structured cost data for operational visibility.
  console.log('Yesterday cost:', yesterdayCost);

  // Logs the month-to-date structured cost data for operational visibility.
  console.log('Month-to-date cost:', monthToDateCost);

  // Logs the previous day's structured cost data for operational visibility.
  console.log('Previous day cost:', previousDayCost);

  // Logs the monetary difference between the two days.
  console.log('Daily cost difference:', comparison.difference);

  // Logs the percentage change, or null when no valid baseline exists.
  console.log('Daily percentage change:', comparison.percentageChange);
};


