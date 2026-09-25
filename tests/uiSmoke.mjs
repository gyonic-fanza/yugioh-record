import assert from 'node:assert/strict';

const elements=new Map(),listeners=new Map();
const fixtures={
 decks:[{id:'d1',name:'烙印',regulationId:null},{id:'d2',name:'別デッキ',regulationId:null}],
 deckVersions:[{id:'v1',deckId:'d1',label:'初版',createdAt:'2026-09-20T00:00:00Z',cards:{main:[],extra:[],side:[]}},{id:'v2',deckId:'d1',label:'改訂版',createdAt:'2026-09-22T00:00:00Z',cards:{main:[],extra:[],side:[]}}],
 matches:[
  {id:'m1',deckId:'d1',deckVersionId:'v1',format:'MATCH',result:'WIN',playedAt:'2026-09-21',opponentDeckName:'A'},
  {id:'m2',deckId:'d1',deckVersionId:'v2',format:'MATCH',result:'LOSS',playedAt:'2026-09-22',opponentDeckName:'B'},
  {id:'m3',deckId:'d1',deckVersionId:null,format:'SINGLE',result:'WIN',playedAt:'2026-09-23',opponentDeckName:'C'},
  {id:'m4',deckId:'d2',deckVersionId:null,format:'MATCH',result:'WIN',playedAt:'2026-09-24',opponentDeckName:'D'}
 ],
 games:[
  {id:'g1',matchId:'m1',result:'WIN',turn:'FIRST'},{id:'g2',matchId:'m2',result:'LOSS',turn:'SECOND'},
  {id:'g3',matchId:'m3',result:'WIN',turn:'SECOND'},{id:'g4',matchId:'m4',result:'WIN',turn:'FIRST'}
 ]
};
function element(selector){
 if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},style:{}});
 return elements.get(selector);
}
globalThis.document={
 documentElement:{dataset:{}},body:{append(){}},querySelector:element,
 addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}
};
globalThis.window={scrollTo(){},addEventListener(){},innerWidth:400,innerHeight:800,scrollY:0};
globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
globalThis.indexedDB={open(){
 const request={};
 queueMicrotask(()=>{
  const db={close(){},transaction(){
  const transaction={objectStore(store){return {getAll(){
   const read={};queueMicrotask(()=>{read.result=fixtures[store]||[];read.onsuccess?.();queueMicrotask(()=>transaction.oncomplete?.());});return read;
   }};}};return transaction;
  }};
  request.result=db;request.onsuccess?.();
 });
 return request;
}};

await import('../js/main.js');
await new Promise(resolve=>setTimeout(resolve,20));
assert(element('#content').innerHTML.includes('対戦履歴'),'起動時にHOMEを表示する');
const navigate=async view=>{
 const target={dataset:{nav:view},closest(selector){return selector==='button'?this:null;}};
 await listeners.get('click')[0]({target});
};
for(const [view,marker] of [['record','id="add-record"'],['events','イベントを登録'],['decks','デッキを登録'],['analysis','成績分析']]){
 await navigate(view);
 assert(element('#content').innerHTML.includes(marker),`${view}を表示する`);
}
assert(!element('#content').innerHTML.includes('今日のAIひとこと'),'ANALYSISからAIコメントを取り外す');
await navigate('decks');
const openDeck={dataset:{deckDetail:'d1'},closest(selector){return selector==='button'?this:null;}};
await listeners.get('click')[0]({target:openDeck});
const deckHtml=element('#content').innerHTML;
assert(deckHtml.includes('このデッキの戦績'));
assert(deckHtml.includes('MATCH 勝率</div><div class="big">50%'));
assert(deckHtml.includes('GAME 勝率</div><div class="big">66.7%'));
assert(deckHtml.includes('SINGLE<small>1戦 · 1勝 0敗 0分'));
assert(deckHtml.includes('id="battle-list-deck"'));
assert(deckHtml.indexOf('data-detail="m3"')<deckHtml.indexOf('data-detail="m2"'));
assert(!deckHtml.includes('data-detail="m4"'),'他のデッキの対戦を含まない');
const sortDeck={dataset:{battleSort:'deck'},value:'oldest'};
await listeners.get('change')[0]({target:sortDeck});
assert(element('#battle-list-deck').innerHTML.indexOf('data-detail="m1"')<element('#battle-list-deck').innerHTML.indexOf('data-detail="m3"'),'デッキ戦績の並び順を切り替える');
await navigate('record');
assert(element('#content').innerHTML.includes('data-batch-index="0"'));
assert(element('#content').innerHTML.includes('data-game-override'));
assert(!element('#content').innerHTML.includes('id="record-count"'));
const groups=[];
const makeGroup=index=>{
 const title={textContent:''},status={textContent:''},override={value:'',setAttribute(){}},remove={setAttribute(){}},group={dataset:{},scrollIntoView(){},remove(){groups.splice(groups.indexOf(group),1);}};
 group.querySelector=selector=>({'h3':title,'.batch-result':status,'[data-game-override]':override,'[data-remove-record]':index?remove:null})[selector]||null;
 group.querySelectorAll=()=>[];
 return group;
};
groups.push(makeGroup(0));
const games=element('#games');games.querySelectorAll=()=>groups;games.insertAdjacentHTML=(_,html)=>{assert(html.includes('data-game-override'));groups.push(makeGroup(groups.length));};
Object.defineProperty(games,'lastElementChild',{get:()=>groups.at(-1)});
document.querySelectorAll=selector=>selector==='.batch-game-group'?groups:[];
element('#format').value='MATCH';
const add={id:'add-record',dataset:{},closest(selector){return selector==='button'?this:null;}};
await listeners.get('click')[0]({target:add});
assert.equal(groups.length,2,'追加ボタンで対戦欄を増やす');
assert.equal(element('#record-form button[type=submit]').textContent,'2件の対戦をまとめて保存');
groups[1].querySelector('[data-game-override]').value='DOUBLE_LOSS';
const remove={dataset:{removeRecord:''},closest(selector){return selector==='button'?this:selector==='.batch-game-group'?groups[1]:null;}};
await listeners.get('click')[0]({target:remove});
assert.equal(groups.length,1,'個別の削除ボタンで対戦欄を減らす');
assert.equal(element('#record-form button[type=submit]').textContent,'対戦を保存');
await navigate('community');
assert(element('#content').innerHTML.includes('id="add-record"'),'停止中のMETAは開けない');
console.log('PASS: app boots, key screens render, and disabled META stays inaccessible');
