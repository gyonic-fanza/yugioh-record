export const CARD_TYPES = [
  {id:'MONSTER',label:'モンスター'},
  {id:'SPELL',label:'魔法'},
  {id:'TRAP',label:'罠'},
  {id:'UNKNOWN',label:'未分類'}
];
export const typeLabel = type => CARD_TYPES.find(x=>x.id===type)?.label||'未分類';
export const typeId = label => CARD_TYPES.find(x=>x.label===label)?.id;
export function groupCards(cards=[]){
  return CARD_TYPES.map(type=>({type:type.id,label:type.label,cards:cards.filter(c=>(CARD_TYPES.some(t=>t.id===c.type)?c.type:'UNKNOWN')===type.id)
    .sort((a,b)=>a.name.localeCompare(b.name,'ja'))})).filter(group=>group.cards.length);
}
export function formatCards(cards=[]){
  return groupCards(cards).map(group=>`【${group.label}】\n${group.cards.map(c=>`${c.count}《${c.name}》`).join('\n')}`).join('\n');
}
