import { round, sumScores } from './score-math.js';

export function makeScoreCorrection(artistId, judgeId, values, maxScore) {
  if (!artistId || !['judge1', 'judge2', 'judge3'].includes(judgeId) || values.length !== 4) throw new Error('Choose an artist and judge.');
  const numbers = values.map((value) => {
    const number = Number(value);
    if (String(value).trim() === '' || !Number.isFinite(number) || number < 0 || number > maxScore || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) {
      throw new Error(`Enter all four scores from 0 to ${maxScore}, with up to two decimal places.`);
    }
    return round(number);
  });
  return { artistId, judgeId, values: numbers, total: sumScores(numbers), submitted: true };
}

export function matchesSavedScore(current, expected) {
  if (!current || !expected) return !current && !expected;
  return current.artistId === expected.artistId && current.judgeId === expected.judgeId
    && current.updatedAt === expected.updatedAt && current.total === expected.total
    && current.submitted === expected.submitted
    && [0, 1, 2, 3].every((index) => current.values?.[index] === expected.values?.[index]);
}

export function resetEventScores(event, resetId, timestamp) {
  if (!event?.contestants) return; // Never reset an unloaded or missing event.
  const contestants = Object.fromEntries(Object.entries(event.contestants).map(([id, artist]) => [id, { ...artist, previousScore: 0 }]));
  const scores = {};
  for (const artist of Object.values(contestants)) {
    for (const judgeId of ['judge1', 'judge2', 'judge3']) {
      scores[`${artist.id}_${judgeId}`] = { artistId: artist.id, judgeId, values: [0, 0, 0, 0], total: 0, submitted: false, updatedAt: timestamp };
    }
  }
  return {
    ...event, contestants, scores, resetId,
    lastResetBackup: {
      scores: event.scores || {},
      previousScores: Object.fromEntries(Object.entries(event.contestants).map(([id, artist]) => [id, artist.previousScore || 0])),
      savedAt: timestamp
    }
  };
}
