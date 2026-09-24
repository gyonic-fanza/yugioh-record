import {uid,stamp,STORES} from './storage.js';
import {planBattlesCsv} from './csvImport.js';
import {planCalculatorImport} from './calculatorImport.js';
import {allPeriods,regulationLabel} from './defaultPeriods.js';
import {typeId} from './cardTypes.js';
import {matchingDecks,normalizedDeckName} from './deckSelection.js';
export const today=()=>{const d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,10);};
export const clean=s=>String(s??'').trim();
export function resultOf(games){let w=0,l=0;for(const g of games){if(g.result==='WIN')w++;if(g.result==='LOSS')l++;}return w>l?'WIN':l>w?'LOSS':'DRAW';}
export function parseCards(value,defaultType='UNKNOWN'){const lines=String(value||'').split(/\r?\n/),out=[];let type=defaultType;for(const line of lines){const s=line.trim();if(!s)continue;const header=s.match(/^【([^】]+)】$/);if(header){type=typeId(header[1]);if(!type)throw Error('カード種別を確認してください');continue;}const notation=s.match(/^([0-9０-９]+)《([^《》]+)》$/);const m=notation?null:s.match(/^(.*?)\s*(?:[×xX＊*]\s*(\d+))?$/);const name=clean(notation?.[2]||m?.[1]),count=Number((notation?.[1]||m?.[2]||'1').replace(/[０-９]/g,c=>String(c.charCodeAt(0)-65296)));if(!name||!Number.isInteger(count)||count<1||count>99)throw Error('カード名と枚数を確認してください');const existing=out.find(x=>x.name===name);if(existing){if(existing.type!==type&&existing.type!=='UNKNOWN'&&type!=='UNKNOWN')throw Error('同じカードの種別が一致していません');if(existing.type==='UNKNOWN')existing.type=type;existing.count+=count;}else out.push({id:uid(),cardId:null,name,count,type});}return out;}
export function validateBackup(data){if(!data||typeof data!=='object'||![1,2].includes(data.schemaVersion))throw Error('対応していないバックアップ形式です');const normalized={...data,periods:data.schemaVersion===1?[]:data.periods};for(const s of STORES){if(!Array.isArray(normalized[s])||normalized[s].some(x=>!x||typeof x.id!=='string'||!x.id))throw Error(`${s} のデータが不正です`);}const ids={};for(const s of STORES){ids[s]=new Set(normalized[s].map(x=>x.id));if(ids[s].size!==normalized[s].length)throw Error(`${s} のIDが重複しています`);}for(const m of normalized.matches){if(m.deckId&&!ids.decks.has(m.deckId))throw Error('存在しないデッキを参照する対戦があります');if(m.deckVersionId&&!ids.deckVersions.has(m.deckVersionId))throw Error('存在しないレシピ版を参照する対戦があります');if(m.eventId&&!ids.events.has(m.eventId))throw Error('存在しないイベントを参照する対戦があります');}for(const g of normalized.games)if(!ids.matches.has(g.matchId))throw Error('孤立したゲームがあります');for(const v of normalized.deckVersions)if(!ids.decks.has(v.deckId))throw Error('孤立したレシピ版があります');for(const p of normalized.periods)if(!p.label||!p.startDate||!p.endDate||p.startDate>p.endDate)throw Error('期間のデータが不正です');return normalized;}
export class AppService{
 constructor(repo){this.repo=repo;}
 async all(){return this.repo.snapshot();}
 async checkRegulation(id){if(id&&!allPeriods(await this.repo.list('periods')).some(p=>p.id===id))throw Error('レギュレーションを選び直してください');return id||null;}
 async addDeck({name,version,main,extra,side,regulationId}){name=clean(name);if(!name)throw Error('デッキ名を入力してください');const selected=await this.checkRegulation(regulationId);const now=stamp(),deck={id:uid(),userId:null,name,regulationId:selected,createdAt:now,updatedAt:now};const v=this.version(deck.id,{version,main,extra,side});await this.repo.put('decks',deck);await this.repo.put('deckVersions',v);return deck;}
 version(deckId,{version,main,extra,side}){const now=stamp();return {id:uid(),userId:null,deckId,label:clean(version)||today(),cards:{main:parseCards(main),extra:parseCards(extra,'MONSTER'),side:parseCards(side)},createdAt:now,updatedAt:now};}
 async addVersion(deckId,fields){const deck=await this.repo.get('decks',deckId);if(!deck)throw Error('デッキが見つかりません');const v=this.version(deckId,fields);await this.repo.put('deckVersions',v);deck.updatedAt=stamp();await this.repo.put('decks',deck);return v;}
 async addEvent(fields){const name=clean(fields.name);if(!name)throw Error('イベント名を入力してください');const selected=await this.checkRegulation(fields.regulationId);const now=stamp();const event={id:uid(),userId:null,name,date:fields.date||today(),venue:clean(fields.venue),regulationId:selected,deckId:fields.deckId||null,rank:clean(fields.rank),participants:fields.participants?Number(fields.participants):null,notes:clean(fields.notes),createdAt:now,updatedAt:now};await this.repo.put('events',event);return event;}
 async updateEvent(id,fields){const old=await this.repo.get('events',id);if(!old)throw Error('イベントが見つかりません');const name=clean(fields.name);if(!name)throw Error('イベント名を入力してください');const regulationId=await this.checkRegulation(fields.regulationId);if(fields.deckId&&!await this.repo.get('decks',fields.deckId))throw Error('使用デッキが見つかりません');const updated={...old,name,date:fields.date||old.date,venue:clean(fields.venue),regulationId,deckId:fields.deckId||null,rank:clean(fields.rank),participants:fields.participants?Number(fields.participants):null,notes:clean(fields.notes),updatedAt:stamp()};await this.repo.put('events',updated);return updated;}
 async saveBattle(input,id=null){
  const name=clean(input.deckName),opponent=clean(input.opponent);
  if(!name&&!input.deckId)throw Error('使用デッキを入力してください');
  if(!opponent)throw Error('相手デッキを入力してください');
  if(!['MATCH','SINGLE'].includes(input.format))throw Error('対戦形式が不正です');
  const event=input.eventId?await this.repo.get('events',input.eventId):null;
  if(input.eventId&&!event)throw Error('イベントが見つかりません');
  const decks=await this.repo.list('decks');
  let deck=input.deckId?decks.find(d=>d.id===input.deckId):null;
  if(input.deckId&&!deck)throw Error('使用デッキを選び直してください');
  if(deck&&name&&normalizedDeckName(deck.name)!==normalizedDeckName(name))throw Error('使用デッキを選び直してください');
  if(!deck){const found=matchingDecks(decks,name);if(found.length>1)throw Error('同名のデッキが複数あります。候補から選択してください');deck=found[0]||null;}
  const now=stamp(),newDeck=!deck?{id:uid(),userId:null,name,regulationId:event?.regulationId||null,createdAt:now,updatedAt:now}:null;
  deck=deck||newDeck;
  const old=id?await this.repo.get('matches',id):null;
  if(id&&!old)throw Error('対象の対戦が見つかりません');
  const versions=(await this.repo.list('deckVersions')).filter(v=>v.deckId===deck.id);
  const version=versions.find(v=>v.id===input.deckVersionId)||null;
  if(versions.length&&!version&&!(old?.deckId===deck.id&&!old.deckVersionId&&!input.deckVersionId))throw Error('デッキバージョンを選んでください');
  if(!versions.length&&input.deckVersionId)throw Error('デッキバージョンを選び直してください');
  const games=input.games.filter(g=>g.result);
  if(!games.length||games.length>(input.format==='SINGLE'?1:3))throw Error('ゲーム結果を入力してください');
  if(games.some(g=>!['FIRST','SECOND'].includes(g.turn)||!['WIN','LOSS','DRAW'].includes(g.result)))throw Error('先後と勝敗を確認してください');
  const result=input.override||resultOf(games);
  if(!['WIN','LOSS','DRAW','DOUBLE_LOSS'].includes(result))throw Error('対戦結果が不正です');
  const tags=[...new Set(String(input.tags||'').split(/[,、\n]/).map(clean).filter(Boolean))];
  const match={id:id||uid(),userId:null,eventId:input.eventId||null,deckId:deck.id,deckVersionId:version?.id||null,opponentDeckName:opponent,opponentDeckId:null,format:input.format,playedAt:input.date||today(),result,resultSource:input.override?'manual':'auto',notes:clean(input.notes),tags,createdAt:old?.createdAt||now,updatedAt:now};
  let number=0;const gameRows=games.map(g=>({id:uid(),userId:null,matchId:match.id,number:++number,turn:g.turn,result:g.result,createdAt:now,updatedAt:now}));
  const existing=await this.repo.list('tags');
  const newTags=tags.filter(tag=>!existing.some(t=>t.name===tag)).map(tag=>({id:uid(),userId:null,name:tag,createdAt:now,updatedAt:now}));
  await this.repo.saveBattleGraph(match,gameRows,newTags,newDeck);
  return match;
 }
 async importBattlesCsv(csv){const old=await this.repo.snapshot(),plan=planBattlesCsv(csv,old);
  if(!plan.summary.imported)return plan.summary;
  if(!await this.repo.replaceAllIfUnchanged(old,plan.data))throw Error('取込中に記録が更新されました。CSVを再選択してください');
  return plan.summary;
 }
 async importCalculatorCsv(csv,inputs){const old=await this.repo.snapshot(),plan=planCalculatorImport(csv,inputs,old);
  if(!plan.summary.imported)return plan.summary;
  if(!await this.repo.replaceAllIfUnchanged(old,plan.data))throw Error('取込中に記録が更新されました。CSVを再選択してください');
  return plan.summary;
 }
 async deleteBattle(id){await this.repo.deleteBattleGraph(id);}
 async addPeriod(fields){const startDate=fields.startDate,endDate=fields.endDate;if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||startDate>endDate)throw Error('開始日・終了日を確認してください');const label=regulationLabel(startDate),now=stamp(),period={id:uid(),userId:null,label,startDate,endDate,createdAt:now,updatedAt:now};await this.repo.put('periods',period);return period;}
 async deletePeriod(id){if((await this.repo.list('decks')).some(d=>d.regulationId===id)||(await this.repo.list('events')).some(e=>e.regulationId===id))throw Error('デッキまたはイベントで使用中のレギュレーションは削除できません');await this.repo.remove('periods',id);}
 async deleteAllData(settings){await this.repo.clearAll();settings.clear();}
 async exportBackup(){return {schemaVersion:2,exportedAt:stamp(),...await this.repo.snapshot()};}
 async importBackup(data,mode){const normalized=validateBackup(data);if(mode==='replace')await this.repo.replaceAll(normalized);else if(mode==='merge')await this.repo.merge(normalized);else throw Error('復元方法が不正です');}
}
export const pct=(w,n)=>n?`${(w/n*100).toFixed(1).replace(/\.0$/,'')}%`:'—';
export function stats(matches,games){const tally=xs=>({total:xs.length,win:xs.filter(x=>x.result==='WIN').length,loss:xs.filter(x=>['LOSS','DOUBLE_LOSS'].includes(x.result)).length,draw:xs.filter(x=>x.result==='DRAW').length});const m=tally(matches),g=tally(games);return {matches:{...m,rate:pct(m.win,m.total)},games:{...g,rate:pct(g.win,g.total)}};}
