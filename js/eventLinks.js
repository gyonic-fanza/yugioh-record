const date=x=>x?x.replaceAll('-','/').slice(0,10):'—';
export const eventOptionLabel=e=>`${date(e.date)}：[${e.venue||'会場未設定'}] ${e.name}`;
export function eventRecipeVersion(matches,eventId,deckId){
  return [...matches].filter(m=>m.eventId===eventId&&m.deckId===deckId)
    .sort((a,b)=>b.playedAt.localeCompare(a.playedAt)||b.createdAt?.localeCompare(a.createdAt||'')||0)[0]?.deckVersionId||null;
}
