// 全レシピ版の採用カードを調べる。過去の版も対象に含める。
export function searchDecksByCard(decks, versions, query){
  const needle=String(query||'').trim().toLocaleLowerCase('ja');
  return decks.map(deck=>({deck,hits:versions.filter(v=>v.deckId===deck.id).flatMap(version=>
    Object.entries(version.cards||{}).flatMap(([zone,cards])=>(cards||[])
      .filter(card=>needle&&card.name.toLocaleLowerCase('ja').includes(needle))
      .map(card=>({version,zone,card}))))})).filter(row=>!needle||row.hits.length);
}
