import assert from 'node:assert/strict';
import {sortBattles,BATTLE_SORT_OPTIONS} from '../js/battleSort.js';

const matches=[
 {id:'a',playedAt:'2026-09-24',createdAt:'2026-09-24T10:00:00',result:'LOSS',opponentDeckName:'烙印'},
 {id:'b',playedAt:'2026-09-25',createdAt:'2026-09-25T09:00:00',result:'WIN',opponentDeckName:'光と闇'},
 {id:'c',playedAt:'2026-09-25',createdAt:'2026-09-25T11:00:00',result:'LOSS',opponentDeckName:'エルフェン'},
 {id:'d',playedAt:'2026-09-23',createdAt:'2026-09-23T09:00:00',result:'WIN',opponentDeckName:'烙印'}
];
const ids=order=>sortBattles(matches,order).map(m=>m.id).join(',');
assert.equal(ids(),'c,b,a,d');
assert.equal(ids('oldest'),'d,a,b,c');
assert.equal(ids('wins'),'b,d,c,a');
assert.equal(ids('losses'),'c,a,b,d');
assert.equal(ids('opponent'),'c,b,a,d');
assert.deepEqual(sortBattles([{id:'draw',playedAt:'2026-09-26',result:'DRAW'},{id:'both',playedAt:'2026-09-23',result:'DOUBLE_LOSS'}],'losses').map(m=>m.id),['both','draw']);
assert.deepEqual(matches.map(m=>m.id),['a','b','c','d'],'元の戦績を変更しない');
assert.deepEqual(BATTLE_SORT_OPTIONS.map(([key])=>key),['newest','oldest','wins','losses','opponent']);
console.log('PASS: battle list defaults, date ties, outcome priorities, opponent sorting and immutability');
