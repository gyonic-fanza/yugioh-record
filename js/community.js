// Community sharing is an explicit, replaceable snapshot, separate from private sync.
const clean = value => String(value ?? '').trim().slice(0, 80);
export function contribution(data){
 const names=new Map(data.decks.map(d=>[d.id,clean(d.name)]));
 const matches=data.matches.filter(m=>m.format==='MATCH'&&/^\d{4}-\d{2}-\d{2}$/.test(m.playedAt||''))
  .map(m=>({month:m.playedAt.slice(0,7),deck:names.get(m.deckId)||'',opponent:clean(m.opponentDeckName),result:m.result==='WIN'?'WIN':m.result==='DRAW'?'DRAW':'LOSS'}))
  .filter(m=>m.deck&&m.opponent).sort((a,b)=>a.month.localeCompare(b.month)).slice(-1000);
 // One most recent recipe per deck; count adoption once per card and player.
 const latest=new Map();for(const v of data.deckVersions){const old=latest.get(v.deckId);if(!old||v.createdAt>old.createdAt)latest.set(v.deckId,v);}
 const cards=[];for(const [deckId,v] of latest){const deck=names.get(deckId);if(!deck)continue;
  for(const zone of ['main','extra','side'])for(const c of v.cards?.[zone]||[]){const card=clean(c.name);if(card&&!cards.some(x=>x.deck===deck&&x.card===card&&x.zone===zone))cards.push({deck,card,zone});}
 }
 if(matches.length>1000||cards.length>500)throw Error('共有上限を超えました。レシピを整理してください');
 return {matches,cards};
}
export class CommunityRepository{
 constructor(client){this.client=client;}
 async status(){const {data,error}=await this.client.from('ocg_public_snapshots').select('updated_at').maybeSingle();if(error)throw error;return data?.updated_at||null;}
 async publish(payload){const {error}=await this.client.rpc('ocg_publish_snapshot',{p_matches:payload.matches,p_cards:payload.cards});if(error)throw error;}
 async withdraw(){const {error}=await this.client.rpc('ocg_withdraw_snapshot');if(error)throw error;}
 async overview(){const {data,error}=await this.client.rpc('ocg_community_overview');if(error)throw error;return data;}
}
