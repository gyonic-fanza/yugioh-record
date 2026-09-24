import {parseCsv} from './csvImport.js';
import {uid,stamp} from './storage.js';
import {normalizedDeckName} from './deckSelection.js';

// Contract for the calculator's future CSV exporter: one completed GAME per row.
// recordId must be generated once per MATCH / SINGLE and reused on later exports.
export const CALCULATOR_CSV_HEADERS=['recordId','playedAt','format','gameNumber','firstPlayer','winner'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const trim=s=>String(s??'').trim();

export function parseCalculatorCsv(csv){
 const rows=parseCsv(csv);if(!rows.length)throw Error('CSVが空です');
 const headers=rows.shift();
 if(headers.length!==CALCULATOR_CSV_HEADERS.length||new Set(headers).size!==headers.length||!CALCULATOR_CSV_HEADERS.every(h=>headers.includes(h)))throw Error('計算ツールの戦績CSV（recordId, playedAt, format, gameNumber, firstPlayer, winner）を選んでください');
 const records=new Map();
 for(const [index,row] of rows.entries()){
  if(row.length!==headers.length)throw Error(`CSV ${index+2}行目の列数が一致しません`);
  const item=Object.fromEntries(headers.map((key,i)=>[key,row[i]]));
  const fail=s=>{throw Error(`CSV ${index+2}行目：${s}`);};
  if(!UUID.test(item.recordId))fail('対戦IDを確認してください');
  if(!validDate(item.playedAt))fail('対戦日を確認してください');
  if(!['MATCH','SINGLE'].includes(item.format))fail('形式を確認してください');
  const number=Number(item.gameNumber);
  if(!/^[1-3]$/.test(item.gameNumber)||item.format==='SINGLE'&&number!==1)fail('GAME番号を確認してください');
  if(!['p1','p2'].includes(item.firstPlayer)||!['p1','p2','DRAW'].includes(item.winner))fail('先攻・勝者を確認してください');
  let record=records.get(item.recordId);
  if(!record){record={recordId:item.recordId,playedAt:item.playedAt,format:item.format,games:[]};records.set(item.recordId,record);}
  if(record.playedAt!==item.playedAt||record.format!==item.format)fail('同じ対戦IDの日時・形式が一致しません');
  if(record.games.some(g=>g.number===number))fail('GAME番号が重複しています');
  record.games.push({number,firstPlayer:item.firstPlayer,winner:item.winner});
 }
 if(!records.size)throw Error('CSVに戦績がありません');
 for(const record of records.values()){
  record.games.sort((a,b)=>a.number-b.number);
  if(record.games.some((game,i)=>game.number!==i+1))throw Error('GAME番号は1から連番にしてください');
 }
 return [...records.values()];
}

export function planCalculatorImport(csv,inputs,existing){
 const records=parseCalculatorCsv(csv),data=Object.fromEntries(Object.entries(existing).map(([key,items])=>[key,[...items]]));
 const ids=new Set(data.matches.map(m=>m.id)),inputById=new Map(inputs.map(item=>[item.recordId,item]));
 if(inputById.size!==inputs.length||inputs.some(item=>!records.some(r=>r.recordId===item.recordId)))throw Error('入力された対戦IDが不正です');
 let imported=0,skipped=0,createdDecks=0,createdEvents=0;
 for(const record of records){
  if(ids.has(record.recordId)){skipped++;continue;}
  const input=inputById.get(record.recordId);
  if(!input)throw Error('すべての対戦に入力してください');
  const own=trim(input.ownPlayer),deckName=trim(input.deckName),opponent=trim(input.opponentDeck),eventName=trim(input.eventName),venue=trim(input.venue);
  if(!['p1','p2'].includes(own))throw Error('自分がP1かP2か選んでください');
  if(!deckName||!opponent)throw Error('使用デッキと相手デッキを入力してください');
  if(venue&&!eventName)throw Error('会場を入力する場合はイベント内容も入力してください');
  if(input.eventId&&(eventName||venue))throw Error('既存イベントと新規イベントは同時に指定できません');
  if(input.override&&!['WIN','LOSS','DRAW','DOUBLE_LOSS'].includes(input.override))throw Error('対戦結果の修正値が不正です');
  const now=stamp();
  const found=data.decks.filter(deck=>normalizedDeckName(deck.name)===normalizedDeckName(deckName));
  if(found.length>1)throw Error(`「${deckName}」と同名のデッキが複数あります`);
  let deck=found[0];
  if(!deck){deck={id:uid(),userId:null,name:deckName,regulationId:null,createdAt:now,updatedAt:now};data.decks.push(deck);createdDecks++;}
  const version=input.deckVersionId?data.deckVersions.find(v=>v.id===input.deckVersionId&&v.deckId===deck.id):null;
  if(input.deckVersionId&&!version)throw Error(`「${deckName}」のレシピ版を選び直してください`);
  let event=null;
  if(input.eventId){event=data.events.find(e=>e.id===input.eventId);if(!event||event.date!==record.playedAt)throw Error('開催日が一致するイベントを選び直してください');}
  else if(eventName){event=data.events.find(e=>e.date===record.playedAt&&e.name===eventName&&e.venue===venue);
   if(!event){event={id:uid(),userId:null,name:eventName,venue,date:record.playedAt,regulationId:null,deckId:null,rank:'',participants:null,notes:'',createdAt:now,updatedAt:now};data.events.push(event);createdEvents++;}}
  const games=record.games.map(g=>({id:uid(),userId:null,matchId:record.recordId,number:g.number,turn:g.firstPlayer===own?'FIRST':'SECOND',result:g.winner==='DRAW'?'DRAW':g.winner===own?'WIN':'LOSS',createdAt:now,updatedAt:now}));
  const wins=games.filter(g=>g.result==='WIN').length,losses=games.filter(g=>g.result==='LOSS').length;
  const auto=wins>losses?'WIN':losses>wins?'LOSS':'DRAW';
  data.matches.push({id:record.recordId,userId:null,eventId:event?.id||null,deckId:deck.id,deckVersionId:version?.id||null,opponentDeckName:opponent,opponentDeckId:null,format:record.format,playedAt:record.playedAt,result:input.override||auto,resultSource:input.override?'manual':'auto',notes:trim(input.notes),tags:[],createdAt:now,updatedAt:now});
  data.games.push(...games);ids.add(record.recordId);imported++;
 }
 return {data,summary:{imported,skipped,createdDecks,createdEvents}};
}
