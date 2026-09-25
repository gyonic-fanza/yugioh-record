import {pct,stats,today} from './services.js';
import {allPeriods} from './defaultPeriods.js';
import {normalizeSearch} from './searchText.js';
export const FREE_EVENT = 'フリー対戦';
export const eventNameForMatch = (events,match) => events.find(e=>e.id===match.eventId)?.name?.trim()||FREE_EVENT;

export function periodBounds(key,periods=[],from='',to='',now=today()){
  const day=n=>new Date(Date.parse(`${now}T00:00:00Z`)-n*86400000).toISOString().slice(0,10);
  if(key==='month')return [now.slice(0,7)+'-01',now];
  if(key==='30')return [day(29),now];
  if(key==='90')return [day(89),now];
  if(key==='custom')return [from||'0000-01-01',to||'9999-12-31'];
  const period=allPeriods(periods).find(x=>key===`period:${x.id}`);
  return period?[period.startDate,period.endDate]:['0000-01-01','9999-12-31'];
}

const tally=rows=>({total:rows.length,win:rows.filter(x=>x.result==='WIN').length,loss:rows.filter(x=>x.result==='LOSS'||x.result==='DOUBLE_LOSS').length,draw:rows.filter(x=>x.result==='DRAW').length,rate:pct(rows.filter(x=>x.result==='WIN').length,rows.length)});
export function analyze(data,filter={}){
  const [start,end]=periodBounds(filter.key||'all',data.periods||[],filter.from,filter.to,filter.now||today());
  const eventVenues=new Map(data.events.map(e=>[e.id,e.venue||'']));
  const eventNames=new Map(data.events.map(e=>[e.id,e.name?.trim()||FREE_EVENT]));
  const eventRegulations=new Map(data.events.map(e=>[e.id,e.regulationId])),deckRegulations=new Map(data.decks.map(d=>[d.id,d.regulationId]));
  const regulation=allPeriods(data.periods||[]).find(p=>p.id===filter.regulation);
  const eventQuery=normalizeSearch(filter.eventName);
  const matches=data.matches.filter(m=>m.playedAt>=start&&m.playedAt<=end&&(!eventQuery||normalizeSearch(eventNames.get(m.eventId)||FREE_EVENT).includes(eventQuery))&&(!filter.venue||eventVenues.get(m.eventId)===filter.venue)&&(!filter.regulation||(eventRegulations.get(m.eventId)||deckRegulations.get(m.deckId)||((regulation?.startDate<=m.playedAt&&m.playedAt<=regulation?.endDate)?regulation.id:null))===filter.regulation)).sort((a,b)=>a.playedAt.localeCompare(b.playedAt));
  const idSet=new Set(matches.map(m=>m.id)),games=data.games.filter(g=>idSet.has(g.matchId));
  const groups=(key)=>{
    const map=new Map();for(const m of matches){const k=key(m);if(!map.has(k))map.set(k,[]);map.get(k).push(m);}
    return [...map].map(([id,rows])=>{const set=new Set(rows.map(m=>m.id)),gs=games.filter(g=>set.has(g.matchId));return {id,records:rows.length,match:stats(rows.filter(m=>m.format==='MATCH'),[]).matches,game:tally(gs),first:tally(gs.filter(g=>g.turn==='FIRST')),second:tally(gs.filter(g=>g.turn==='SECOND'))};}).sort((a,b)=>b.match.total-a.match.total||b.game.total-a.game.total||String(a.id).localeCompare(String(b.id),'ja'));
  };
  const tags=new Map();for(const m of matches)for(const name of new Set(m.tags||[])){if(!tags.has(name))tags.set(name,[]);tags.get(name).push(m);}
  const monthTotals=format=>{
    const months=new Map();for(const m of matches.filter(m=>m.format===format)){const key=m.playedAt.slice(0,7);if(!months.has(key))months.set(key,[]);months.get(key).push(m);}
    return [...months].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>({month,...tally(rows)}));
  };
  return {start,end,matches,games,match:tally(matches.filter(m=>m.format==='MATCH')),single:tally(matches.filter(m=>m.format==='SINGLE')),game:tally(games),first:tally(games.filter(g=>g.turn==='FIRST')),second:tally(games.filter(g=>g.turn==='SECOND')),decks:groups(m=>m.deckId),opponents:groups(m=>m.opponentDeckName),versions:groups(m=>m.deckVersionId),tags:[...tags].map(([name,rows])=>({name,total:rows.length,match:tally(rows.filter(m=>m.format==='MATCH')),single:tally(rows.filter(m=>m.format==='SINGLE'))})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ja')),months:monthTotals('MATCH'),singleMonths:monthTotals('SINGLE')};
}

function csvCell(value){let s=String(value??'');if(/^\s*[=+\-@]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;}
export function battlesCsv(data,matches){
  const decks=new Map(data.decks.map(d=>[d.id,d.name])),versions=new Map(data.deckVersions.map(v=>[v.id,v.label])),events=new Map(data.events.map(e=>[e.id,e.name])),venues=new Map(data.events.map(e=>[e.id,e.venue||'']));
  const headers=['matchId','gameId','playedAt','event','venue','format','deck','deckVersion','opponentDeck','matchResult','resultSource','gameNumber','turn','gameResult','tags','notes'];
  const rows=[headers.join(',')];for(const m of matches){const games=data.games.filter(g=>g.matchId===m.id).sort((a,b)=>a.number-b.number);for(const g of games){const values=[m.id,g.id,m.playedAt,events.get(m.eventId)||'',venues.get(m.eventId)||'',m.format,decks.get(m.deckId)||'',versions.get(m.deckVersionId)||'',m.opponentDeckName,m.result,m.resultSource||'',g.number,g.turn,g.result,(m.tags||[]).join(' | '),m.notes||''];rows.push(values.map(csvCell).join(','));}}
  return '\ufeff'+rows.join('\r\n')+'\r\n';
}
