import {IndexedDBRepository,SettingsRepository,STORES} from './storage.js';
import {AppService,today,resultOf,stats,validateBackup,parseCards} from './services.js';
import {analyze,battlesCsv,eventNameForMatch} from './analysisService.js?v=25';
import {planBattlesCsv} from './csvImport.js';
import {parseCalculatorCsv} from './calculatorImport.js';
import {renderAnalysis} from './analysisView.js?v=25';
import {readDeckPdf} from './pdfImport.js';
import {allPeriods,regulationLabel,regulationForDate} from './defaultPeriods.js';
import {searchDecksByCard,cardSuggestions} from './deckSearch.js';
import {matchingDecks,normalizedDeckName,sortedDecks,versionsForDeck} from './deckSelection.js';
import {lastUsedRecord,recordDateDefaults} from './recordDefaults.js';
import {opponentNames,suggestOpponents} from './opponentSuggestions.js';
import {eventOptionLabel,eventRecipeVersion} from './eventLinks.js';
import {formatCards} from './cardTypes.js';
import {orderVersions,recipeDiff,RECIPE_ZONES} from './recipeHistory.js';
import {icon} from './icons.js';
import {CloudController,cloudConfig,saveCloudConfig} from './cloud.js';
import {CommunityRepository,contribution} from './community.js';
import {renderCommunity} from './communityView.js';
import {HELP_TOPICS,helpButton,renderHelpPage} from './help.js';
import {BATTLE_SORT_OPTIONS,sortBattles} from './battleSort.js';
const $=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repo=new IndexedDBRepository(),settings=new SettingsRepository(),service=new AppService(repo),cloud=new CloudController(repo);
const state={view:'home',returnView:'home',battleSort:{home:'newest',venue:'newest',event:'newest',deck:'newest'},bulkCount:1,data:null,editing:null,detail:null,deckDetail:null,eventDetail:null,editingEvent:false,originEvent:null,focusVersion:null,eventVenue:'',venue:'',eventName:'',eventSuggestionClosed:false,cardSuggestionClosed:false,source:null,pdfDraft:null,cardSearch:'',cloudError:'',community:{loading:false,error:'',overview:null,published:null}};
const META_ENABLED=false;
const labels={home:'HOME',record:'RECORD',events:'EVENTS',decks:'DECKS',analysis:'ANALYSIS',community:'META'};
const date=x=>x?x.replaceAll('-','/').slice(0,10):'—';
const nameOf=(items,id)=>items.find(x=>x.id===id)?.name||'未設定';
const chronology=x=>x.playedAt||x.date||x.createdAt;
const sortDate=xs=>[...xs].sort((a,b)=>chronology(b).localeCompare(chronology(a)));
const battleDate=m=>date(m.playedAt);
const battleEvent=m=>eventNameForMatch(state.data.events,m);
const regulations=()=>allPeriods(state.data.periods).sort((a,b)=>b.startDate.localeCompare(a.startDate));
const regulationName=id=>id?regulationLabel(regulations().find(p=>p.id===id)?.startDate):'未設定';
const regulationSelect=(selected,dateValue=today())=>`<label>レギュレーション<select name="regulationId" id="regulationId">${option('','未指定',selected)}${regulations().map(p=>option(p.id,regulationLabel(p.startDate),selected??regulationForDate(dateValue,state.data.periods)?.id)).join('')}</select></label>`;
const gamesFor=id=>state.data.games.filter(g=>g.matchId===id).sort((a,b)=>a.number-b.number);
let activeHelp=null,helpPinned=false,helpPanel=null;
function closeHelp(){
 if(activeHelp)activeHelp.setAttribute('aria-expanded','false');
 if(helpPanel)helpPanel.hidden=true;
 activeHelp=null;helpPinned=false;
}
function showHelp(button,pin=false){
 const topic=HELP_TOPICS[button.dataset.help];if(!topic)return;
 if(pin&&activeHelp===button&&helpPinned){closeHelp();return;}
 if(helpPinned&&!pin)return;
 if(activeHelp&&activeHelp!==button)activeHelp.setAttribute('aria-expanded','false');
 activeHelp=button;helpPinned=pin;
 if(!helpPanel){helpPanel=document.createElement('div');helpPanel.id='help-popover';helpPanel.className='help-popover';helpPanel.setAttribute('role','tooltip');document.body.append(helpPanel);}
 helpPanel.replaceChildren();
 const title=document.createElement('strong');title.textContent=topic.title;helpPanel.append(title);
 for(const line of [topic.short,...topic.details]){const p=document.createElement('p');p.textContent=line;helpPanel.append(p);}
 helpPanel.hidden=false;
 button.setAttribute('aria-expanded','true');
 const rect=button.getBoundingClientRect(),width=helpPanel.offsetWidth,height=helpPanel.offsetHeight;
 helpPanel.style.left=`${Math.max(10,Math.min(rect.left,window.innerWidth-width-10))}px`;
 helpPanel.style.top=`${rect.bottom+height+10>window.innerHeight?Math.max(10,rect.top-height-8):rect.bottom+8}px`;
}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3500);}
let syncTimer;
function cloudStatus(){return cloud.busy?'同期中…':state.cloudError?`エラー：${esc(state.cloudError)}`:cloud.user?`ログイン中：${esc(cloud.user.email||'アカウント')} · 最終同期 ${esc(cloud.lastSync?.replace('T',' ').slice(0,16)||'まだありません')}`:cloud.client?'未ログイン':'クラウド未設定';}
let observedCloudUser=null,observedCloudReady=false;
cloud.onChange(()=>{const id=cloud.user?.id||null,ready=!!cloud.client,changed=id!==observedCloudUser||ready!==observedCloudReady;
 if(id&&id!==observedCloudUser)scheduleCloudSync();observedCloudUser=id;observedCloudReady=ready;
 if(changed&&state.data){
  if((!id||!META_ENABLED)&&state.view==='community'){state.view='home';render();}
  else if(state.view==='settings')render();
  else{$('#nav').innerHTML=nav();if(META_ENABLED&&state.view==='community')loadCommunity();}
 }else{const status=$('#cloud-status');if(status)status.innerHTML=cloudStatus();}});
async function runCloudSync(){if(!cloud.user||cloud.busy)return;try{state.cloudError='';const result=await cloud.sync();state.data=await service.all();if(state.view!=='record'&&!document.activeElement?.closest('form'))render();if(result.conflicts)toast(`同期完了：${result.conflicts}件の競合を更新日時で解決しました`);}catch(error){state.cloudError=error.message||'同期に失敗しました';cloud.listener();toast(state.cloudError);}}
function scheduleCloudSync(){if(!cloud.user)return;clearTimeout(syncTimer);syncTimer=setTimeout(runCloudSync,800);}
async function loadCommunity(){
 if(!META_ENABLED||!cloud.user||!cloud.client)return;const userId=cloud.user.id;state.community.loading=true;state.community.error='';if(state.view==='community')render();
 try{const api=new CommunityRepository(cloud.client);const [published,overview]=await Promise.all([api.status(),api.overview()]);if(cloud.user?.id!==userId)return;Object.assign(state.community,{published,overview,error:''});}
 catch(error){if(cloud.user?.id!==userId)return;state.community.error=error.message||'集計を取得できません';}
 finally{state.community.loading=false;if(state.view==='community')render();}
}
function theme(){const t=settings.get().theme;document.documentElement.dataset.theme=t;}
async function refresh(){state.data=await service.all();render();}
function nav(){return Object.entries(labels).filter(([key])=>key!=='community'||META_ENABLED&&cloud.user).map(([key,label])=>`<button data-nav="${key}" class="${state.view===key?'active':''}" aria-current="${state.view===key?'page':'false'}">${icon(key)}<small>${label}</small></button>`).join('');}
function render(){closeHelp();if(state.view==='community'&&(!META_ENABLED||!cloud.user))state.view='home';theme();$('#nav').innerHTML=nav();$('#content').innerHTML=({home:homeView,record:recordView,events:eventsView,decks:decksView,analysis:analysisView,community:()=>renderCommunity(state.community,!!cloud.user),settings:settingsView,help:renderHelpPage})[state.view]();window.scrollTo(0,0);}
let savedHelpPage=null;
function openHelpPage(){
 if(state.view==='help'){closeHelpPage();return;}
 const content=$('#content'),fragment=document.createDocumentFragment();
 while(content.firstChild)fragment.append(content.firstChild);
 savedHelpPage={view:state.view,fragment,scroll:window.scrollY};
 state.returnView=state.view;state.view='help';render();
}
function closeHelpPage(){
 state.view=state.returnView||'home';
 const saved=savedHelpPage;savedHelpPage=null;
 if(!saved||saved.view!==state.view||(state.view==='community'&&!cloud.user)){render();return;}
 closeHelp();theme();$('#nav').innerHTML=nav();$('#content').replaceChildren(saved.fragment);window.scrollTo(0,saved.scroll);
}
function head(k,title,sub){const topic=({OVERVIEW:'overview',RECORD:'record',EVENTS:'events','EVENT DETAIL':'events',DECKS:'decks','DECK DETAIL':'decks',SETTINGS:'settings'})[k];const art=({OVERVIEW:'home',RECORD:'record',EVENTS:'events','EVENT DETAIL':'events',DECKS:'decks','DECK DETAIL':'decks',ANALYSIS:'analysis',SETTINGS:'settings'})[k];return `<div class="page-head illustrated"><div class="page-head-copy"><div class="eyebrow">${k}</div><h1>${title}${topic?helpButton(topic):''}</h1><p>${sub}</p></div>${art?`<img class="page-art" src="./assets/${art}.svg" alt="" loading="lazy" decoding="async">`:''}</div>`;}
function statCard(title,s){return `<div class="stat-card"><div class="eyebrow">${title}</div><div class="big">${s.rate}</div><div class="muted">${s.total}戦 · ${s.win}勝 ${s.loss}敗 ${s.draw}分</div></div>`;}
function pill(result){return `<span class="pill ${result==='WIN'?'win':result==='DRAW'?'draw':'loss'}">${{WIN:'WIN',LOSS:'LOSS',DRAW:'DRAW',DOUBLE_LOSS:'両敗'}[result]||result}</span>`;}
function battleSortControl(key){return `<label class="battle-sort" for="battle-sort-${key}">並び順<select id="battle-sort-${key}" data-battle-sort="${key}">${BATTLE_SORT_OPTIONS.map(([value,label])=>option(value,label,state.battleSort[key])).join('')}</select></label>`;}
function battleRow(m){return `<button class="list-row" data-detail="${m.id}"><span class="list-icon">${icon('record')}</span><span class="grow"><b>${esc(nameOf(state.data.decks,m.deckId))} <span class="muted">vs</span> ${esc(m.opponentDeckName)}</b><small>${battleDate(m)} · ${esc(battleEvent(m))} · ${m.format}</small></span>${pill(m.result)}<span class="chevron">›</span></button>`;}
function deckBattleRows(deckId){const rows=sortBattles(state.data.matches.filter(m=>m.deckId===deckId),state.battleSort.deck);return rows.map(battleRow).join('')||'<div class="empty">このデッキの対戦記録はありません。</div>';}
function homeView(){const d=state.data,month=today().slice(0,7),recent=sortDate(d.matches),monthly=recent.filter(m=>m.playedAt.slice(0,7)===month),s=stats(monthly.filter(m=>m.format==='MATCH'),d.games.filter(g=>monthly.some(m=>m.id===g.matchId)));const latestDeck=recent[0],event=sortDate(d.events)[0],history=sortBattles(d.matches,state.battleSort.home);return `${head('OVERVIEW','戦績を、次の一手へ。','対戦直後の記録から、自分の傾向を見つける。')}<div class="section-title"><h2>今月の記録${helpButton('results')}</h2><span>${month}</span></div><div class="stats-grid">${statCard('MATCH 勝率',s.matches)}${statCard('GAME 勝率',s.games)}</div><button class="primary wide" data-nav="record">＋ 対戦を記録</button><div class="section-title"><h2>最近の使用デッキ</h2></div><div class="card media-card"><img src="./assets/decks.svg" alt="" loading="lazy"> <div>${latestDeck?`<b>${esc(nameOf(d.decks,latestDeck.deckId))}</b><p class="muted">${esc(d.deckVersions.find(v=>v.id===latestDeck.deckVersionId)?.label||'レシピ未登録')} · 最終使用 ${date(latestDeck.playedAt)}</p>`:'まだ対戦記録がありません。'}</div></div><div class="section-title"><h2>最近のイベント</h2><button class="link" data-nav="events">すべて見る ›</button></div><div class="card media-card"><img src="./assets/events.svg" alt="" loading="lazy"><div>${event?`<b>${esc(event.name)}</b><p class="muted">${date(event.date)} · ${esc(event.venue||'店舗未設定')}</p>`:'イベントは未登録です。'}</div></div><div class="section-title"><h2>対戦履歴</h2></div>${battleSortControl('home')}<div id="battle-list-home">${history.length?history.slice(0,8).map(battleRow).join(''):'<div class="empty">デッキを登録すると対戦を記録できます。</div>'}</div>`;}
const option=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
const select=(name,items,selected,first='選択してください')=>`<select name="${name}" id="${name}">${option('',first,selected)}${items.map(x=>option(x.id,x.name||x.label,selected)).join('')}</select>`;
function comboField(kind,label,value,options){
 const placeholder=kind==='deck'?'デッキ名を入力または選択':'入力または候補を選択';
 const buttons=options.map(item=>`<button type="button" role="option" data-combo-option="${kind}" data-combo-name="${esc(item.name)}" data-combo-id="${esc(item.id||'')}"><span class="combo-option-name">${esc(item.name)}</span>${item.meta?`<small>${esc(item.meta)}</small>`:''}</button>`).join('');
 return `<div class="combo-wrap" data-combo="${kind}"><label for="${kind}">${label}</label><div class="typeahead-combo"><input name="${kind==='deck'?'deckName':'opponent'}" id="${kind}" role="combobox" aria-controls="${kind}-options" aria-expanded="false" aria-autocomplete="list" autocomplete="off" required placeholder="${placeholder}" value="${esc(value)}"><button type="button" id="${kind}-toggle" data-combo-toggle="${kind}" aria-label="${label}の候補を表示" aria-controls="${kind}-options" aria-expanded="false">⌄</button></div><div id="${kind}-options" class="opponent-options" role="listbox" hidden>${buttons||'<p class="muted">候補はまだありません。名前を入力してください。</p>'}</div><small class="combo-hint" id="${kind}-hint">入力すると候補を絞り込めます。</small></div>`;
}
function gameRow(n,g,index){
 return `<div class="game-row" data-game="${n}" data-match="${index}"><span class="game-no">G${n}</span><div class="seg">${['FIRST','SECOND'].map((value,i)=>`<button type="button" class="${(g?.turn||(n%2?'FIRST':'SECOND'))===value?'selected':''}" data-game="${n}" data-kind="turn" data-value="${value}">${i?'後攻':'先攻'}</button>`).join('')}</div><div class="seg result">${['WIN','LOSS','DRAW'].map(value=>`<button type="button" class="${g?.result===value?'selected':''}" data-game="${n}" data-kind="result" data-value="${value}">${value==='DRAW'?'分':value==='WIN'?'勝':'負'}</button>`).join('')}</div></div>`;
}
function batchGameGroup(index,format,games=[],override=''){
 return `<section class="batch-game-group" data-batch-index="${index}"><div class="batch-game-head"><h3>対戦 ${index+1}</h3><span class="batch-result">結果を選択</span>${index?`<button type="button" class="text-danger" data-remove-record aria-label="対戦 ${index+1} を削除">削除</button>`:''}</div>${Array.from({length:3},(_,i)=>`<div class="batch-game-slot" ${format==='SINGLE'&&i>0?'hidden':''}>${gameRow(i+1,games[i],index)}</div>`).join('')}<label class="batch-override">結果の手動修正<select data-game-override aria-label="対戦 ${index+1} の結果の手動修正">${option('','自動判定',override)}${['WIN','LOSS','DRAW','DOUBLE_LOSS'].map((value,i)=>option(value,['勝ち','負け','引き分け','両者敗北'][i],override)).join('')}</select></label></section>`;
}
function recordView(){
 const d=state.data,m=d.matches.find(x=>x.id===state.editing),last=lastUsedRecord(d.matches),previous=m?null:last;
 const turns=previous?gamesFor(previous.id):[],gs=m?gamesFor(m.id):turns.map(g=>({turn:g.turn}));
 const format=m?.format||previous?.format||'MATCH',dateDefaults=recordDateDefaults(m,previous);
 const preferred=m?.deckId||previous?.deckId||d.decks[0]?.id||'';
 const deck=d.decks.find(x=>x.id===preferred),versions=deck?versionsForDeck(d.deckVersions,deck.id):[];
 const legacyUnversioned=!!m&&m.deckId===deck?.id&&!m.deckVersionId&&versions.length>0;
 const versionId=legacyUnversioned?'':m?.deckVersionId||versions.find(v=>v.id===previous?.deckVersionId)?.id||versions[0]?.id||'';
 const deckOptions=sortedDecks(d.decks).map(x=>({id:x.id,name:x.name,meta:`${d.deckVersions.filter(v=>v.deckId===x.id).length}版 · ${regulationName(x.regulationId)}`}));
 const opponentOptions=opponentNames(d.matches).map(name=>({name}));
 const eventChoices=sortDate(d.events).map(e=>({...e,name:eventOptionLabel(e)}));
 const count=m?1:state.bulkCount;
 return `${head('RECORD',m?'記録を編集':'対戦を記録','デッキ名と結果を入力。未登録のデッキも記録できます。')}
 <form id="record-form"><div class="card form-card">
 <div class="field-grid record-meta-grid"><label>対戦日<input name="date" type="date" required value="${esc(dateDefaults.date)}"></label><label>形式<select name="format" id="format">${option('MATCH','MATCH',format)}${option('SINGLE','SINGLE',format)}</select></label></div>
 ${comboField('deck','使用デッキ',deck?.name||'',deckOptions)}<input type="hidden" name="deckId" id="deckId" value="${esc(deck?.id||'')}">
 <label>使用バージョン<select name="deckVersionId" id="deckVersionId" ${versions.length?'':'disabled'}>${versions.length?(legacyUnversioned?option('','対戦当時はレシピ未登録',''):'')+versions.map(v=>option(v.id,v.label,versionId)).join(''):option('','レシピ未登録（選択不要）','')}</select></label>
 <small class="muted" id="deck-version-hint">${versions.length?`${versions.length}件のレシピから選択できます。`:'レシピがないデッキも版なしで保存できます。'}</small>
 ${comboField('opponent','相手デッキ',m?.opponentDeckName||'',opponentOptions)}
 <div class="help-field-title"><label for="eventId">イベント</label>${helpButton('recordEvent')}</div>${select('eventId',eventChoices,m?.eventId||previous?.eventId,'フリー対戦（イベントなし）')}
 </div><div class="section-title"><h2>GAME RESULTS${helpButton('games')}</h2><span id="live-result"></span></div>
 <div id="games" class="card form-card ${count>1?'multi':''}">${Array.from({length:count},(_,i)=>batchGameGroup(i,format,i===0?gs:[],i===0&&m?.resultSource==='manual'?m.result:'')).join('')}</div>
 ${m?'':`<button type="button" class="secondary wide" id="add-record" ${count>=50?'disabled':''}>＋ 対戦を追加</button><small class="muted" id="batch-hint" ${count>1?'':'hidden'}>日付・形式・デッキ・相手・イベント・タグ・メモは全件共通です。GAMEと結果の手動修正は対戦ごとに指定します。</small>`}
 <div class="card form-card"><small class="muted">結果の手動修正は各対戦のGAME欄にあります。ET・EDや投了などの特殊裁定に使用します。</small>
 <label>タグ <span class="muted">任意・カンマ区切り</span><input name="tags" list="tags-list" placeholder="事故, ET" value="${esc(m?.tags?.join(', ')||'')}"><datalist id="tags-list">${d.tags.map(t=>`<option value="${esc(t.name)}">`).join('')}</datalist></label>
 <label>対戦メモ <span class="muted">任意</span><textarea name="notes" rows="3" placeholder="気づいたことを短く残す">${esc(m?.notes||'')}</textarea></label></div>
 <button class="primary wide" type="submit">${m?'変更を保存':count>1?`${count}件の対戦をまとめて保存`:'対戦を保存'}</button>${m?'<button type="button" class="secondary wide" data-cancel-edit>編集をやめる</button>':''}</form>
 ${m?'':`<details class="card form-card" id="calculator-import"><summary>＋ ライフ計算ツールの戦績CSVを取り込む</summary><div class="help-caption">${helpButton('calculatorCsv')}</div><p class="muted small">計算ツールの戦績CSVを選び、対戦ごとに使用デッキ・相手デッキ・イベントを入力します。ライフ変動は取り込みません。</p><label class="file-btn">CSVを選択<input type="file" id="calculator-csv-file" accept=".csv,text/csv"></label></details>`}`;
}
function field(label,name,value='',attrs=''){return `<label>${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;}
function eventFields(e={},venues=[]){return `<div class="help-caption">イベント登録 ${helpButton('events')}</div>${field('イベント名','name',e.name||'','required placeholder="例：ランキングデュエル"')}<div class="field-grid event-meta-grid">${field('開催日','date',e.date||today(),'type="date" required')}${field('店舗','venue',e.venue||'','list="venues" placeholder="店舗名を選択または入力"')}<datalist id="venues">${venues.map(v=>`<option value="${esc(v)}">`).join('')}</datalist></div>${regulationSelect(e.id?(e.regulationId||''):null,e.date||today())}<label>使用デッキ${select('deckId',state.data.decks,e.deckId||null,'未指定')}</label><div class="field-grid">${field('順位','rank',e.rank||'','placeholder="例：4位"')}${field('参加人数','participants',e.participants||'','type="number" min="1"')}</div><label>メモ<textarea name="notes" rows="2">${esc(e.notes||'')}</textarea></label>`;}
function eventsView(){const d=state.data;if(state.eventDetail){const e=d.events.find(x=>x.id===state.eventDetail);if(!e){state.eventDetail=null;return eventsView();}const eventMatches=d.matches.filter(m=>m.eventId===e.id),rows=sortBattles(eventMatches,state.battleSort.event),roundNumbers=new Map(sortBattles(eventMatches,'oldest').map((m,i)=>[m.id,i+1])),venues=[...new Set(d.events.map(x=>x.venue?.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')),s=stats(rows.filter(m=>m.format==='MATCH'),d.games.filter(g=>rows.some(m=>m.id===g.matchId)));return `<button class="back" data-back="events">‹ イベント一覧</button>${head('EVENT DETAIL',esc(e.name),`${date(e.date)}${e.venue?' · '+esc(e.venue):''}`)}<div class="stats-grid">${statCard('MATCH',s.matches)}${statCard('GAME',s.games)}</div>${state.editingEvent?`<div class="card form-card"><h2>イベント内容を編集</h2><form id="event-edit-form" data-event="${e.id}">${eventFields(e,venues)}<button class="primary wide">変更を保存</button><button type="button" class="secondary wide" data-cancel-event-edit>キャンセル</button></form></div>`:`<div class="card"><p>店舗　${esc(e.venue||'—')}</p><p>レギュレーション　${esc(regulationName(e.regulationId))}</p><div class="event-deck-link"><img src="./assets/decks.svg" alt="" loading="lazy"><span>使用デッキ<br><b>${esc(nameOf(d.decks,e.deckId))}</b></span>${e.deckId&&d.decks.some(deck=>deck.id===e.deckId)?`<button type="button" class="secondary" data-event-deck="${e.deckId}">${icon('decks')} レシピを確認</button>`:''}</div><p>順位　${esc(e.rank||'—')} / ${esc(e.participants||'—')}名</p>${e.notes?`<p class="prewrap">${esc(e.notes)}</p>`:''}<button type="button" class="secondary" data-edit-event>イベントを編集</button></div>`}<div class="section-title"><h2>ラウンド</h2><span>${rows.length}件</span></div>${battleSortControl('event')}<div id="battle-list-event">${rows.map(m=>`<div class="round"><span>R${roundNumbers.get(m.id)}</span>${battleRow(m)}</div>`).join('')||'<div class="empty">記録はありません。</div>'}</div>`;}
const venues=[...new Set(d.events.map(e=>e.venue?.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')),selected=state.eventVenue,filteredEvents=d.events.filter(e=>!selected||e.venue===selected),venueMatches=selected?sortBattles(d.matches.filter(m=>d.events.some(e=>e.id===m.eventId&&e.venue===selected)),state.battleSort.venue):[];return `${head('EVENTS','イベント','大会単位で対戦をまとめる。')}<details class="card form-card" id="event-create"><summary>＋ イベントを登録</summary><form id="event-form">${eventFields({},venues)}<button class="primary wide">イベントを保存</button></form></details><div class="card form-card"><label>店舗で対戦履歴を探す<select id="event-venue">${option('','すべての店舗',selected)}${venues.map(v=>option(v,v,selected)).join('')}</select></label></div>${selected?`<div class="section-title"><h2>${esc(selected)}での対戦</h2><span>${venueMatches.length}件</span></div>${battleSortControl('venue')}<div id="battle-list-venue">${venueMatches.map(battleRow).join('')||'<div class="empty">対戦記録はありません。</div>'}</div>`:''}<div class="section-title"><h2>登録済み</h2><span>${filteredEvents.length}件</span></div>${sortDate(filteredEvents).map(e=>`<button class="list-row" data-event="${e.id}"><span class="list-icon">${icon('events')}</span><span class="grow"><b>${esc(e.name)}</b><small>${date(e.date)} · ${esc(regulationName(e.regulationId))} · ${esc(e.venue||'店舗未設定')} · ${d.matches.filter(m=>m.eventId===e.id).length}戦</small></span><span class="chevron">›</span></button>`).join('')||'<div class="empty empty-illustrated"><img src="./assets/events.svg" alt="">イベントは未登録です。</div>'}`;}
function recipeForm({id='',cards={}}={}){const total=z=>cards[z]?.reduce((n,c)=>n+c.count,0)||0;return `<form id="version-form" data-deck="${id}"><div class="help-caption">レシピ入力 ${helpButton('decks')}</div>${field('バージョン名','version',today(),'required placeholder="例：2026.09.24"')}<small class="muted">1行ずつ「枚数《カード名》」を入力します。入力した順番で表示します。</small>${['main','extra','side'].map(z=>`<label>${z.toUpperCase()}<textarea name="${z}" rows="4" placeholder="1《烙印融合》">${esc(formatCards(cards[z]))}</textarea></label>`).join('')}<div class="recipe-counts" role="status">編集中の枚数：MAIN ${total('main')} / EXTRA ${total('extra')} / SIDE ${total('side')}</div><button class="primary wide">${id?'新バージョンを保存':'デッキとレシピを登録'}</button></form>`;}
function pdfPicker(){return `<label class="file-btn">公式サイト発行PDFから読み込む<input id="deck-pdf-file" type="file" accept=".pdf,application/pdf"></label>`;}
function pdfPreview(draft){return draft?`<div class="import-preview"><b>読み込み結果を確認してください</b><small>${esc(draft.filename)} · PDF読取時 MAIN ${draft.totals.main} / EXTRA ${draft.totals.extra} / SIDE ${draft.totals.side}</small>${draft.warnings.length?`<div class="import-warning">${draft.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div>`:''}<p>カード名・枚数を確認し、必要なら下の欄を修正して保存してください。PDF自体は保存しません。</p></div>`:'';}
function recipeChanges(previous,diff){
 if(!previous)return '<p class="muted small recipe-first">初版 · 比較対象の版はありません。</p>';
 if(!diff.total)return `<div class="recipe-diff"><b>前版「${esc(previous.label)}」からの変更</b><p class="muted small">カード構成の変更はありません。</p></div>`;
 const zoneLabel={main:'MAIN',extra:'EXTRA',side:'SIDE'};
 return `<div class="recipe-diff"><b>前版「${esc(previous.label)}」からの変更</b><p class="muted small">追加 ${diff.added}枚 · 削除 ${diff.removed}枚 · 変更したカード ${diff.total}種</p><p class="muted small recipe-diff-legend">青は増加、赤は減少です。変動枚数にかかわらず同じ色で表示します。</p>${RECIPE_ZONES.filter(zone=>diff.zones[zone].length).map(zone=>`<div class="recipe-diff-zone"><strong>${zoneLabel[zone]}</strong>${diff.zones[zone].map(c=>{
  const amount=c.before===0?`追加 +${c.after}枚`:c.after===0?`削除 −${c.before}枚`:`${c.before} → ${c.after}枚（${c.delta>0?'+':''}${c.delta}）`;
  const direction=c.delta>0?'up':'down';
  return `<div class="recipe-diff-row delta-${direction}"><span>${esc(c.name)}</span><em class="${c.delta>0?'plus':'minus'}">${amount}</em></div>`;}).join('')}</div>`).join('')}</div>`;
}
function decksView(){const d=state.data;if(state.deckDetail){const deck=d.decks.find(x=>x.id===state.deckDetail);if(!deck){state.deckDetail=null;return decksView();}const ascending=orderVersions(d.deckVersions.filter(v=>v.deckId===deck.id)),versions=[...ascending].reverse(),draft=state.pdfDraft?.deckId===deck.id?state.pdfDraft:null;
 const matches=d.matches.filter(m=>m.deckId===deck.id),matchIds=new Set(matches.map(m=>m.id)),games=d.games.filter(g=>matchIds.has(g.matchId));
 const totals=stats(matches.filter(m=>m.format==='MATCH'),games),single=stats(matches.filter(m=>m.format==='SINGLE'),[]).matches;
 return `<button class="back" data-back="${state.originEvent?'event-detail':'decks'}">‹ ${state.originEvent?'イベント詳細':'デッキ一覧'}</button>${head('DECK DETAIL',esc(deck.name),`レギュレーション ${esc(regulationName(deck.regulationId))} · レシピのバージョン履歴`)}<div class="section-title"><h2>このデッキの戦績${helpButton('results')}</h2><span>${matches.length}件</span></div><div class="stats-grid">${statCard('MATCH 勝率',totals.matches)}${statCard('GAME 勝率',totals.games)}</div><div class="card single-stat"><div class="metric-row"><span>SINGLE<small>${single.total}戦 · ${single.win}勝 ${single.loss}敗 ${single.draw}分</small></span><b>${single.rate}</b></div></div><div class="section-title"><h2>レシピ履歴${helpButton('history')}</h2><span>${versions.length}版</span></div>${versions.length?'':`<div class="card empty">レシピはまだありません。下からこのデッキの新バージョンを作成できます。</div>`}${versions.map(v=>{const previous=ascending[ascending.findIndex(x=>x.id===v.id)-1],diff=recipeDiff(previous,v);return `<details class="card recipe" ${state.focusVersion===v.id?'open':''}><summary><b>${esc(v.label)}</b><small>${date(v.createdAt)} · ${!previous?'初版':diff.total?`+${diff.added} / −${diff.removed}枚 · ${diff.total}種変更`:'変更なし'}</small></summary>${recipeChanges(previous,diff)}${['main','extra','side'].map(z=>`<div class="recipe-zone"><b>${z.toUpperCase()} <span>${v.cards[z]?.reduce((n,c)=>n+c.count,0)||0}</span></b>${(v.cards[z]||[]).map(c=>`<button type="button" class="recipe-card-link" data-card-search="${esc(c.name)}" title="このカードを採用したデッキを探す">${c.count}《${esc(c.name)}》</button>`).join('')||'<p class="muted">未登録</p>'}</div>`).join('')}<div class="recipe-actions"><button type="button" class="secondary" data-copy-version="${v.id}">このレシピから新バージョン作成</button><button type="button" class="danger" data-delete-version="${v.id}" aria-label="${esc(v.label)}を削除">この版を削除</button></div></details>`;}).join('')}<details class="card form-card" id="new-version" ${state.source||draft?'open':''}><summary>＋ 新バージョンを作成</summary>${pdfPicker()}${pdfPreview(draft)}${recipeForm({id:deck.id,cards:draft?.cards||d.deckVersions.find(v=>v.id===state.source)?.cards||{}})}</details><div class="section-title"><h2>対戦履歴</h2><span>${matches.length}件</span></div>${battleSortControl('deck')}<div id="battle-list-deck">${deckBattleRows(deck.id)}</div>`;}
const draft=state.pdfDraft?.deckId===null?state.pdfDraft:null,searchResults=searchDecksByCard(d.decks,d.deckVersions,state.cardSearch),suggestions=cardSuggestions(d.deckVersions,state.cardSearch),hitCount=searchResults.reduce((sum,row)=>sum+row.hits.length,0);return `${head('DECKS','使用デッキ','構築変更ごとにレシピを保存。')}<details class="card form-card" id="deck-create" ${draft?'open':''}><summary>＋ デッキを登録 / PDFから取り込む</summary>${pdfPicker()}${pdfPreview(draft)}<form id="deck-form">${field('デッキ名','name',draft?.suggestedName||'','required placeholder="例：烙印"')}${regulationSelect(null,today())}${recipeForm({cards:draft?.cards||{}}).replace('<form id="version-form" data-deck="">','<div>').replace('</form>','</div>')}</form></details><div class="card form-card"><div class="suggest-field"><div class="help-field-title"><label for="deck-card-search">採用カードでデッキを検索</label>${helpButton('cardSearch')}</div><input id="deck-card-search" type="search" role="combobox" aria-controls="deck-card-options" aria-expanded="${!!state.cardSearch&&!!suggestions.length&&!state.cardSuggestionClosed}" aria-autocomplete="list" autocomplete="off" value="${esc(state.cardSearch)}" placeholder="カード名を入力"><div id="deck-card-options" class="search-suggestions" role="listbox" ${state.cardSearch&&suggestions.length&&!state.cardSuggestionClosed?'':'hidden'}>${suggestions.slice(0,20).map(name=>`<button type="button" role="option" data-card-suggestion="${esc(name)}">${esc(name)}</button>`).join('')}</div></div><small class="muted" role="status">${state.cardSearch?`一致：${searchResults.length}デッキ・${hitCount}採用箇所`:`登録済み：${searchResults.length}デッキ`}</small><small class="muted">MAIN・EXTRA・SIDEの全バージョンを対象に検索します。</small></div><div id="deck-search-results"><div class="section-title"><h2>登録済み</h2><span>${searchResults.length}種</span></div>${searchResults.map(({deck,hits})=>`<button class="list-row ${d.deckVersions.some(x=>x.deckId===deck.id)?'':'deck-no-recipe'}" data-deck-detail="${deck.id}"><span class="list-icon">${icon('decks')}</span><span class="grow"><b>${esc(deck.name)}</b>${d.deckVersions.some(x=>x.deckId===deck.id)?'':'<span class="deck-unregistered">レシピ未登録</span>'}<small>${esc(regulationName(deck.regulationId))} · ${d.deckVersions.filter(x=>x.deckId===deck.id).length}バージョン · ${d.matches.filter(x=>x.deckId===deck.id).length}戦${state.cardSearch?` · ${hits.map(({version,zone,card})=>`${esc(version.label)} ${zone.toUpperCase()} ${card.count}《${esc(card.name)}》`).join(' / ')}`:''}</small></span><span class="chevron">›</span></button>`).join('')||`<div class="empty">${state.cardSearch?'該当するカードを採用したデッキはありません。':'デッキを登録してください。'}</div>`}</div>`;}
function analysisView(){return renderAnalysis(state.data,state);}
function settingsView(){const cfg=cloudConfig();return `<button class="back" data-nav="home">‹ HOME</button>${head('SETTINGS','設定','表示とデータの管理。')}<div class="card form-card"><label>外観<select id="theme">${['system','dark','light'].map((x,i)=>option(x,['SYSTEM','DARK','LIGHT'][i],settings.get().theme)).join('')}</select></label></div><div class="section-title"><h2>クラウド同期${helpButton('sync')}</h2></div><div class="card form-card"><p class="muted small">SupabaseのプロジェクトURLと公開キーを設定すると、メールでログインし、複数端末で同期できます。クラウド設定はこのブラウザに保存します。</p><form id="cloud-config-form"><label>プロジェクトURL<input name="url" type="url" required placeholder="https://xxxx.supabase.co" value="${esc(cfg?.url||'')}"></label><label>公開キー（publishable / anon）<input name="key" required autocomplete="off" placeholder="sb_publishable_..." value="${esc(cfg?.key||'')}"></label><button class="secondary wide" type="submit">接続先を保存</button></form><p class="muted" id="cloud-status" role="status">${cloudStatus()}</p>${cloud.user?`<button class="primary wide" id="cloud-sync" ${cloud.busy?'disabled':''}>今すぐ同期</button><button class="secondary wide" id="cloud-signout">ログアウト</button>`:cloud.client?`<form id="cloud-login-form"><label>メールアドレス<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button class="primary wide" type="submit">ログインメールを送信</button></form><form id="cloud-code-form"><p class="muted small">ホーム画面から開いた場合は、ログインメールに届くコードをこの画面へ入力してください。メールのリンクはSafari側で開く場合があります。</p><label>同じメールアドレス<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label>ログインコード<input name="token" inputmode="numeric" autocomplete="one-time-code" required placeholder="メールに届いたコード"></label><button class="secondary wide" type="submit">コードでログイン</button></form>`:''}<p class="muted small">ログアウトしても端末の記録は残ります。端末を共有する場合は、バックアップ後に端末データを消去してください。</p><button class="secondary wide" id="cloud-reset-device">端末データと同期履歴を消去</button></div>${!META_ENABLED?`<div class="card form-card"><h2>METAは一時停止中</h2><p class="muted small">環境集計の閲覧と新しい共有を停止しています。以前の共有データは自動では削除されません。</p>${cloud.user?'<button type="button" class="secondary wide" id="meta-withdraw-settings">以前のMETA共有を取り消す</button>':''}</div>`:''}<div class="section-title"><h2>バックアップ${helpButton('backup')}</h2></div><div class="card form-card"><p class="muted">データはこの端末のブラウザ内に保存されます。定期的にJSONを保存してください。</p><button class="secondary wide" id="export">JSONをエクスポート</button><label class="file-btn">JSONから復元<input type="file" id="import-file" accept="application/json,.json"></label><label class="file-btn">戦績CSVを取り込む<input type="file" id="csv-import-file" accept=".csv,text/csv"></label><p class="muted small">このアプリのANALYSISから出力したCSVに対応します。同じ対戦IDはスキップし、既存の記録は上書きしません。レシピ本体はCSVに含まれません。</p><p class="muted small">復元時に「上書き」または「マージ」を選べます。同じIDはインポート側を採用します。</p></div><div class="section-title"><h2>データの削除${helpButton('deleteData')}</h2></div><div class="card form-card"><p class="muted">対戦、デッキ、イベント、独自のレギュレーション、表示設定を削除します。ログイン中は次回同期時にクラウド上の記録も削除します。復元には事前のJSONバックアップが必要です。</p><button class="danger wide" id="clear-all">保存データをすべて削除</button></div>`;}
function download(content,filename,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dialog(html){let el=$('#dialog');if(!el){el=document.createElement('dialog');el.id='dialog';document.body.append(el);}el.onclick=null;el.innerHTML=html;el.showModal();return el;}
function calculatorImportDialog(csv){
 const records=parseCalculatorCsv(csv),seen=new Set(state.data.matches.map(m=>m.id)),pending=records.filter(r=>!seen.has(r.recordId));
 if(pending.length>100)throw Error('一度に取り込める対戦は100件までです。CSVを分けてください');
 const decks=state.data.decks,versions=state.data.deckVersions;
 const modal=dialog(`<h2>計算ツールの戦績を取り込む</h2><p class="muted">新規 ${pending.length}対戦 · 取込済み ${records.length-pending.length}対戦</p>${pending.length?`<p class="muted small">P1 / P2のどちらが自分か指定してください。先後と勝敗を自分側に換算します。イベントは既存のものを選ぶか、内容と会場を入力できます。</p><form id="calculator-import-form"><datalist id="calculator-decks">${decks.map(d=>`<option value="${esc(d.name)}">`).join('')}</datalist>${pending.map((r,i)=>`<fieldset class="calculator-import-row" data-record="${esc(r.recordId)}"><legend>${date(r.playedAt)} · ${r.format} · ${i+1}対戦目</legend><p class="muted small">${r.games.map(g=>`G${g.number}：P${g.firstPlayer==='p1'?1:2}先攻 · ${g.winner==='DRAW'?'引き分け':`P${g.winner==='p1'?1:2}勝ち`}`).join(' / ')}</p><div class="field-grid"><label>自分の側<select name="ownPlayer">${option('p1','P1','p1')}${option('p2','P2','p1')}</select></label><label>対戦結果の修正<select name="override">${option('','自動判定','')}${['WIN','LOSS','DRAW','DOUBLE_LOSS'].map((v,j)=>option(v,['勝ち','負け','引き分け','両者敗北'][j],'')).join('')}</select></label></div><label>使用デッキ<input name="deckName" list="calculator-decks" required autocomplete="off" placeholder="デッキ名"></label><label>使用バージョン<select name="deckVersionId"><option value="">レシピ未登録・版なし</option></select></label><label>相手デッキ<input name="opponentDeck" required placeholder="相手のデッキ名"></label><label>登録済みのイベント<select name="eventId">${option('','新規入力またはイベントなし','')}${sortDate(state.data.events.filter(e=>e.date===r.playedAt)).map(e=>option(e.id,eventOptionLabel(e),'')).join('')}</select></label><div class="field-grid"><label>イベント内容<input name="eventName" placeholder="例：ランキングデュエル"></label><label>会場・店舗<input name="venue" placeholder="例：店舗名"></label></div><label>対戦メモ <span class="muted">任意</span><textarea name="notes" rows="2"></textarea></label></fieldset>`).join('')}<div class="dialog-actions"><button type="button" class="secondary" data-close>キャンセル</button><button class="primary" type="submit">${pending.length}対戦を取り込む</button></div></form>`:'<p>すべて取込済みです。</p><div class="dialog-actions"><button class="secondary" data-close>閉じる</button></div>'}`);
 const form=modal.querySelector('#calculator-import-form');if(!form)return;
 form.addEventListener('change',event=>{
  if(event.target.name!=='eventId')return;
  const row=event.target.closest('[data-record]');
  for(const name of ['eventName','venue']){const field=row.querySelector(`[name="${name}"]`);if(event.target.value)field.value='';field.disabled=!!event.target.value;}
 });
 form.addEventListener('input',event=>{
  if(event.target.name!=='deckName')return;
  const row=event.target.closest('[data-record]'),name=event.target.value.trim(),select=row.querySelector('[name=deckVersionId]');
  const matches=decks.filter(deck=>normalizedDeckName(deck.name)===normalizedDeckName(name));
  select.innerHTML='<option value="">レシピ未登録・版なし</option>'+(matches.length===1?versions.filter(v=>v.deckId===matches[0].id).map(v=>`<option value="${esc(v.id)}">${esc(v.label)}</option>`).join(''):'');
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(cloud.busy){toast('同期終了後に操作してください');return;}
  const button=form.querySelector('[type=submit]');button.disabled=true;
  const inputs=[...form.querySelectorAll('[data-record]')].map(row=>({recordId:row.dataset.record}));
  // FormData requires a form element; collect each field in its own record group.
  inputs.forEach((item,i)=>{const row=form.querySelectorAll('[data-record]')[i];for(const el of row.querySelectorAll('[name]'))item[el.name]=el.value;});
  try{const result=await service.importCalculatorCsv(csv,inputs);modal.close();toast(`${result.imported}対戦を取り込みました`);await refresh();scheduleCloudSync();}
  catch(error){button.disabled=false;toast(error.message||'取り込めませんでした');}
 });
}
function detail(id){const m=state.data.matches.find(x=>x.id===id);if(!m)return;const v=state.data.deckVersions.find(x=>x.id===m.deckVersionId),gs=gamesFor(id);dialog(`<div class="dialog-head"><span class="eyebrow">${m.format} · ${battleDate(m)}</span><button class="icon-button" data-close aria-label="閉じる">×</button></div><h2>${esc(nameOf(state.data.decks,m.deckId))} <span class="muted">vs</span> ${esc(m.opponentDeckName)}</h2><p>${pill(m.result)} <span class="muted">${m.resultSource==='manual'?'手動判定':'自動判定'}</span></p><p class="muted">${esc(battleEvent(m))} · ${esc(v?.label||'レシピ未登録')}</p>${gs.map(g=>`<div class="metric-row"><span>GAME ${g.number} · ${g.turn==='FIRST'?'先攻':'後攻'}</span>${pill(g.result)}</div>`).join('')}${m.tags.length?`<p>${m.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</p>`:''}${m.notes?`<p class="prewrap note">${esc(m.notes)}</p>`:''}<div class="dialog-actions"><button class="secondary" data-edit="${id}">編集</button><button class="danger" data-delete="${id}">削除</button></div>`);}
function live(){
 const groups=[...document.querySelectorAll('.batch-game-group')];
 let completed=0;
 for(const group of groups){
  const games=[...group.querySelectorAll('.batch-game-slot:not([hidden]) .game-row')].map(row=>({result:row.querySelector('[data-kind=result].selected')?.dataset.value})).filter(game=>game.result);
  const manual=group.querySelector('[data-game-override]')?.value,result=manual?`手動: ${manual}`:games.length?`自動: ${resultOf(games)}`:'結果を選択';
  group.querySelector('.batch-result').textContent=result;
  if(games.length)completed++;
 }
 $('#live-result').textContent=groups.length>1?`${completed}/${groups.length}件入力済み`:groups[0]?.querySelector('.batch-result')?.textContent||'結果を選択';
}
function changeFormat(){const single=$('#format').value==='SINGLE';document.querySelectorAll('.batch-game-slot').forEach(slot=>{slot.hidden=single&&Number(slot.querySelector('.game-row').dataset.game)>1;});live();}
function updateBulkControls(){
 const container=$('#games'),groups=[...container.querySelectorAll('.batch-game-group')];
 state.bulkCount=groups.length;container.classList.toggle('multi',groups.length>1);
 groups.forEach((group,index)=>{
  group.dataset.batchIndex=String(index);
  group.querySelector('h3').textContent=`対戦 ${index+1}`;
  for(const row of group.querySelectorAll('.game-row'))row.dataset.match=String(index);
  const select=group.querySelector('[data-game-override]');select.setAttribute('aria-label',`対戦 ${index+1} の結果の手動修正`);
  const remove=group.querySelector('[data-remove-record]');if(remove)remove.setAttribute('aria-label',`対戦 ${index+1} を削除`);
 });
 const add=$('#add-record');if(add)add.disabled=groups.length>=50;
 const hint=$('#batch-hint');if(hint)hint.hidden=groups.length===1;
 $('#record-form button[type=submit]').textContent=groups.length>1?`${groups.length}件の対戦をまとめて保存`:'対戦を保存';
 live();
}
function captureRecords(form){
 const f=new FormData(form),common={date:f.get('date'),format:f.get('format'),deckName:f.get('deckName'),deckId:f.get('deckId'),deckVersionId:f.get('deckVersionId'),opponent:f.get('opponent'),eventId:f.get('eventId'),tags:f.get('tags'),notes:f.get('notes')};
 return [...form.querySelectorAll('.batch-game-group')].map(group=>({...common,override:group.querySelector('[data-game-override]').value,games:[...group.querySelectorAll('.batch-game-slot:not([hidden]) .game-row')].map(row=>({turn:row.querySelector('[data-kind=turn].selected')?.dataset.value,result:row.querySelector('[data-kind=result].selected')?.dataset.value||''}))}));
}
async function submit(form){const f=new FormData(form),id=form.id;try{if(id==='deck-form'){await service.addDeck({name:f.get('name'),regulationId:f.get('regulationId'),version:f.get('version'),main:f.get('main'),extra:f.get('extra'),side:f.get('side')});state.pdfDraft=null;toast('デッキを登録しました');state.view='decks';}else if(id==='version-form'){await service.addVersion(form.dataset.deck,Object.fromEntries(f));state.pdfDraft=null;toast('新バージョンを保存しました');state.source=null;}else if(id==='event-form'){await service.addEvent(Object.fromEntries(f));toast('イベントを登録しました');}else if(id==='event-edit-form'){await service.updateEvent(form.dataset.event,Object.fromEntries(f));state.editingEvent=false;toast('イベントを更新しました');}else if(id==='period-form'){const p=await service.addPeriod(Object.fromEntries(f));state.regulation=p.id;toast('レギュレーションを登録しました');}else if(id==='record-form'){const records=captureRecords(form);if(records.length>1){await service.saveBattles(records);toast(`${records.length}件の対戦を保存しました`);}else{await service.saveBattle(records[0],state.editing);toast('対戦を保存しました');}state.editing=null;state.bulkCount=1;state.view='home';}await refresh();scheduleCloudSync();}catch(e){toast(e.message||'保存に失敗しました');}}
document.addEventListener('submit',e=>{if(['deck-form','version-form','event-form','event-edit-form','record-form','period-form'].includes(e.target.id)){e.preventDefault();submit(e.target);}else if(e.target.id==='cloud-config-form'){e.preventDefault();try{const cfg=Object.fromEntries(new FormData(e.target));saveCloudConfig(cfg);location.reload();}catch(err){toast(err.message);}}else if(e.target.id==='cloud-login-form'){e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;cloud.sendLink(new FormData(e.target).get('email')).then(()=>{const codeEmail=$('#cloud-code-form [name=email]');if(codeEmail)codeEmail.value=e.target.elements.email.value;toast('ログインメールを送りました');}).catch(err=>toast(err.message)).finally(()=>{btn.disabled=false;});}else if(e.target.id==='cloud-code-form'){e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;const f=new FormData(e.target);cloud.verifyEmailCode(f.get('email'),f.get('token')).then(()=>toast('ログインしました。同期を開始します')).catch(err=>toast(err.message||'認証に失敗しました')).finally(()=>{btn.disabled=false;});}});
document.addEventListener('click',async e=>{const target=e.target.closest('button');if(!target)return;const d=target.dataset;
 if(d.help){showHelp(target,true);return;}
 if(target.id==='help-page-btn'){openHelpPage();return;}
 if(d.helpBack!==undefined){closeHelpPage();return;}
 if(target.id==='add-record'){const container=$('#games');if(!container||state.bulkCount>=50)return;container.insertAdjacentHTML('beforeend',batchGameGroup(state.bulkCount,$('#format').value));updateBulkControls();container.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
 if(d.removeRecord!==undefined){const container=$('#games'),group=target.closest('.batch-game-group');if(!container||!group||container.querySelectorAll('.batch-game-group').length<2)return;group.remove();updateBulkControls();return;}
 if(d.nav){if(d.nav==='community'&&(!META_ENABLED||!cloud.user))return;savedHelpPage=null;state.view=d.nav;state.editing=null;state.eventDetail=null;state.editingEvent=false;state.deckDetail=null;state.originEvent=null;state.focusVersion=null;state.source=null;render();if(META_ENABLED&&d.nav==='community')loadCommunity();return;}
 if(d.comboToggle){setComboMenu(d.comboToggle,$(`#${d.comboToggle}-options`)?.hidden,$(`#${d.comboToggle}`)?.value||'');return;}
 if(d.comboOption){$(`#${d.comboOption}`).value=d.comboName;if(d.comboOption==='deck')syncDeckVersion(d.comboId);setComboMenu(d.comboOption,false);return;}
 if(target.id==='settings-btn'){savedHelpPage=null;state.view='settings';render();return;}
 if(d.back){if(d.back==='events'){state.eventDetail=null;state.editingEvent=false;}else if(d.back==='event-detail'){state.view='events';state.eventDetail=state.originEvent;state.deckDetail=null;state.originEvent=null;state.focusVersion=null;}else {state.deckDetail=null;state.originEvent=null;state.focusVersion=null;}state.source=null;render();return;}
 if(d.detail){detail(d.detail);return;}
 if(d.event){state.eventDetail=d.event;state.editingEvent=false;render();return;}
 if(d.eventDeck){const e=state.data.events.find(x=>x.id===state.eventDetail);state.focusVersion=eventRecipeVersion(state.data.matches,e?.id,d.eventDeck);state.originEvent=e?.id||null;state.eventDetail=null;state.view='decks';state.deckDetail=d.eventDeck;render();return;}
 if(d.editEvent!==undefined){state.editingEvent=true;render();return;}
 if(d.cancelEventEdit!==undefined){state.editingEvent=false;render();return;}
 if(d.eventSuggestion){state.eventName=d.eventSuggestion;state.eventSuggestionClosed=true;render();return;}
 if(d.cardSuggestion){state.cardSearch=d.cardSuggestion;state.cardSuggestionClosed=true;render();return;}
 if(d.cardSearch){state.originEvent=null;state.focusVersion=null;state.cardSearch=d.cardSearch;state.cardSuggestionClosed=true;state.deckDetail=null;state.view='decks';render();return;}
 if(d.deckDetail){state.originEvent=null;state.focusVersion=null;state.deckDetail=d.deckDetail;render();return;}
 if(d.deleteVersion){
  const version=state.data.deckVersions.find(v=>v.id===d.deleteVersion);
  if(!version)return;
  const used=state.data.matches.filter(m=>m.deckVersionId===version.id).length;
  if(!confirm(`レシピ「${version.label}」を削除しますか？${used?` この版を使用した${used}件の対戦は、版の指定を外して残します。`:' 対戦記録は変更しません。'}削除したレシピは元に戻せません。`))return;
  target.disabled=true;
  try{const result=await service.deleteVersion(version.id);if(state.source===version.id)state.source=null;if(state.focusVersion===version.id)state.focusVersion=null;toast(`レシピを削除しました${result.unlinked?`（${result.unlinked}件の対戦を版なしに変更）`:''}`);await refresh();scheduleCloudSync();}
  catch(err){target.disabled=false;toast(err.message||'レシピを削除できませんでした');}
  return;
 }
 if(d.copyVersion){state.source=d.copyVersion;state.pdfDraft=null;render();$('#new-version')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(d.game){const group=target.closest('.seg');group.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));target.classList.add('selected');live();return;}
 if(d.close!==undefined){$('#dialog').close();return;}
 if(d.edit){$('#dialog').close();state.editing=d.edit;state.view='record';render();return;}
 if(target.id==='community-refresh'){if(META_ENABLED)await loadCommunity();return;}
 if(target.id==='meta-withdraw-settings'){
  if(!cloud.user||!cloud.client||!confirm('以前に共有したMETAのデータを削除しますか？'))return;
  target.disabled=true;
  try{const community=new CommunityRepository(cloud.client);if(await community.status()){await community.withdraw();toast('METAの共有を取り消しました');}else toast('共有中のデータはありません');}
  catch(error){toast(error.message||'共有を取り消せませんでした');}
  finally{target.disabled=false;}return;
 }
 if(target.id==='community-publish'){
  if(!META_ENABLED||!cloud.user||!cloud.client)return;let snapshot;try{snapshot=contribution(state.data);}catch(err){toast(err.message);return;}if(!confirm(`MATCH ${snapshot.matches.length}件・カード採用 ${snapshot.cards.length}件を共有します。メール・店舗・メモ・イベントは含みません。続けますか？`))return;
  target.disabled=true;try{await cloud.sync();state.data=await service.all();await new CommunityRepository(cloud.client).publish(contribution(state.data));toast('共有内容を保存しました');await loadCommunity();}catch(err){toast(err.message||'共有できませんでした');target.disabled=false;}return;
 }
 if(target.id==='community-withdraw'){
  if(!META_ENABLED||!cloud.user||!confirm('共有を取り消して集計から除外しますか？'))return;target.disabled=true;try{await new CommunityRepository(cloud.client).withdraw();toast('共有を取り消しました');await loadCommunity();}catch(err){toast(err.message||'取り消せませんでした');target.disabled=false;}return;
 }
 if(target.id==='cloud-sync'){await runCloudSync();return;}
 if(target.id==='cloud-signout'){try{await cloud.signOut();toast('ログアウトしました');await refresh();}catch(err){toast(err.message);}return;}
 if(target.id==='cloud-reset-device'){if(cloud.busy){toast('同期終了後に操作してください');return;}if(!confirm('この端末の戦績・デッキ・イベント・同期履歴をすべて削除しますか？ クラウド上のデータは残ります。先にJSONを保存してください。'))return;try{clearTimeout(syncTimer);await cloud.signOut();await repo.clearLocalAccount();state.cloudError='';state.bulkCount=1;state.view='home';toast('端末データと同期履歴を消去しました');await refresh();}catch(err){toast(err.message);}return;}
 if(d.delete){if(!confirm('この対戦記録と各ゲームを削除しますか？'))return;try{await service.deleteBattle(d.delete);$('#dialog').close();toast('記録を削除しました');await refresh();scheduleCloudSync();}catch(err){toast(err.message);}return;}
 if(d.periodSelect){state.regulation=d.periodSelect;render();window.scrollTo({top:0,behavior:'smooth'});return;}
 if(d.periodDelete){if(!confirm('このレギュレーションを削除しますか？ 対戦記録は残ります。'))return;try{await service.deletePeriod(d.periodDelete);if(state.regulation===d.periodDelete)state.regulation='';toast('レギュレーションを削除しました');await refresh();scheduleCloudSync();}catch(err){toast(err.message);}return;}
 if(d.cancelEdit!==undefined){state.editing=null;render();return;}
 if(target.id==='clear-all'){if(cloud.busy){toast('同期終了後に操作してください');return;}const modal=dialog('<h2>保存データをすべて削除</h2><p>対戦・ゲーム・デッキ・レシピ・イベント・タグ・独自のレギュレーション・表示設定を削除します。ログイン中は次回同期時にクラウド上の記録も削除されます。元には戻せません。先にJSONバックアップを保存してください。共有済みでログアウト中の場合は、先にログインして設定からMETAの共有を取り消してください。</p><div class="dialog-actions"><button class="secondary" data-close>キャンセル</button><button class="danger" id="confirm-clear-all">すべて削除する</button></div>');modal.onclick=async ev=>{if(ev.target.closest('[data-close]')){modal.close();return;}if(ev.target.id!=='confirm-clear-all')return;ev.target.disabled=true;try{if(cloud.user){const community=new CommunityRepository(cloud.client);let published;try{published=await community.status();}catch(error){if(!['PGRST205','PGRST116','42P01'].includes(error.code))throw error;}if(published)await community.withdraw();}await service.deleteAllData(settings);state.community.published=null;modal.close();state.view='home';state.period='all';state.regulation='';state.venue='';state.eventName='';state.eventSuggestionClosed=false;state.cardSuggestionClosed=false;state.eventVenue='';state.cardSearch='';state.eventDetail=null;state.editingEvent=false;state.deckDetail=null;state.originEvent=null;state.focusVersion=null;state.pdfDraft=null;state.bulkCount=1;toast('保存データをすべて削除しました');await refresh();scheduleCloudSync();}catch(err){ev.target.disabled=false;toast(err.message||'削除に失敗しました');}};return;}
 if(target.id==='export'){download(JSON.stringify(await service.exportBackup(),null,2),`ocg-record-backup-${today().replaceAll('-','')}.json`,'application/json');toast('バックアップを保存しました');}
 if(target.id==='csv-export'){const a=analyze(state.data,{key:state.period||'all',from:state.from,to:state.to,venue:state.venue,eventName:state.eventName,regulation:state.regulation});download(battlesCsv(state.data,a.matches),`ocg-record-battles-${today().replaceAll('-','')}.csv`,'text/csv;charset=utf-8');toast(`${a.matches.length}件の対戦をCSV出力しました`);}
});
document.addEventListener('change',async e=>{const t=e.target;
 if(t.dataset.battleSort){const key=t.dataset.battleSort;if(!Object.prototype.hasOwnProperty.call(state.battleSort,key)||!BATTLE_SORT_OPTIONS.some(([value])=>value===t.value))return;state.battleSort[key]=t.value;const current=$(`#battle-list-${key}`);if(key==='deck'){if(current&&state.deckDetail)current.innerHTML=deckBattleRows(state.deckDetail);return;}const updated=document.createElement('div');updated.innerHTML=key==='home'?homeView():eventsView();const next=updated.querySelector(`#battle-list-${key}`);if(current&&next)current.replaceWith(next);return;}
 if(t.id==='deck-pdf-file'&&t.files[0]){const parent=state.deckDetail?'#version-form':'#deck-form',prior={};for(const name of ['name','version']){const input=document.querySelector(`${parent} [name="${name}"]`);if(input?.value?.trim())prior[name]=input.value;}try{toast('PDFを読み取り中…');const draft=await readDeckPdf(t.files[0]);state.pdfDraft={...draft,deckId:state.deckDetail||null};state.source=null;render();for(const [name,value] of Object.entries(prior)){const input=document.querySelector(`${parent} [name="${name}"]`);if(input)input.value=value;}toast('レシピを読み込みました。内容を確認してください。');}catch(err){toast(err.message||'PDFを読み込めませんでした');}return;}
 if(t.id==='format'){changeFormat();}
 if(t.name==='date'&&t.closest('#event-form,#event-edit-form')){const p=regulationForDate(t.value,state.data.periods);$('#regulationId').value=p?.id||'';}
 if(t.matches('[data-game-override]'))live();
 if(t.id==='analysis-period'){state.period=t.value;render();}
 if(t.id==='analysis-regulation'){state.regulation=t.value;render();}
 if(t.id==='analysis-venue'){state.venue=t.value;render();}
 if(t.id==='event-venue'){state.eventVenue=t.value;render();}
 if(t.id==='period-from'||t.id==='period-to'){state[t.id==='period-from'?'from':'to']=t.value;render();}
 if(t.id==='theme'){settings.save({theme:t.value});theme();}
 if(t.id==='calculator-csv-file'&&t.files[0]){try{if(t.files[0].size>5*1024*1024)throw Error('CSVは5MB以下にしてください');calculatorImportDialog(await t.files[0].text());}catch(error){toast(error.message||'CSVを読み込めませんでした');}t.value='';return;}
 if(t.id==='csv-import-file'&&t.files[0]){
  try{
   if(t.files[0].size>5*1024*1024)throw Error('CSVは5MB以下にしてください');
   const csv=await t.files[0].text(),{summary}=planBattlesCsv(csv,state.data);
   const modal=dialog(`<h2>戦績CSVを取り込む</h2><p>新規 ${summary.imported}対戦 · 取込済み ${summary.skipped}対戦</p><p class="muted">新規デッキ ${summary.createdDecks}件 / イベント ${summary.createdEvents}件</p>${summary.unlinkedVersions?`<p class="muted">対応するレシピ版が見つからない対戦 ${summary.unlinkedVersions}件は「レシピ未登録」で取り込みます。</p>`:''}<p class="muted">既存の対戦IDはスキップします。CSVにレシピ本体・イベントの順位などは含まれません。</p><div class="dialog-actions"><button class="secondary" data-close>キャンセル</button><button class="primary" id="confirm-csv-import" ${summary.imported?'':'disabled'}>取り込む</button></div>`);
   modal.onclick=async ev=>{if(ev.target.id!=='confirm-csv-import')return;if(cloud.busy){toast('同期終了後に操作してください');return;}ev.target.disabled=true;
    try{const result=await service.importBattlesCsv(csv);modal.close();toast(`${result.imported}対戦を取り込みました`);await refresh();scheduleCloudSync();}
    catch(err){ev.target.disabled=false;toast(err.message||'CSVを取り込めませんでした');}
   };
  }catch(err){toast(err.message||'CSVを読み込めませんでした');}
  t.value='';return;
 }
 if(t.id==='import-file'&&t.files[0]){try{const data=validateBackup(JSON.parse(await t.files[0].text()));const counts=STORES.map(s=>`${s}: ${data[s].length}`).join(' / ');const modal=dialog(`<h2>バックアップを復元</h2><p class="muted">${esc(counts)}</p><p>上書きすると現在のデータを消去します。マージは同じIDのデータを読み込んだ内容で更新します。</p><div class="dialog-actions"><button class="secondary" data-import="merge">マージ</button><button class="danger" data-import="replace">上書き</button><button class="secondary" data-close>キャンセル</button></div>`);modal.onclick=async ev=>{const mode=ev.target.closest('[data-import]')?.dataset.import;if(!mode)return;try{await service.importBackup(data,mode);state.period='all';state.regulation='';modal.close();toast('復元しました');await refresh();scheduleCloudSync();}catch(err){toast(err.message||'復元に失敗しました');}};}catch(err){toast(err.message||'JSONを読み込めません');}t.value='';}
});
// Keep the active input mounted; replacing it while the IME is converting text cancels conversion.
function updateSearchView(input){
 const isCard=input.id==='deck-card-search',key=isCard?'cardSearch':'eventName',closedKey=isCard?'cardSuggestionClosed':'eventSuggestionClosed';
 if(state[key]===input.value&&!state[closedKey])return;
 state[key]=input.value;
 state[closedKey]=false;
 const fresh=document.createElement('div');
 fresh.innerHTML=isCard?decksView():analysisView();
 const optionsId=isCard?'deck-card-options':'analysis-event-options';
 const options=$('#'+optionsId),newOptions=fresh.querySelector('#'+optionsId);
 if(options&&newOptions)options.replaceWith(newOptions);
 input.setAttribute('aria-expanded',newOptions&&!newOptions.hidden?'true':'false');
 const resultsId=isCard?'deck-search-results':'analysis-results';
 const results=$('#'+resultsId),newResults=fresh.querySelector('#'+resultsId);
 if(results&&newResults)results.replaceWith(newResults);
 if(isCard){const status=input.closest('.card')?.querySelector('[role="status"]'),nextStatus=fresh.querySelector('[role="status"]');if(status&&nextStatus)status.textContent=nextStatus.textContent;}
}
document.addEventListener('compositionstart',e=>{if(e.target.matches('#deck-card-search,#analysis-event-name'))e.target.dataset.composing='true';});
document.addEventListener('compositionend',e=>{if(!e.target.matches('#deck-card-search,#analysis-event-name'))return;delete e.target.dataset.composing;updateSearchView(e.target);});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='opponent'||t.id==='deck'){if(t.id==='deck')syncDeckVersion();setComboMenu(t.id,true,t.value);return;}if(t.id==='deck-card-search'||t.id==='analysis-event-name'){
  if(e.isComposing||t.dataset.composing==='true')return;
  updateSearchView(t);
  return;
 }if(!t.matches('textarea[name="main"],textarea[name="extra"],textarea[name="side"]'))return;const form=t.closest('#deck-form,#version-form');if(!form)return;try{const count=z=>parseCards(form.querySelector(`textarea[name="${z}"]`).value).reduce((n,c)=>n+c.count,0);form.querySelector('.recipe-counts').textContent=`編集中の枚数：MAIN ${count('main')} / EXTRA ${count('extra')} / SIDE ${count('side')}`;}catch{form.querySelector('.recipe-counts').textContent='カード名と枚数の書式を確認してください。';}});
function syncDeckVersion(chosenId=''){
 const name=$('#deck')?.value||'',matches=matchingDecks(state.data.decks,name);
 const deck=chosenId?matches.find(x=>x.id===chosenId):matches.length===1?matches[0]:null;
 const hidden=$('#deckId'),select=$('#deckVersionId'),hint=$('#deck-version-hint');
 if(!hidden||!select||!hint)return;
 hidden.value=deck?.id||'';
 const versions=deck?versionsForDeck(state.data.deckVersions,deck.id):[];
 const previous=select.value;
 select.disabled=!versions.length;
 const old=state.data.matches.find(x=>x.id===state.editing),allowUnversioned=old?.deckId===deck?.id&&!old.deckVersionId;
 select.innerHTML=versions.length?(allowUnversioned?option('','対戦当時はレシピ未登録',previous):'')+versions.map(v=>option(v.id,v.label,previous&&versions.some(x=>x.id===previous)?previous:allowUnversioned?'':versions[0].id)).join(''):option('','レシピ未登録（選択不要）','');
 hint.textContent=versions.length?`${versions.length}件のレシピから選択できます。`:matches.length>1?'同名のデッキがあります。候補から選択してください。':name.trim()&&!deck?'この名前でデッキを登録して戦績を保存します。':'レシピがないデッキも版なしで保存できます。';
}
function setComboMenu(kind,show,query=''){
 const panel=$(`#${kind}-options`),input=$(`#${kind}`),toggle=$(`#${kind}-toggle`);
 if(!panel||!input||!toggle)return;
 const choices=[...panel.querySelectorAll('[data-combo-option]')],visible=new Set(suggestOpponents(choices.map(b=>b.dataset.comboName),query));
 let count=0;
 for(const b of choices){const name=b.dataset.comboName;b.hidden=!visible.has(name);if(!b.hidden){count++;const title=b.querySelector('.combo-option-name'),at=name.toLocaleLowerCase('ja').indexOf(query.toLocaleLowerCase('ja'));title.innerHTML=query&&at>=0?`${esc(name.slice(0,at))}<mark>${esc(name.slice(at,at+query.length))}</mark>${esc(name.slice(at+query.length))}`:esc(name);}}
 panel.hidden=!show;input.setAttribute('aria-expanded',String(!!show));toggle.setAttribute('aria-expanded',String(!!show));
 const hint=$(`#${kind}-hint`);if(hint&&kind==='opponent')hint.textContent=show?`${count}件の候補。候補をタップするか新しい名前を入力してください。`:'入力すると候補を絞り込めます。';
 if(show&&!count&&choices.length)panel.dataset.empty='true';else delete panel.dataset.empty;
}
document.addEventListener('focusin',e=>{if(e.target.id==='opponent'||e.target.id==='deck')setComboMenu(e.target.id,true,e.target.value);});
document.addEventListener('pointerover',e=>{if(e.pointerType==='mouse'){const button=e.target.closest?.('.help-trigger');if(button)showHelp(button);}});
document.addEventListener('pointerout',e=>{const button=e.target.closest?.('.help-trigger');if(button===activeHelp&&!button.contains(e.relatedTarget)&&!helpPinned)closeHelp();});
document.addEventListener('focusin',e=>{const button=e.target.closest?.('.help-trigger');if(button)showHelp(button);});
document.addEventListener('focusout',e=>{if(e.target===activeHelp&&!helpPinned)closeHelp();});
document.addEventListener('click',e=>{if(activeHelp&&!e.target.closest('.help-trigger,#help-popover'))closeHelp();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeHelp){closeHelp();e.preventDefault();}});
window.addEventListener('scroll',()=>{if(activeHelp)closeHelp();},{passive:true});
document.addEventListener('click',e=>{if(!e.target.closest('.combo-wrap'))for(const kind of ['opponent','deck'])setComboMenu(kind,false);});
document.addEventListener('keydown',e=>{const kind=e.target.closest('.combo-wrap')?.dataset.combo;if(!kind)return;if(e.target.id===kind&&e.key==='ArrowDown'){setComboMenu(kind,true,e.target.value);$(`#${kind}-options`)?.querySelector('button:not([hidden])')?.focus();e.preventDefault();}if(e.key==='Escape'){setComboMenu(kind,false);$(`#${kind}`)?.focus();}});
try{await repo.ready;await refresh();if(cloudConfig())cloud.connect().then(()=>{if(cloud.user)scheduleCloudSync();}).catch(err=>{state.cloudError=err.message;cloud.listener();});window.addEventListener('online',scheduleCloudSync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleCloudSync();});}catch(e){$('#content').innerHTML=`<div class="empty">データベースを開けません。ブラウザのプライベートモードやストレージ設定をご確認ください。<br>${esc(e.message)}</div>`;}

// GitHub Pages のサブパスをスコープにして、ホーム画面からの起動とオフライン起動を可能にする。
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
