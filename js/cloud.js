import {STORES,stamp} from './storage.js';

// Only the public project URL and publishable key belong in the browser.
const CONFIG_KEY='ocg-cloud-config';
export const cloudConfig=()=>{try{return JSON.parse(localStorage.getItem(CONFIG_KEY))||null;}catch{return null;}};
export function saveCloudConfig(input){
 const url=String(input.url||'').trim().replace(/\/$/,'');
 const key=String(input.key||'').trim();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw Error('SupabaseのプロジェクトURLを確認してください');
 if(!key||key.startsWith('sb_secret_'))throw Error('publishable key または anon key のみ使用してください');
 if(key.split('.').length===3){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role==='service_role')throw Error('service_role keyは公開できません');}catch(error){if(error.message==='service_role keyは公開できません')throw error;}}
 localStorage.setItem(CONFIG_KEY,JSON.stringify({url,key}));return {url,key};
}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const fingerprint=value=>value===null?'@deleted':JSON.stringify(canonical(value));
export const emptySnapshot=()=>Object.fromEntries(STORES.map(s=>[s,[]]));
export function reconcile(local,remote,baseline={},userId,now=stamp()){
 const merged=emptySnapshot(),push=[],next={},conflicts=[];
 for(const store of STORES){
  const localMap=new Map((local[store]||[]).map(item=>[item.id,item]));
  const remoteMap=new Map(remote.filter(row=>row.store===store).map(row=>[row.id,row]));
  const old=baseline[store]||{},hashes={};
  for(const id of new Set([...localMap.keys(),...remoteMap.keys(),...Object.keys(old)])){
   const left=localMap.get(id)||null,row=remoteMap.get(id),right=row?.deleted_at?null:row?.body||null;
   const l=fingerprint(left),r=fingerprint(right),base=old[id];
   // On first connection both sides are treated as new. After that, absences are deletions.
   const lc=base===undefined?left!==null:l!==base,rc=base===undefined?!!row:r!==base;
   let winner;
   if(lc&&!rc)winner='local';else if(rc&&!lc)winner='remote';
   else if(!lc&&!rc)winner=row?'remote':'local';
   else{const lt=left?.updatedAt||(!left?now:''),rt=row?.updated_at||'';winner=lt>rt?'local':'remote';if(l!==r)conflicts.push({store,id,winner});}
   const chosen=winner==='local'?left:right;
   if(chosen){const item={...chosen,userId};merged[store].push(item);hashes[id]=fingerprint(item);}else hashes[id]='@deleted';
   if(winner==='local'&&(l!==r||!row)){
    const when=chosen?.updatedAt||now;
    push.push({user_id:userId,store,id,body:chosen?{...chosen,userId}:null,updated_at:when,deleted_at:chosen?null:now});
   }
  }
  next[store]=hashes;
 }
 return {merged,push,baseline:next,conflicts};
}

export class SupabaseCloudRepository{
 constructor(client,userId){this.client=client;this.userId=userId;}
 async snapshotRows(){const out=[];for(let from=0;;from+=500){const {data,error}=await this.client.from('ocg_records').select('store,id,body,updated_at,deleted_at').eq('user_id',this.userId).order('store',{ascending:true}).order('id',{ascending:true}).range(from,from+499);if(error)throw error;out.push(...data);if(data.length<500)return out;}}
 async upsertRows(rows){for(let i=0;i<rows.length;i+=100){const {error}=await this.client.from('ocg_records').upsert(rows.slice(i,i+100),{onConflict:'user_id,store,id'});if(error)throw error;}}
}
let library;
async function loadClientLibrary(){
 if(window.supabase?.createClient)return window.supabase;
 if(!library)library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';script.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(Error('認証ライブラリを読み込めません'));script.onerror=()=>reject(Error('認証ライブラリの取得に失敗しました。通信を確認してください'));document.head.append(script);}).catch(error=>{library=null;throw error;});
 return library;
}
export class CloudController{
 constructor(repo){this.repo=repo;this.client=null;this.user=null;this.busy=false;this.lastSync=null;this.listener=()=>{};}
 onChange(fn){this.listener=fn;}
 async connect(){const config=cloudConfig();if(!config)return;const sdk=await loadClientLibrary();this.client=sdk.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:`ocg-auth-${new URL(config.url).hostname}`}});
  this.lastSync=(await this.repo.getSyncMeta())?.lastSync||null;
  this.client.auth.onAuthStateChange((_event,session)=>{this.user=session?.user||null;this.listener();});
  const {data:sessionData,error:sessionError}=await this.client.auth.getSession();if(sessionError)throw sessionError;
  if(sessionData.session){const {data,error}=await this.client.auth.getUser();if(error)throw error;this.user=data.user||null;}else this.user=null;this.listener();
 }
 async sendLink(email){if(!this.client)throw Error('クラウド接続を設定してください');const {error}=await this.client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;}
 async signOut(){if(!this.client)return;const {error}=await this.client.auth.signOut({scope:'local'});if(error)throw error;this.user=null;this.listener();}
 async sync(){if(!this.user)throw Error('先にログインしてください');if(this.busy)throw Error('同期中です');this.busy=true;this.listener();try{
  const userId=this.user.id,meta=await this.repo.getSyncMeta();if(meta?.ownerId&&meta.ownerId!==userId)throw Error('この端末のデータは別のアカウントに紐付いています。元のアカウントでログインしてください');
  const remoteRepo=new SupabaseCloudRepository(this.client,userId);
  const [local,remote]=await Promise.all([this.repo.snapshot(),remoteRepo.snapshotRows()]);
  const plan=reconcile(local,remote,meta?.baseline||{},userId);
  await remoteRepo.upsertRows(plan.push);
  const committed=await this.repo.replaceAllIfUnchanged(local,plan.merged);
  if(!committed)throw Error('同期中に端末の記録が更新されました。もう一度同期してください');
  this.lastSync=stamp();await this.repo.putSyncMeta({ownerId:userId,baseline:plan.baseline,lastSync:this.lastSync});
  return {uploaded:plan.push.length,conflicts:plan.conflicts.length};
 }finally{this.busy=false;this.listener();}}
}
