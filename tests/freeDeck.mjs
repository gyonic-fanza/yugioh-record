import assert from 'node:assert/strict';
import {AppService,validateBackup} from '../js/services.js';
import {matchingDecks,sortedDecks,versionsForDeck} from '../js/deckSelection.js';
import {STORES} from '../js/storage.js';
class MemoryRepo{
 constructor(){this.rows=Object.fromEntries(STORES.map(s=>[s,new Map()]));}
 async get(s,id){return this.rows[s].get(id);}
 async list(s){return [...this.rows[s].values()];}
 async put(s,x){this.rows[s].set(x.id,structuredClone(x));}
 async snapshot(){return Object.fromEntries(STORES.map(s=>[s,[...this.rows[s].values()]]));}
 async saveBattleGraph(match,games,tags,newDeck){if(newDeck)await this.put('decks',newDeck);await this.put('matches',match);for(const g of games)await this.put('games',g);for(const t of tags)await this.put('tags',t);}
}
const repo=new MemoryRepo(),app=new AppService(repo);
const battle={date:'2026-09-24',deckName:'新規デッキ',opponent:'エルフェンノーツ',format:'SINGLE',games:[{turn:'FIRST',result:'WIN'}]};
const first=await app.saveBattle(battle);
assert.equal(first.deckVersionId,null);assert.equal((await repo.list('decks')).length,1);assert.equal((await repo.list('deckVersions')).length,0);
assert.equal((await repo.get('decks',first.deckId)).name,'新規デッキ');
assert.equal(validateBackup(await app.exportBackup()).matches[0].deckVersionId,null);
await assert.rejects(app.saveBattle({...battle,deckName:'',deckId:''}),/使用デッキ/);
const version=await app.addVersion(first.deckId,{version:'v2',main:'1《烙印融合》'});
await assert.rejects(app.saveBattle({...battle,deckId:first.deckId}),/バージョン/);
const second=await app.saveBattle({...battle,deckId:first.deckId,deckVersionId:version.id});
const edited=await app.saveBattle({...battle,deckId:first.deckId,deckVersionId:''},first.id);
assert.equal(edited.deckVersionId,null);
assert.equal(second.deckId,first.deckId);assert.equal(second.deckVersionId,version.id);assert.equal((await repo.get('matches',first.id)).deckVersionId,null);
assert.equal(matchingDecks(await repo.list('decks'),' 新規デッキ ').length,1);
assert.equal(versionsForDeck(await repo.list('deckVersions'),first.deckId)[0].id,version.id);
await app.addDeck({name:'別のデッキ',version:'v1',main:'1《灰流うらら》'});
assert.deepEqual(sortedDecks(await repo.list('decks')).map(d=>d.name),['新規デッキ','別のデッキ'].sort((a,b)=>a.localeCompare(b,'ja')));
console.log('PASS: free-text deck registration, recipe activation, historic version immutability');
