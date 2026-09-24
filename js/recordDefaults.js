// 対戦固有の勝敗・メモ・タグは次の記録に持ち越さない。
export function lastUsedRecord(matches){return [...matches].sort((a,b)=>(b.createdAt||b.playedAt).localeCompare(a.createdAt||a.playedAt))[0]||null;}
export function recordDateDefaults(editing,previous,now=new Date()){
  const localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  return {date:editing?.playedAt??previous?.playedAt??localDate};
}
