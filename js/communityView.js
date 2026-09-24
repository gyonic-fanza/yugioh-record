const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const listing=(rows,render)=>rows?.length?rows.map(render).join(''):'<div class="card empty">まだ表示できる集計がありません。各分類に5人以上の共有が集まると表示されます。</div>';
const row=(label,detail,value)=>`<div class="metric-row community-row"><span>${esc(label)}<small>${esc(detail)}</small></span><b>${esc(value)}</b></div>`;
export function renderCommunity(state,loggedIn){
 const h='<div class="page-head illustrated"><div class="page-head-copy"><div class="eyebrow">COMMUNITY</div><h1>みんなの環境</h1><p>共有された対戦・レシピから傾向を読む。</p></div><img class="page-art" src="./assets/analysis.svg" alt="" loading="lazy"></div>';
 if(!loggedIn)return h+'<div class="card">閲覧と共有にはクラウドへのログインが必要です。<button class="secondary wide" data-nav="settings">設定を開く</button></div>';
 const update=`<button class="secondary wide" id="community-refresh">集計を更新</button>`;
 if(state.loading)return h+'<div class="card">集計を読み込んでいます…</div>';
 if(state.error)return h+`<div class="card"><p>${esc(state.error)}</p><small class="muted">Phase 4のSQLを適用後、集計を更新してください。</small>${update}</div>`;
 const a=state.overview||{},active=!!state.published;
 const sharing=`<div class="card form-card"><h2>自分の記録の共有</h2><p class="muted">共有は手動です。直近最大1000件のMATCHの月・使用デッキ名・相手デッキ名・勝敗、各デッキの最新版レシピに含まれるカード名と区分を送信します。メール、対戦日、店舗、イベント、メモは送信しません。採用カード一覧は本人だけが読める形で保存し、ほかの人には人数をまとめた結果だけを返します。</p><p>${active?`共有中 · 最終更新 ${esc(state.published.replace('T',' ').slice(0,16))}`:'現在は共有していません'}</p><button class="primary wide" id="community-publish">${active?'共有内容を更新':'内容を確認して共有'}</button>${active?'<button class="danger wide" id="community-withdraw">共有を取り消す</button>':''}<small class="muted">戦績やレシピを編集しても自動更新されません。共有を取り消すと集計から除外されます。</small></div>`;
 return h+`<div class="card"><b>${a.contributors?`${a.contributors}人が共有`:'共有者は5人未満'}</b><p class="muted small">各行は5人以上の投稿者がいる場合のみ表示。大会の全参加者を表す統計ではなく、共有者の自己申告データです。</p>${update}</div>`+
 `<div class="section-title"><h2>対戦相手の環境シェア</h2></div><div class="card">${listing(a.environment,x=>row(x.name,`${x.contributors}人 · MATCH`,`${x.battles}戦`))}</div>`+
 `<div class="section-title"><h2>月別トレンド</h2></div><div class="card">${listing(a.trends,x=>row(`${x.month} · ${x.name}`,`${x.contributors}人`,`${x.battles}戦`))}</div>`+
 `<div class="section-title"><h2>使用デッキの推移</h2></div><div class="card">${listing(a.deckTrends,x=>row(`${x.month} · ${x.name}`,`${x.contributors}人`,`${x.battles}戦`))}</div>`+
 `<div class="section-title"><h2>デッキ間相性</h2></div><div class="card">${listing(a.matchups,x=>row(`${x.deck} vs ${x.opponent}`,`${x.contributors}人 · ${x.battles}戦 (${x.wins}勝 ${x.losses}敗 ${x.draws}分)`,`${x.battles?Math.round(x.wins/x.battles*100):0}%`))}</div>`+
 `<div class="section-title"><h2>カード採用率</h2></div><div class="card">${listing(a.adoption,x=>row(`${x.deck} · ${x.card}`,`${x.zone.toUpperCase()} · 最新レシピ · ${x.adopters}/${x.deck_users}人`,`${x.deck_users?Math.round(x.adopters/x.deck_users*100):0}%`))}</div>`+sharing;
}
