import assert from 'node:assert/strict';

const elements=new Map(),listeners=new Map();
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
   const transaction={objectStore(){return {getAll(){
    const read={};queueMicrotask(()=>{read.result=[];read.onsuccess?.();queueMicrotask(()=>transaction.oncomplete?.());});return read;
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
