export function opponentNames(matches){
  return [...new Set(matches.map(m=>String(m.opponentDeckName||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.normalize('NFKC').localeCompare(b.normalize('NFKC'),'ja')||a.localeCompare(b,'ja'));
}
export function suggestOpponents(names,query){
  const needle=String(query||'').normalize('NFKC').toLocaleLowerCase('ja');
  return names.filter(name=>name.normalize('NFKC').toLocaleLowerCase('ja').includes(needle));
}
