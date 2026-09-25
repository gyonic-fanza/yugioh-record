export const BATTLE_SORT_OPTIONS=[
 ['newest','新しい順'],['oldest','古い順'],['wins','勝ちを先に'],['losses','負けを先に'],['opponent','相手デッキ名順']
];

export function sortBattles(matches,order='newest'){
 const newest=(a,b)=>String(b.playedAt||'').localeCompare(String(a.playedAt||''))
  ||String(b.createdAt||'').localeCompare(String(a.createdAt||''))
  ||String(b.id||'').localeCompare(String(a.id||''));
 return [...matches].sort((a,b)=>{
  if(order==='oldest')return -newest(a,b);
  if(order==='wins'||order==='losses'){
   const preferred=match=>order==='wins'?match.result==='WIN':['LOSS','DOUBLE_LOSS'].includes(match.result);
   return Number(preferred(b))-Number(preferred(a))||newest(a,b);
  }
  if(order==='opponent')return String(a.opponentDeckName||'').localeCompare(String(b.opponentDeckName||''),'ja')||newest(a,b);
  return newest(a,b);
 });
}
