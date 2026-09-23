// Repository contract: list(store), get(store,id), put(store,item), remove(store,id), replaceAll(snapshot).
// Future cloud implementation can implement the same methods; services never access IndexedDB.
export const STORES=['decks','deckVersions','events','matches','games','tags'];
const DB='ocg-record', VERSION=1;
export const uid=()=>crypto.randomUUID();
export const stamp=()=>new Date().toISOString();
export class IndexedDBRepository{
  constructor(){this.ready=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of STORES)if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async action(store,mode,fn){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),r=fn(tx.objectStore(store));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  list(s){return this.action(s,'readonly',o=>o.getAll());}
  get(s,id){return this.action(s,'readonly',o=>o.get(id));}
  put(s,item){return this.action(s,'readwrite',o=>o.put(item));}
  remove(s,id){return this.action(s,'readwrite',o=>o.delete(id));}
  async saveBattleGraph(match,games,newTags){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(['matches','games','tags'],'readwrite'),ms=tx.objectStore('matches'),gs=tx.objectStore('games'),ts=tx.objectStore('tags');const read=gs.getAll();read.onsuccess=()=>{for(const old of read.result)if(old.matchId===match.id)gs.delete(old.id);for(const game of games)gs.put(game);ms.put(match);for(const tag of newTags)ts.put(tag);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async deleteBattleGraph(id){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(['matches','games'],'readwrite'),ms=tx.objectStore('matches'),gs=tx.objectStore('games'),read=gs.getAll();read.onsuccess=()=>{for(const g of read.result)if(g.matchId===id)gs.delete(g.id);ms.delete(id);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async snapshot(){const out={};for(const s of STORES)out[s]=await this.list(s);return out;}
  async replaceAll(data){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const s of STORES){tx.objectStore(s).clear();for(const item of data[s])tx.objectStore(s).put(item);}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async merge(data){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const s of STORES)for(const item of data[s])tx.objectStore(s).put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
}
export class SettingsRepository{get(){try{return JSON.parse(localStorage.getItem('ocg-settings'))||{theme:'system'};}catch{return {theme:'system'};}}save(v){localStorage.setItem('ocg-settings',JSON.stringify(v));}}
