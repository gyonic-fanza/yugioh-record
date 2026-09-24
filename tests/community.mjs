import assert from 'node:assert/strict';
import {contribution,CommunityRepository} from '../js/community.js';
import {renderCommunity} from '../js/communityView.js';
const data={
 decks:[{id:'a',name:'烙印'}],
 matches:[
  {playedAt:'2026-09-24',deckId:'a',opponentDeckName:'光と闇',format:'MATCH',result:'WIN',notes:'非公開',venue:'非公開',email:'secret'},
  {playedAt:'2026-09-23',deckId:'a',opponentDeckName:'トゥーン',format:'SINGLE',result:'LOSS'}
 ],deckVersions:[
  {deckId:'a',createdAt:'2026-09-21',cards:{main:[{name:'旧カード',count:3}]}},
  {deckId:'a',createdAt:'2026-09-24',cards:{main:[{name:'烙印融合',count:3},{name:'烙印融合',count:1}],extra:[],side:[]}}
 ]
};
const shared=contribution(data);
assert.deepEqual(shared.matches,[{month:'2026-09',deck:'烙印',opponent:'光と闇',result:'WIN'}]);
assert.deepEqual(shared.cards,[{deck:'烙印',card:'烙印融合',zone:'main'}]);
assert(!JSON.stringify(shared).includes('非公開'));
const called=[];
const api=new CommunityRepository({rpc:async(...args)=>{called.push(args);return {data:{contributors:5},error:null};},from:()=>({select:()=>({maybeSingle:async()=>({data:{updated_at:'2026-09-24'},error:null})})})});
await api.publish(shared);await api.withdraw();assert.equal((await api.overview()).contributors,5);assert.equal(await api.status(),'2026-09-24');
assert.deepEqual(called.map(c=>c[0]),['ocg_publish_snapshot','ocg_withdraw_snapshot','ocg_community_overview']);
assert(!renderCommunity({loading:false,overview:{environment:[{name:'<script>',battles:5,contributors:5}],contributors:5}},true).includes('<script>'));
console.log('PASS: opt-in snapshot fields, latest recipe, RPC integration and escaped rendering');
