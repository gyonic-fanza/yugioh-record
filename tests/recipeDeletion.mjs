import assert from 'node:assert/strict';
import {AppService,validateBackup,stats} from '../js/services.js';
import {STORES} from '../js/storage.js';

class MemoryRepo{
 constructor(){this.rows=Object.fromEntries(STORES.map(s=>[s,new Map()]));this.conflict=false;}
 async get(s,id){return this.rows[s].get(id);}
 async list(s){return [...this.rows[s].values()];}
 async put(s,row){this.rows[s].set(row.id,structuredClone(row));}
 async snapshot(){return Object.fromEntries(STORES.map(s=>[s,[...this.rows[s].values()]]));}
 async deleteVersionGraph(id){
  const version=await this.get('deckVersions',id);
  if(!version)throw Error('レシピ版が見つかりません');
  if(this.conflict)throw Error('レシピの削除に失敗しました');
  this.rows.deckVersions.delete(id);
  const deck=await this.get('decks',version.deckId);
  if(deck)await this.put('decks',{...deck,updatedAt:new Date().toISOString()});
  let unlinked=0;
  for(const match of await this.list('matches'))if(match.deckVersionId===id){unlinked++;await this.put('matches',{...match,deckVersionId:null,updatedAt:new Date().toISOString()});}
  return {unlinked};
 }
 async saveBattleGraph(match,games,tags){
  await this.put('matches',match);
  for(const game of games)await this.put('games',game);
  for(const tag of tags)await this.put('tags',tag);
 }
}

const repo=new MemoryRepo(),app=new AppService(repo);
const deck=await app.addDeck({name:'烙印',version:'初版',main:'1《アルベル》'});
const firstVersion=(await repo.list('deckVersions'))[0];
const secondVersion=await app.addVersion(deck.id,{version:'改訂版',main:'2《アルベル》'});
const battleInput={date:'2026-09-25',deckId:deck.id,format:'SINGLE',opponent:'対戦相手',games:[{turn:'FIRST',result:'WIN'}]};
const firstBattle=await app.saveBattle({...battleInput,deckVersionId:firstVersion.id});
const secondBattle=await app.saveBattle({...battleInput,deckVersionId:secondVersion.id});
await assert.rejects(app.deleteVersion('missing'),/レシピ版が見つかりません/);
repo.conflict=true;
await assert.rejects(app.deleteVersion(firstVersion.id),/レシピの削除に失敗/);
assert.equal((await repo.get('matches',firstBattle.id)).deckVersionId,firstVersion.id);
repo.conflict=false;
assert.deepEqual(await app.deleteVersion(firstVersion.id),{unlinked:1});
assert.equal(await repo.get('deckVersions',firstVersion.id),undefined);
assert.equal((await repo.get('matches',firstBattle.id)).deckVersionId,null);
assert.equal((await repo.get('matches',secondBattle.id)).deckVersionId,secondVersion.id);
assert.equal((await repo.list('games')).length,2);
assert.equal(stats(await repo.list('matches'),await repo.list('games')).matches.total,2);
assert.equal(stats(await repo.list('matches'),await repo.list('games')).games.total,2);
assert.equal((await app.saveBattle({...battleInput,deckVersionId:''},firstBattle.id)).deckVersionId,null);
assert.equal(validateBackup(await app.exportBackup()).matches.length,2);
assert.deepEqual(await app.deleteVersion(secondVersion.id),{unlinked:1});
assert.equal((await repo.list('deckVersions')).length,0);
assert.equal((await repo.list('decks')).length,1);
assert.equal(validateBackup(await app.exportBackup()).matches.length,2);
console.log('PASS: deleting linked recipe versions preserves battles and games without orphaned references');
