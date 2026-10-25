import assert from 'node:assert/strict';
import { round, sumScores, averageScores, formatScore } from './score-math.js';

assert.equal(sumScores([8.75, 9.25, 8.55, 9.35]), 35.90);
assert.equal(sumScores([0.1, 0.2, 0.3, 0.4]), 1);
assert.equal(averageScores([35.90, 36.25, 34.80]), 35.65);
assert.equal(averageScores([10, 0, 0]), 3.33);
assert.equal(averageScores([10, 10, 0]), 6.67);
assert.equal(sumScores([32.15, 35.65]), 67.80);
assert.equal(round(1.005), 1.01);
assert.equal(formatScore(35.9), (35.9).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
console.log('Decimal entry, addition, three-judge averaging and formatting checks passed.');
