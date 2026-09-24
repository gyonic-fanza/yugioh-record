// 改訂日一覧（遊戯王カードWiki）。固定候補はユーザーデータとして保存しない。
export const PERIOD_SOURCES = [
  'https://yugioh-wiki.net/?%B6%D8%BB%DF%A1%A6%C0%A9%B8%C2%A5%AB%A1%BC%A5%C9',
  'https://yugioh-wiki.net/?%A5%EA%A5%DF%A5%C3%A5%C8%A5%EC%A5%AE%A5%E5%A5%EC%A1%BC%A5%B7%A5%E7%A5%F3'
];
const early = ['2000-04-01','2000-05-15','2000-07-15','2000-08-15','2000-11-01','2001-01-15','2001-05-28','2002-01-01','2002-05-01','2003-01-01','2003-04-10','2003-07-01','2003-10-15','2004-03-01','2004-09-01','2005-03-01','2005-09-01','2006-03-01','2006-09-01','2007-03-01','2007-09-01','2008-03-01','2008-09-01','2009-03-01','2009-09-01','2010-03-01','2010-09-01','2011-03-01','2011-09-01','2012-03-01','2012-09-01','2013-03-01','2013-09-01','2013-11-01','2014-02-01'];
const quarterly = Array.from({length: 13}, (_, i) => 2014 + i).flatMap(year => [1,4,7,10].map(month => `${year}-${String(month).padStart(2,'0')}-01`)).filter(date => date >= '2014-04-01' && date <= '2026-10-01');
const starts = [...early, ...quarterly];
export function regulationLabel(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '—';const [year,month,day]=date.split('-');return `${year.slice(2)}${month}${day==='01'?'':day}`;}
export const DEFAULT_PERIODS = starts.map((startDate, index) => {
  const next = starts[index + 1];
  const endDate = next ? new Date(Date.parse(`${next}T00:00:00Z`) - 86400000).toISOString().slice(0,10) : '9999-12-31';
  return {id:`builtin:${startDate}`,label:regulationLabel(startDate),startDate,endDate,builtin:true};
});
export const allPeriods = custom => [...DEFAULT_PERIODS,...(custom||[])];
export const regulationForDate = (date,custom=[]) => allPeriods(custom).filter(p=>p.startDate<=date&&p.endDate>=date).sort((a,b)=>b.startDate.localeCompare(a.startDate))[0];
