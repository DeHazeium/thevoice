import assert from 'node:assert/strict';
import { rankContestants, overlayContestant } from './standings.js';

const artists = [
  { id:'a', order:1, previousScore:10 },
  { id:'b', order:2, previousScore:15 },
  { id:'c', order:3, previousScore:0 },
  { id:'d', order:4, previousScore:0 }
];
const scores = {
  a_judge1:{ total:35.90, submitted:true },
  a_judge2:{ total:36.25, submitted:true },
  a_judge3:{ total:34.80, submitted:true },
  b_judge1:{ total:30, submitted:true },
  b_judge2:{ total:30, submitted:true },
  b_judge3:{ total:30, submitted:true },
  c_judge1:{ total:0, submitted:true }
};
assert.deepEqual(rankContestants(artists,scores).map(a=>a.id), ['a','b','c','d']);
assert.equal(overlayContestant(artists,scores,1).result.overall,45.65);
assert.equal(overlayContestant(artists,scores,2).id,'b');
assert.equal(overlayContestant(artists,scores,3).id,'c'); // a real zero score remains valid
assert.equal(overlayContestant(artists,{},3),null); // never invent an unscored winner
assert.equal(overlayContestant([],{},1),null);
assert.deepEqual(rankContestants(artists.map(a=>({...a,previousScore:0})),{}).map(a=>a.id),['a','b','c','d']);
const changed = {...scores, b_judge1:{total:40,submitted:true}};
assert.equal(overlayContestant(artists,changed,1).id,'b');
assert.equal(overlayContestant(artists,changed,2).id,'a');
console.log('Separate ranks, live reordering, decimal totals, ties and empty overlays passed.');
