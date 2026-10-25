// Add whole hundredths so decimal scores do not accumulate floating-point errors.
const hundredths = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
export const round = (value) => hundredths(Number(value) || 0) / 100;
export const sumScores = (values) => values.reduce((sum, value) => sum + hundredths(Number(value) || 0), 0) / 100;
export const averageScores = (values, divisor = 3) => Math.round(values.reduce((sum, value) => sum + hundredths(Number(value) || 0), 0) / divisor) / 100;
export const formatScore = (value) => round(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
