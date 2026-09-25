// Repository contract: list(store), get(store,id), put(store,item), remove(store,id), replaceAll(snapshot).
// Future cloud implementation can implement the same methods; services never access IndexedDB.
export const STORES=['decks','deckVersions','events','matches','games','tags','periods'];
const DB='ocg-record', VERSION=3;
export const uid=()=>crypto.randomUUID();
export const stamp=()=>new Date().toISOString();
export class IndexedDBRepository{
  constructor(){this.db=null;this.ready=this.open();}
  open(){return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,VERSION);
    req.onupgradeneeded=()=>{const db=req.result;for(const name of [...STORES,'syncMeta'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:'id'});};
    req.onsuccess=()=>{const db=req.result;this.db=db;
      db.onversionchange=()=>{db.close();this.invalidate(db);};
      db.onclose=()=>this.invalidate(db);
      resolve(db);
    };
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('別のタブで旧版が開かれています。すべてのタブを閉じてから再読み込みしてください。'));
  });}
  invalidate(db){if(this.db===db){this.db=null;this.ready=null;}}
  static isClosed(error){return error?.name==='InvalidStateError'||/database connection is closing|database connection is closed|database has been closed/i.test(error?.message||'');}
  async withConnection(work){
    for(let attempt=0;attempt<2;attempt++){
      const pending=this.ready||(this.ready=this.open()),db=await pending;
      try{return await work(db);}catch(error){
        if(attempt||!IndexedDBRepository.isClosed(error))throw error;
        try{db.close();}catch{}
        this.invalidate(db);
        if(this.ready===pending)this.ready=null;
      }
    }
  }
  action(store,mode,fn){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode),request=fn(tx.objectStore(store));let result;
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||request.error);
    tx.onabort=()=>reject(tx.error||Error('保存が中断されました'));
  }));}
  getSyncMeta(){return this.get('syncMeta','cloud');}
  putSyncMeta(meta){return this.put('syncMeta',{...meta,id:'cloud'});}
  list(s){return this.action(s,'readonly',o=>o.getAll());}
  get(s,id){return this.action(s,'readonly',o=>o.get(id));}
  put(s,item){return this.action(s,'readwrite',o=>o.put(item));}
  remove(s,id){return this.action(s,'readwrite',o=>o.delete(id));}
  saveBattleGraph(match,games,newTags,newDeck=null){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(['matches','games','tags',...(newDeck?['decks']:[])],'readwrite'),ms=tx.objectStore('matches'),gs=tx.objectStore('games'),ts=tx.objectStore('tags');
    const read=gs.getAll();read.onsuccess=()=>{if(newDeck)tx.objectStore('decks').put(newDeck);for(const old of read.result)if(old.matchId===match.id)gs.delete(old.id);for(const game of games)gs.put(game);ms.put(match);for(const tag of newTags)ts.put(tag);};
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('保存が中断されました'));
  }));}
  saveBattleBatch(plans){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(['matches','games','tags','decks'],'readwrite');
    for(const {match,gameRows,newTags,newDeck} of plans){
      if(newDeck)tx.objectStore('decks').put(newDeck);
      tx.objectStore('matches').put(match);
      for(const game of gameRows)tx.objectStore('games').put(game);
      for(const tag of newTags)tx.objectStore('tags').put(tag);
    }
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('一括保存が中断されました'));
  }));}
  deleteBattleGraph(id){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(['matches','games'],'readwrite'),ms=tx.objectStore('matches'),gs=tx.objectStore('games'),read=gs.getAll();
    read.onsuccess=()=>{for(const g of read.result)if(g.matchId===id)gs.delete(g.id);ms.delete(id);};
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('削除が中断されました'));
  }));}
  deleteVersionGraph(id){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(['deckVersions','decks','matches'],'readwrite'),versions=tx.objectStore('deckVersions'),decks=tx.objectStore('decks'),matches=tx.objectStore('matches');
    const versionRequest=versions.get(id),matchesRequest=matches.getAll(),now=stamp();
    let unlinked=0,missing=false;
    versionRequest.onsuccess=()=>{
      const version=versionRequest.result;
      if(!version){missing=true;tx.abort();return;}
      versions.delete(id);
      const deckRequest=decks.get(version.deckId);
      deckRequest.onsuccess=()=>{if(deckRequest.result)decks.put({...deckRequest.result,updatedAt:now});};
    };
    matchesRequest.onsuccess=()=>{for(const match of matchesRequest.result){if(match.deckVersionId!==id)continue;unlinked++;matches.put({...match,deckVersionId:null,updatedAt:now});}};
    tx.oncomplete=()=>resolve({unlinked});
    tx.onabort=()=>reject(missing?Error('レシピ版が見つかりません'):tx.error||Error('レシピの削除に失敗しました'));
    tx.onerror=()=>{};
  }));}
  async snapshot(){const out={};for(const s of STORES)out[s]=await this.list(s);return out;}
  replaceAllIfUnchanged(expected,data){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORES,'readwrite'),current={},requests=STORES.map(store=>({store,request:tx.objectStore(store).getAll()}));
    let decided=false;
    for(const {store,request} of requests)request.onsuccess=()=>{current[store]=request.result;if(Object.keys(current).length!==STORES.length)return;
      if(STORES.some(name=>JSON.stringify(current[name])!==JSON.stringify(expected[name]))){decided=true;tx.abort();return;}
      for(const name of STORES){tx.objectStore(name).clear();for(const item of data[name])tx.objectStore(name).put(item);}
    };
    tx.oncomplete=()=>resolve(true);tx.onabort=()=>decided?resolve(false):reject(tx.error||Error('同期の保存に失敗しました'));tx.onerror=()=>{};
  }));}
  replaceAll(data){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORES,'readwrite');for(const s of STORES){tx.objectStore(s).clear();for(const item of data[s])tx.objectStore(s).put(item);}
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('復元が中断されました'));
  }));}
  clearLocalAccount(){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction([...STORES,'syncMeta'],'readwrite');for(const s of [...STORES,'syncMeta'])tx.objectStore(s).clear();
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('削除が中断されました'));
  }));}
  clearAll(){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORES,'readwrite');for(const s of STORES)tx.objectStore(s).clear();
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('削除が中断されました'));
  }));}
  merge(data){return this.withConnection(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORES,'readwrite');for(const s of STORES)for(const item of data[s])tx.objectStore(s).put(item);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('復元が中断されました'));
  }));}
}
export class SettingsRepository{get(){try{return JSON.parse(localStorage.getItem('ocg-settings'))||{theme:'system'};}catch{return {theme:'system'};}}save(v){localStorage.setItem('ocg-settings',JSON.stringify(v));}clear(){localStorage.removeItem('ocg-settings');}}
