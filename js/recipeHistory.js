export const RECIPE_ZONES=['main','extra','side'];

export function orderVersions(versions){
 return [...versions].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id||'').localeCompare(String(b.id||'')));
}

export function recipeDiff(previous,current){
 if(!previous)return null;
 const zones={};let added=0,removed=0,changed=0;
 for(const zone of RECIPE_ZONES){
  const tally=version=>{
   const map=new Map();
   for(const card of version?.cards?.[zone]||[]){
    const name=String(card?.name||'').trim(),count=Number(card?.count)||0;
    if(!name||count<=0)continue;
    const record=map.get(name)||{name,count:0};
    record.count+=count;
    map.set(name,record);
   }
   return map;
  };
  const before=tally(previous),after=tally(current);
  zones[zone]=[...new Set([...before.keys(),...after.keys()])].sort((a,b)=>a.localeCompare(b,'ja')).flatMap(name=>{
   const old=before.get(name),next=after.get(name),a=old?.count||0,b=next?.count||0;
   if(a===b)return [];
   const delta=b-a;
   if(delta>0)added+=delta;else removed-=delta;
   if(a&&b)changed++;
   return [{name,before:a,after:b,delta}];
  });
 }
 return {zones,added,removed,changed,total:Object.values(zones).reduce((n,list)=>n+list.length,0)};
}
