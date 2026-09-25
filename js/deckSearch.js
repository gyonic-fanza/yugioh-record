// 全レシピ版の採用カードを調べる。過去の版も対象に含める。
import {normalizeSearch} from './searchText.js';
export function searchDecksByCard(decks, versions, query){
  const needle=normalizeSearch(query);
  return decks.map(deck=>({deck,hits:versions.filter(v=>v.deckId===deck.id).flatMap(version=>
    Object.entries(version.cards||{}).flatMap(([zone,cards])=>(cards||[])
      .filter(card=>needle&&normalizeSearch(card.name).includes(needle))
      .map(card=>({version,zone,card}))))})).filter(row=>!needle||row.hits.length);
}
export function cardSuggestions(versions,query){
  const needle=normalizeSearch(query);
  if(!needle)return [];
  return [...new Set(versions.flatMap(v=>Object.values(v.cards||{}).flatMap(cards=>(cards||[]).map(c=>c.name))))]
    .filter(name=>normalizeSearch(name).includes(needle))
    .sort((a,b)=>a.localeCompare(b,'ja'));
}
