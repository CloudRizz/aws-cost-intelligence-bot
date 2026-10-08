import { compareDailyCosts } from './cost-analysis';
import { sendTelegramMessage } from './telegram';
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

  // Formats the daily difference with a positive or negative sign.
  const dailyDifference =
    `${comparison.difference >= 0 ? '+' : '-'}$${Math.abs(comparison.difference).toFixed(2)}`;

  // Formats the percentage change or shows N/A when the previous cost was zero.
  const percentageChange =
    comparison.percentageChange === null
      ? 'N/A'
      : `${comparison.percentageChange >= 0 ? '+' : ''}${comparison.percentageChange.toFixed(1)}%`;

  // Determines the spending trend shown in the Telegram report.
  const trend =
    comparison.difference > 0
      ? '⚠️ Spending increased compared with the previous day.'
      : comparison.difference < 0
        ? '✅ Spending decreased compared with the previous day.'
        : '➡️ Spending remained unchanged.';

  // Builds the AWS cost report using the retrieved Cost Explorer data.
  const message = [
    '☁️ AWS Cost Report',
    '',
    `Month-to-date: $${monthToDateCost.amount.toFixed(2)}`,
    `Yesterday: $${yesterdayCost.amount.toFixed(2)}`,
    `Previous day: $${previousDayCost.amount.toFixed(2)}`,
    `Daily change: ${dailyDifference} (${percentageChange})`,
    '',
    trend,
  ].join('\n');


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

  // Sends the completed cost report to Telegram.
  await sendTelegramMessage(message);
  // Records successful submission without exposing Telegram credentials.
  console.log('AWS cost report sent to Telegram');
};

