// Defines the result of comparing two days of AWS spending.
export type CostComparison = {
  difference: number;
  percentageChange: number | null;
};

// Compares yesterday's AWS cost against the previous day's cost.
export const compareDailyCosts = (
  yesterdayAmount: number,
  previousDayAmount: number,
): CostComparison => {
  // Calculates the monetary difference between the two days.
  const difference = yesterdayAmount - previousDayAmount;

  // Avoids dividing by zero when the previous day's cost was zero.
  const percentageChange =
    previousDayAmount === 0
      ? null
      : (difference / previousDayAmount) * 100;

  // Returns both calculations for reporting and further analysis.
  return {
    difference,
    percentageChange,
  };
};
