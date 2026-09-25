import assert from 'node:assert/strict';
import {AppService} from '../js/services.js';
import {STORES} from '../js/storage.js';

class MemoryRepo{
 constructor(){this.data=Object.fromEntries(STORES.map(store=>[store,[]]));this.batchCalls=0;}
 async list(store){return structuredClone(this.data[store]);}
 async get(store,id){return structuredClone(this.data[store].find(row=>row.id===id));}
 async saveBattleBatch(plans){
  this.batchCalls++;
  const next=structuredClone(this.data);
  for(const {match,gameRows,newTags,newDeck} of plans){
   if(newDeck)next.decks.push(newDeck);
   next.matches.push(match);next.games.push(...gameRows);next.tags.push(...newTags);
  }
  this.data=next;
 }
}
const repo=new MemoryRepo(),service=new AppService(repo);
const base={date:'2026-09-25',format:'MATCH',deckName:'烙印',deckId:'',deckVersionId:'',eventId:'',override:'',tags:'大会, 練習',notes:'',games:[{turn:'FIRST',result:'WIN'},{turn:'SECOND',result:'LOSS'}]};
const first={...base,opponent:'エルフェンノーツ'};
const second={...base,opponent:'エルフェンノーツ',games:[{turn:'SECOND',result:'LOSS'}],override:'DOUBLE_LOSS'};
await assert.rejects(service.saveBattles([first,{...second,opponent:''}]),/2件目：相手デッキ/);
assert.equal(repo.batchCalls,0);
assert.equal(repo.data.matches.length,0);
const saved=await service.saveBattles([first,second]);
assert.equal(repo.batchCalls,1);
assert.equal(saved.length,2);
assert.equal(repo.data.matches.length,2);
assert.equal(repo.data.decks.length,1,'同じ新規デッキは一つだけ作成');
assert.equal(saved[0].deckId,saved[1].deckId);
assert.equal(saved[0].opponentDeckName,saved[1].opponentDeckName);
assert.equal(saved[0].playedAt,saved[1].playedAt);
assert.deepEqual(saved[0].tags,saved[1].tags);
assert.equal(repo.data.games.length,3);
assert.deepEqual(repo.data.tags.map(t=>t.name).sort(),['大会','練習']);
assert.equal(saved[0].result,'DRAW');
assert.equal(saved[1].result,'DOUBLE_LOSS');
assert.equal(saved[0].resultSource,'auto');
assert.equal(saved[1].resultSource,'manual');
console.log('PASS: batch records validate before writing and save shared decks, games and tags together');
