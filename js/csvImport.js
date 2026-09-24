import {uid,stamp} from './storage.js';
import {normalizedDeckName} from './deckSelection.js';

export const BATTLE_CSV_HEADERS=['matchId','gameId','playedAt','event','venue','format','deck','deckVersion','opponentDeck','matchResult','resultSource','gameNumber','turn','gameResult','tags','notes'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const fromCell=s=>/^'\s*[=+\-@]/.test(s)?s.slice(1):s;

export function parseCsv(text){
 const source=String(text||'').replace(/^\ufeff/,'');if(source.length>5*1024*1024)throw Error('CSVは5MB以下にしてください');
 const rows=[];let row=[],field='',quoted=false,closed=false,ended=false;
 const pushField=()=>{row.push(field);field='';closed=false;};
 const pushRow=()=>{pushField();if(row.some(x=>x!==''))rows.push(row);row=[];if(rows.length>10001)throw Error('CSVの行数が上限を超えています');};
 for(let i=0;i<source.length;i++){const c=source[i];ended=false;
  if(quoted){if(c==='"'){if(source[i+1]==='"'){field+='"';i++;}else {quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('CSVの引用符の位置が不正です');quoted=true;}
  else if(c===',')pushField();
  else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;pushRow();ended=true;}
  else {if(closed)throw Error('CSVの引用符の後に余分な文字があります');field+=c;}
 }
 if(quoted)throw Error('CSVの引用符が閉じられていません');
 if(!ended&&(field||row.length))pushRow();
 return rows;
}

export function parseBattlesCsv(text){
 const rows=parseCsv(text);if(!rows.length)throw Error('CSVが空です');
 const headers=rows.shift();if(new Set(headers).size!==headers.length||!BATTLE_CSV_HEADERS.every(h=>headers.includes(h)))throw Error('このアプリから出力した戦績CSVを選んでください');
 const byId=new Map(),gameIds=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];if(row.length!==headers.length)throw Error(`CSV ${i+2}行目の列数が一致しません`);
  const raw=Object.fromEntries(headers.map((h,j)=>[h,fromCell(row[j])]));
  const fail=message=>{throw Error(`CSV ${i+2}行目：${message}`);};
  if(!UUID.test(raw.matchId)||!UUID.test(raw.gameId))fail('対戦IDまたはゲームIDが不正です');
  if(gameIds.has(raw.gameId))fail('ゲームIDが重複しています');gameIds.add(raw.gameId);
  if(!dateValid(raw.playedAt))fail('対戦日が不正です');
  if(!['MATCH','SINGLE'].includes(raw.format))fail('形式を確認してください');
  if(!raw.deck.trim()||!raw.opponentDeck.trim())fail('デッキ名を確認してください');
  if(raw.venue&&!raw.event)fail('イベント名のない店舗があります');
  if(!['WIN','LOSS','DRAW','DOUBLE_LOSS'].includes(raw.matchResult))fail('対戦結果を確認してください');
  if(raw.resultSource&&!['auto','manual'].includes(raw.resultSource))fail('結果の判定方法を確認してください');
  if(!['FIRST','SECOND'].includes(raw.turn)||!['WIN','LOSS','DRAW'].includes(raw.gameResult))fail('GAMEの先後と結果を確認してください');
  const number=Number(raw.gameNumber);if(!Number.isInteger(number)||number<1||number>3)fail('GAME番号を確認してください');
  const meta=Object.fromEntries(BATTLE_CSV_HEADERS.filter(h=>!['gameId','gameNumber','turn','gameResult'].includes(h)).map(h=>[h,raw[h]]));
  let battle=byId.get(raw.matchId);
  if(!battle){battle={meta,games:[]};byId.set(raw.matchId,battle);}
  else if(JSON.stringify(battle.meta)!==JSON.stringify(meta))fail('同じ対戦IDの情報が一致しません');
  if(battle.games.some(g=>g.number===number))fail('同じ対戦のGAME番号が重複しています');
  battle.games.push({id:raw.gameId,number,turn:raw.turn,result:raw.gameResult});
 }
 if(!byId.size)throw Error('CSVに対戦データがありません');
 for(const battle of byId.values()){
  if(battle.games.length>(battle.meta.format==='SINGLE'?1:3))throw Error('対戦形式とGAME数が一致しません');
  battle.games.sort((a,b)=>a.number-b.number);
  if(battle.games.some((g,i)=>g.number!==i+1))throw Error('GAME番号は1から連番にしてください');
 }
 return [...byId.values()];
}

export function planBattlesCsv(text,existing){
 const incoming=parseBattlesCsv(text),data=Object.fromEntries(Object.entries(existing).map(([store,items])=>[store,[...items]]));
 const oldMatches=new Set(existing.matches.map(m=>m.id)),oldGames=new Set(existing.games.map(g=>g.id));
 const knownTags=new Set(data.tags.map(t=>t.name));
 let imported=0,skipped=0,createdDecks=0,createdEvents=0,unlinkedVersions=0;
 for(const {meta,games} of incoming){
  if(oldMatches.has(meta.matchId)){skipped++;continue;}
  if(games.some(g=>oldGames.has(g.id)))throw Error('別の対戦とゲームIDが重複しています');
  const now=stamp(),deckName=meta.deck.trim();
  let candidates=data.decks.filter(d=>normalizedDeckName(d.name)===normalizedDeckName(deckName));
  if(candidates.length>1)throw Error(`「${deckName}」と同名のデッキが複数あります。整理してから取り込んでください`);
  let deck=candidates[0];
  if(!deck){deck={id:uid(),userId:null,name:deckName,regulationId:null,createdAt:now,updatedAt:now};data.decks.push(deck);createdDecks++;}
  const versions=data.deckVersions.filter(v=>v.deckId===deck.id&&v.label===meta.deckVersion);
  if(meta.deckVersion&&versions.length!==1)unlinkedVersions++;
  let event=null;
  if(meta.event){event=data.events.find(e=>e.name===meta.event&&e.venue===meta.venue&&e.date===meta.playedAt);
   if(!event){event={id:uid(),userId:null,name:meta.event,date:meta.playedAt,venue:meta.venue,regulationId:null,deckId:null,rank:'',participants:null,notes:'',createdAt:now,updatedAt:now};data.events.push(event);createdEvents++;}
  }
  const tags=meta.tags?meta.tags.split(' | ').map(s=>s.trim()).filter(Boolean):[];
  for(const name of tags)if(!knownTags.has(name)){data.tags.push({id:uid(),userId:null,name,createdAt:now,updatedAt:now});knownTags.add(name);}
  data.matches.push({id:meta.matchId,userId:null,eventId:event?.id||null,deckId:deck.id,deckVersionId:versions.length===1?versions[0].id:null,
   opponentDeckName:meta.opponentDeck.trim(),opponentDeckId:null,format:meta.format,playedAt:meta.playedAt,result:meta.matchResult,
   resultSource:meta.resultSource||'auto',notes:meta.notes,tags,createdAt:now,updatedAt:now});
  for(const g of games){data.games.push({id:g.id,userId:null,matchId:meta.matchId,number:g.number,turn:g.turn,result:g.result,createdAt:now,updatedAt:now});oldGames.add(g.id);}
  oldMatches.add(meta.matchId);imported++;
 }
 return {data,summary:{imported,skipped,createdDecks,createdEvents,unlinkedVersions}};
}
