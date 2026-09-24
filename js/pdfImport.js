// Official Yu-Gi-Oh! OCG deck registration form: extract the text layer by
// column and row coordinates. No OCR or server upload is involved.
const coord=item=>({text:String(item.str||'').trim(),x:item.transform?.[4]??0,y:item.transform?.[5]??0,width:item.width||0});
const sum=cards=>cards.reduce((total,card)=>total+card.count,0);

function column(items,headerName,footerName,previousCountX=null){
  const header=items.find(x=>x.text===headerName);
  const footer=items.find(x=>x.text.includes(footerName));
  if(!header||!footer||header.y<=footer.y)throw Error('公式デッキ記入用紙の欄を識別できませんでした。テキスト付きのPDFを選んでください。');
  const countHeader=items.filter(x=>x.text==='枚数'&&Math.abs(x.y-header.y)<4&&x.x>header.x)
    .sort((a,b)=>a.x-b.x)[0];
  if(!countHeader)throw Error(`${headerName}の枚数欄を読み取れませんでした。`);
  const countX=countHeader.x,left=previousCountX==null?countX-155:previousCountX+8;
  const counts=items.filter(x=>/^\d{1,2}$/.test(x.text)&&Math.abs(x.x-countX)<14&&x.y<header.y-6&&x.y>footer.y+5);
  const cards=[];
  for(const count of counts){
    const pieces=items.filter(x=>x.x>left&&x.x<countX-15&&x.y<header.y-5&&x.y>footer.y+5&&Math.abs(x.y-count.y)<=6).sort((a,b)=>a.x-b.x);
    if(!pieces.length)continue;
    let name='',previous=null;for(const p of pieces){const gap=previous?p.x-previous.x-previous.width:0;name+=(name&&gap>2&&/[A-Za-z]$/.test(name)&&/^[A-Za-z]/.test(p.text)?' ':'')+p.text;previous=p;}
    name=name.trim();if(name)cards.push({name,count:Number(count.text)});
  }
  const footerCount=items.filter(x=>/^\d+$/.test(x.text)&&Math.abs(x.y-footer.y)<4&&Math.abs(x.x-countX)<14)[0];
  return {cards,printed:footerCount?Number(footerCount.text):null,countX};
}

export function parseDeckTextItems(raw){
  const items=raw.map(coord).filter(x=>x.text),monster=column(items,'モンスターカード','モンスターカード合計'),spell=column(items,'魔法カード','魔法カード合計',monster.countX),trap=column(items,'罠カード','罠カード合計',spell.countX),extra=column(items,'エクストラデッキ','エクストラデッキ合計'),side=column(items,'サイドデッキ','サイドデッキ合計',extra.countX);
  const main=[...monster.cards.map(c=>({...c,type:'MONSTER'})),...spell.cards.map(c=>({...c,type:'SPELL'})),...trap.cards.map(c=>({...c,type:'TRAP'}))],warnings=[];
  for(const [name,entry] of [['モンスター',monster],['魔法',spell],['罠',trap],['EXTRA',extra],['SIDE',side]])if(entry.printed!=null&&sum(entry.cards)!==entry.printed)warnings.push(`${name}：PDF記載${entry.printed}枚／読取${sum(entry.cards)}枚`);
  const mainTotal=items.find(x=>x.text.includes('メインデッキ合計'));
  const total=mainTotal&&items.find(x=>/^\d+$/.test(x.text)&&Math.abs(x.y-mainTotal.y)<4&&x.x>mainTotal.x&&x.x<mainTotal.x+160);
  if(total&&sum(main)!==Number(total.text))warnings.push(`MAIN：PDF記載${total.text}枚／読取${sum(main)}枚`);
  if(!main.length)throw Error('MAINのカード名を読み取れませんでした。画像だけのPDFは非対応です。');
  if(sum(main)<40||sum(main)>60)warnings.push(`MAINが${sum(main)}枚です。内容を確認してください。`);
  if(sum(extra.cards)>15||sum(side.cards)>15)warnings.push('EXTRAまたはSIDEが15枚を超えています。');
  return {cards:{main,extra:extra.cards.map(c=>({...c,type:'MONSTER'})),side:side.cards.map(c=>({...c,type:'UNKNOWN'}))},totals:{main:sum(main),extra:sum(extra.cards),side:sum(side.cards)},warnings};
}

export function suggestedDeckName(filename){return String(filename||'').replace(/\.pdf$/i,'').split(/[-_]+/).map(s=>s.trim()).filter(Boolean).at(-1)?.replace(/\s*\(\d+\)$/,'')||'';}

export async function readDeckPdf(file){
  if(!file||!file.name.toLowerCase().endsWith('.pdf'))throw Error('PDFファイルを選んでください。');
  if(file.size>12*1024*1024)throw Error('PDFが12MBを超えています。');
  const pdfjs=await import('../vendor/pdfjs/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  const resource=path=>{const url=new URL(path,import.meta.url);return typeof window==='undefined'?url.pathname:url.href;};
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:resource('../vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:resource('../vendor/pdfjs/standard_fonts/')});
  try{const pdf=await task.promise;if(pdf.numPages!==1)throw Error('公式デッキ記入用紙の1ページPDFを選んでください。');const page=await pdf.getPage(1),content=await page.getTextContent();return {...parseDeckTextItems(content.items),suggestedName:suggestedDeckName(file.name),filename:file.name};}
  finally{await task.destroy();}
}
