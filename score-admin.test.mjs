import assert from 'node:assert/strict';
import { makeScoreCorrection, matchesSavedScore, resetEventScores } from './score-admin.js';
import { rankContestants, overlayContestant } from './standings.js';

const correction = makeScoreCorrection('a','judge2',['8.75','9.25','8.55','9.35'],10);
assert.equal(correction.total,35.9);
for (const values of [['',1,1,1],[10.01,1,1,1],[-1,1,1,1],[8.755,1,1,1],[Infinity,1,1,1]]) assert.throws(()=>makeScoreCorrection('a','judge1',values,10));
assert.throws(()=>makeScoreCorrection('a','judge4',[1,1,1,1],10));
assert.equal(matchesSavedScore(null,null),true);
assert.equal(matchesSavedScore(correction,null),false);
assert.equal(matchesSavedScore({...correction,updatedAt:2},{...correction,updatedAt:1}),false);
assert.equal(matchesSavedScore({...correction,values:[0,0,0,0]},correction),false);
assert.equal(matchesSavedScore(structuredClone(correction),correction),true);
const event = {contestants:{a:{id:'a',name:'Artist A',stageName:'A',order:1,previousScore:20.25},b:{id:'b',name:'Artist B',stageName:'B',order:2,previousScore:19.50}},scores:{a_judge2:correction},config:{criteria:['A','B','C','D'],maxScore:10},other:'keep'};
const before = structuredClone(event);
const reset = resetEventScores(event,'reset-1',123);
assert.deepEqual(event,before); // never mutate the transaction input
assert.equal(Object.keys(reset.scores).length,6);
assert.equal(reset.contestants.a.previousScore,0);
assert.equal(reset.contestants.a.name,event.contestants.a.name);
assert.deepEqual(reset.config,event.config);
assert.equal(reset.other,'keep');
assert.deepEqual(reset.lastResetBackup.scores,event.scores);
assert.equal(reset.lastResetBackup.previousScores.a,20.25);
assert.equal(reset.lastResetBackup.previousScores.b,19.5);
for (const score of Object.values(reset.scores)) { assert.deepEqual(score.values,[0,0,0,0]); assert.equal(score.total,0); assert.equal(score.submitted,false); }
assert.ok(rankContestants(Object.values(reset.contestants),reset.scores).every(a=>a.result.overall===0));
assert.equal(overlayContestant(Object.values(reset.contestants),reset.scores,1),null);
assert.equal(resetEventScores(null,'id',123),undefined);
assert.equal(resetEventScores({config:{}},'id',123),undefined);
console.log('Correction validation, concurrent-edit protection, atomic reset payload, backup and zero rankings passed.');
