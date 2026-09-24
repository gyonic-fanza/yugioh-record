// Repository contract: list(store), get(store,id), put(store,item), remove(store,id), replaceAll(snapshot).
// Future cloud implementation can implement the same methods; services never access IndexedDB.
export const STORES=['decks','deckVersions','events','matches','games','tags','periods'];
const DB='ocg-record', VERSION=3;
export const uid=()=>crypto.randomUUID();
export const stamp=()=>new Date().toISOString();
export class IndexedDBRepository{
  constructor(){this.ready=new Promise((resolve,reject)=>{const req=indexedDB.open(DB,VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of [...STORES,'syncMeta'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});};req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('別のタブで旧版が開かれています。すべてのタブを閉じてから再読み込みしてください。'));});}
  async action(store,mode,fn){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),r=fn(tx.objectStore(store));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  getSyncMeta(){return this.get('syncMeta','cloud');}
  putSyncMeta(meta){return this.put('syncMeta',{...meta,id:'cloud'});}
  list(s){return this.action(s,'readonly',o=>o.getAll());}
  get(s,id){return this.action(s,'readonly',o=>o.get(id));}
  put(s,item){return this.action(s,'readwrite',o=>o.put(item));}
  remove(s,id){return this.action(s,'readwrite',o=>o.delete(id));}
  async saveBattleGraph(match,games,newTags,newDeck=null){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(['matches','games','tags',...(newDeck?['decks']:[])],'readwrite'),ms=tx.objectStore('matches'),gs=tx.objectStore('games'),ts=tx.objectStore('tags');const read=gs.getAll();read.onsuccess=()=>{if(newDeck)tx.objectStore('decks').put(newDeck);for(const old of read.result)if(old.matchId===match.id)gs.delete(old.id);for(const game of games)gs.put(game);ms.put(match);for(const tag of newTags)ts.put(tag);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async deleteBattleGraph(id){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(['matches','games'],'readwrite'),ms=tx.objectStore('matches'),gs=tx.objectStore('games'),read=gs.getAll();read.onsuccess=()=>{for(const g of read.result)if(g.matchId===id)gs.delete(g.id);ms.delete(id);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async snapshot(){const out={};for(const s of STORES)out[s]=await this.list(s);return out;}
  async replaceAllIfUnchanged(expected,data){const db=await this.ready;return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORES,'readwrite'),current={},requests=STORES.map(store=>({store,request:tx.objectStore(store).getAll()}));
   let decided=false;
   for(const {store,request} of requests)request.onsuccess=()=>{current[store]=request.result;if(Object.keys(current).length!==STORES.length)return;
    if(STORES.some(name=>JSON.stringify(current[name])!==JSON.stringify(expected[name]))){decided=true;tx.abort();return;}
    for(const name of STORES){tx.objectStore(name).clear();for(const item of data[name])tx.objectStore(name).put(item);}
   };
   tx.oncomplete=()=>resolve(true);tx.onabort=()=>decided?resolve(false):reject(tx.error||Error('同期の保存に失敗しました'));tx.onerror=()=>{};
  });}
  async replaceAll(data){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const s of STORES){tx.objectStore(s).clear();for(const item of data[s])tx.objectStore(s).put(item);}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async clearLocalAccount(){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction([...STORES,'syncMeta'],'readwrite');for(const s of [...STORES,'syncMeta'])tx.objectStore(s).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async clearAll(){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const s of STORES)tx.objectStore(s).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async merge(data){const db=await this.ready;return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const s of STORES)for(const item of data[s])tx.objectStore(s).put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
}
export class SettingsRepository{get(){try{return JSON.parse(localStorage.getItem('ocg-settings'))||{theme:'system'};}catch{return {theme:'system'};}}save(v){localStorage.setItem('ocg-settings',JSON.stringify(v));}clear(){localStorage.removeItem('ocg-settings');}}
