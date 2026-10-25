import { averageScores, sumScores } from './score-math.js';

export function rankContestants(contestants, scores = {}) {
  return contestants.map((artist) => {
    const judgeScores = ['judge1', 'judge2', 'judge3'].map((judge) =>
      scores[`${artist.id}_${judge}`] || { total: 0, submitted: false });
    const complete = judgeScores.filter((score) => score.submitted).length;
    const roundScore = averageScores(judgeScores.map((score) => score.total));
    const overall = sumScores([Number(artist.previousScore) || 0, roundScore]);
    return { ...artist, result: { judgeScores, complete, roundScore, overall } };
  }).sort((a, b) => b.result.overall - a.result.overall || b.result.roundScore - a.result.roundScore || a.order - b.order);
}

export function overlayContestant(contestants, scores, rank) {
  const artist = rankContestants(contestants, scores)[rank - 1];
  return artist && (artist.result.complete > 0 || Number(artist.previousScore) > 0) ? artist : null;
}
