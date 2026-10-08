import { compareDailyCosts } from '../src/cost-analysis';

// Tests the calculation when AWS spending increases.
test('calculates a daily cost increase', () => {
  const result = compareDailyCosts(6, 4);

  expect(result.difference).toBe(2);
  expect(result.percentageChange).toBe(50);
});

// Tests the calculation when AWS spending decreases.
test('calculates a daily cost decrease', () => {
  const result = compareDailyCosts(4, 6);

  expect(result.difference).toBe(-2);
  expect(result.percentageChange).toBeCloseTo(-33.33, 2);
});

// Tests the calculation when AWS spending remains unchanged.
test('calculates unchanged daily spending', () => {
  const result = compareDailyCosts(5, 5);

  expect(result.difference).toBe(0);
  expect(result.percentageChange).toBe(0);
});

// Tests the calculation when the previous day's spending was zero.
test('handles a zero-cost baseline', () => {
  const result = compareDailyCosts(5, 0);

  expect(result.difference).toBe(5);
  expect(result.percentageChange).toBeNull();
});
