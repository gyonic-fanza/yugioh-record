// 表記の違いだけで検索結果が変わらないよう、全角・半角とかなを揃える。
export function normalizeSearch(value){
 return String(value||'').trim().normalize('NFKC').toLocaleLowerCase('ja')
  .replace(/[\u3041-\u3096\u309d\u309e]/g,char=>String.fromCharCode(char.charCodeAt(0)+0x60));
}
