import assert from 'node:assert/strict';
import {analyze,battlesCsv,periodBounds,eventNameForMatch} from '../js/analysisService.js';
import {renderAnalysis} from '../js/analysisView.js';
import {AppService,validateBackup} from '../js/services.js';
import {STORES} from '../js/storage.js';
class MemoryRepo{constructor(){this.tables=Object.fromEntries(STORES.map(s=>[s,new Map()]));}async list(s){return [...this.tables[s].values()];}async get(s,id){return this.tables[s].get(id);}async put(s,x){this.tables[s].set(x.id,structuredClone(x));}async remove(s,id){this.tables[s].delete(id);}async snapshot(){return Object.fromEntries(STORES.map(s=>[s,[...this.tables[s].values()]]));}async replaceAll(data){for(const s of STORES)this.tables[s]=new Map(data[s].map(x=>[x.id,x]));}async merge(data){for(const s of STORES)for(const x of data[s])await this.put(s,x);}}
const repo=new MemoryRepo(),service=new AppService(repo);
const period=await service.addPeriod({label:'2607環境',startDate:'2026-07-01',endDate:'2026-09-30'});
await assert.rejects(service.addPeriod({label:'逆転',startDate:'2026-10-01',endDate:'2026-09-30'}));
assert.deepEqual(periodBounds(`period:${period.id}`,[period]),['2026-07-01','2026-09-30']);
assert.deepEqual(periodBounds('30',[],'','','2026-09-23'),['2026-08-25','2026-09-23']);
const data={decks:[{id:'d1',name:'烙印'}],deckVersions:[{id:'v1',deckId:'d1',label:'初期',createdAt:'2026-07-01'},{id:'v2',deckId:'d1',label:'新構築',createdAt:'2026-08-01'}],events:[{id:'e1',name:'ランキング'}],periods:[period],matches:[
{id:'m1',format:'MATCH',playedAt:'2026-07-10',deckId:'d1',deckVersionId:'v1',opponentDeckName:'エルフェンノーツ',eventId:'e1',result:'WIN',tags:['事故'],notes:'後攻勝ち'},
{id:'m2',format:'MATCH',playedAt:'2026-08-20',deckId:'d1',deckVersionId:'v2',opponentDeckName:'エルフェンノーツ',result:'LOSS',tags:['事故'],notes:'G2負け'},
{id:'m3',format:'MATCH',playedAt:'2026-09-10',deckId:'d1',deckVersionId:'v2',opponentDeckName:'キラーチューン',result:'DRAW',tags:['ET'],notes:'引き分け'},
{id:'s1',format:'SINGLE',playedAt:'2026-09-11',deckId:'d1',deckVersionId:'v2',opponentDeckName:'=HYPERLINK("a")',result:'WIN',tags:['事故'],notes:'=cmd,改行\nあり'}],games:[
{id:'g1',matchId:'m1',number:1,turn:'SECOND',result:'LOSS'},{id:'g2',matchId:'m1',number:2,turn:'FIRST',result:'WIN'},{id:'g3',matchId:'m1',number:3,turn:'SECOND',result:'WIN'},
{id:'g4',matchId:'m2',number:1,turn:'FIRST',result:'LOSS'},{id:'g5',matchId:'m2',number:2,turn:'SECOND',result:'LOSS'},
{id:'g6',matchId:'m3',number:1,turn:'FIRST',result:'DRAW'},{id:'g7',matchId:'s1',number:1,turn:'SECOND',result:'WIN'}],tags:[]};
const a=analyze(data,{key:`period:${period.id}`});assert.equal(a.match.total,3);assert.equal(a.match.win,1);assert.equal(a.match.rate,'33.3%');assert.equal(a.single.total,1);assert.equal(a.game.total,7);assert.equal(a.game.win,3);assert.equal(a.first.total,3);assert.equal(a.second.total,4);assert.equal(a.months.length,3);assert.equal(a.opponents.find(x=>x.id==='エルフェンノーツ').match.total,2);assert.equal(a.versions.find(x=>x.id==='v1').match.rate,'100%');assert.equal(a.versions.find(x=>x.id==='v2').match.rate,'0%');assert.equal(a.tags.find(x=>x.name==='事故').match.win,1);assert.equal(a.tags.find(x=>x.name==='事故').single.win,1);
assert.equal(analyze(data,{eventName:'ランキ'}).match.total,1);
assert.equal(analyze(data,{eventName:'らんきんぐ'}).match.total,1);
assert.equal(analyze(data,{eventName:'フリー'}).match.total,2);
assert.equal(analyze(data,{eventName:'ふりー'}).match.total,2);
assert.equal(analyze(data,{eventName:'存在しない'}).match.total,0);
assert.equal(eventNameForMatch(data.events,data.matches[1]),'フリー対戦');
assert.equal(eventNameForMatch(data.events,data.matches[0]),'ランキング');
const sep=analyze(data,{key:'custom',from:'2026-09-01',to:'2026-09-30'});assert.equal(sep.match.total,1);assert.equal(sep.game.total,2);assert.equal(sep.single.total,1);
const csv=battlesCsv(data,sep.matches);assert(csv.startsWith('\ufeffmatchId'));assert(!csv.includes('playedTime'));assert(csv.includes("'=HYPERLINK"));assert(csv.includes('"\'=cmd,改行\nあり"'));assert(csv.includes('m3'));assert(!csv.includes('m1,"g1"'));
const html=renderAnalysis(data,{period:`period:${period.id}`});assert(html.includes('月別MATCH推移'));assert(html.includes('id="analysis-event-name"'));assert(renderAnalysis(data,{eventName:'フリー'}).includes('data-event-suggestion="フリー対戦"'));assert(html.includes('デッキバージョン比較'));assert(html.includes('少数（5戦未満）'));assert(!html.includes('<script>'));assert(renderAnalysis(data,{period:'custom',from:'2026-10-01',to:'2026-09-01'}).includes('開始日が終了日より後')); 
const old=validateBackup({schemaVersion:1,...Object.fromEntries(STORES.filter(s=>s!=='periods').map(s=>[s,[]]))});assert.deepEqual(old.periods,[]);await service.importBackup(old,'replace');assert.equal((await repo.list('periods')).length,0);await service.addPeriod({label:'2610',startDate:'2026-10-01',endDate:'2026-12-31'});assert.equal((await service.exportBackup()).schemaVersion,2);await service.deletePeriod((await repo.list('periods'))[0].id);assert.equal((await repo.list('periods')).length,0);
console.log('PASS: period filters, MATCH/GAME/SINGLE, versions, tags, trends, CSV, v1 JSON migration, analysis markup');
