import {icon} from './icons.js';

export const HELP_SECTIONS=[
 {title:'はじめに',topics:[
  {id:'overview',title:'HOMEと対戦履歴',short:'今月の勝率と最近の記録を表示します。',details:['対戦履歴は新しい順が初期設定です。古い順・勝ちを先・負けを先・相手デッキ名順に切り替えられます。EVENTSの対戦履歴も並び替えられます。','対戦履歴をタップすると結果、各GAME、メモを確認でき、編集・削除もできます。MATCHとSINGLEは別に集計します。']},
  {id:'record',title:'対戦を記録',short:'使用デッキ、相手デッキ、先後と勝敗を入力します。',details:['MATCHは最大3GAME、SINGLEは1GAMEを記録します。未登録のデッキ名でも保存でき、あとからレシピを追加できます。','「＋ 対戦を追加」でGAME欄を増やし、不要な欄は「削除」で取り除けます。日付・形式・デッキ・相手・イベント・タグ・メモは全件で共通です。','先攻後攻・GAMEの勝敗・結果の手動修正は各対戦で個別に設定します。すべての対戦を入力してからまとめて保存します。']},
  {id:'games',title:'GAMEと対戦結果',short:'各GAMEの先後と勝敗から対戦結果を自動判定します。',details:['ET・EDや投了など、自動判定と異なる結果になった場合は、各対戦の「結果の手動修正」で個別に上書きできます。','先攻・後攻の成績は各GAMEを単位として数えます。']},
  {id:'recordEvent',title:'対戦とイベント',short:'イベントを選ばない対戦は「フリー対戦」として扱います。',details:['大会での対戦は登録済みイベントを選ぶと、イベント詳細にラウンドとして表示されます。','フリー対戦はANALYSISのイベント名検索でも絞り込めます。']},
  {id:'calculatorCsv',title:'ライフ計算ツールのCSV',short:'対応する戦績CSVをRECORDから取り込めます。',details:['対戦ごとに自分の側・使用デッキ・相手デッキ・イベントを入力します。','ライフ変動は取り込みません。同じ記録IDの取り込み済み対戦は重複登録しません。']}
 ]},
 {title:'デッキ・イベント',topics:[
  {id:'decks',title:'デッキとレシピ',short:'MAIN・EXTRA・SIDEに「1《カード名》」の形式で入力します。',details:['カードは入力した順番で表示します。公式サイト発行の対応PDFからも読み取れます。','レシピがないデッキは一覧で暗く表示します。対戦は記録でき、デッキを開いてあとから新しい版を追加できます。']},
  {id:'history',title:'レシピ履歴と削除',short:'版ごとに保存し、前の版との枚数差を確認できます。',details:['レシピを変更するときは、既存版から新しい版を作成してください。過去の版は書き換えません。','版を削除すると、使用中の対戦は残り、その版の指定だけが外れます。最後の版を削除してもデッキは残ります。']},
  {id:'cardSearch',title:'採用カードで検索',short:'カード名の一部から、過去の版も含めてデッキを探せます。',details:['ひらがな・カタカナは区別しません。一致したデッキ数と、全レシピ版の採用箇所数を表示します。','レシピ内のカードをタップしても、そのカード名で検索できます。']},
  {id:'events',title:'イベントと店舗',short:'開催日・店舗などを登録し、対戦をイベント単位でまとめます。',details:['イベント詳細で店舗・レギュレーション・順位・メモを編集できます。','店舗で絞ると、その店舗に紐付く対戦を探せます。']}
 ]},
 {title:'分析・データ管理',topics:[
  {id:'analysis',title:'ANALYSISの絞り込み',short:'期間・レギュレーション・店舗・イベント名で成績を絞り込みます。',details:['イベント名は部分一致で候補が表示され、ひらがな・カタカナを区別しません。「フリー対戦」でも検索できます。','CSV出力には現在の絞り込み条件が適用されます。']},
  {id:'results',title:'勝率と集計の見方',short:'MATCH、GAME、SINGLEを別々に表示します。',details:['MATCH勝率はMATCH形式の対戦数、GAME勝率は記録された各GAME数を分母にします。SINGLEはMATCHに含めず、GAMEには含めます。','5 MATCH未満の項目には母数が少ないことを示す表示が付きます。']},
  {id:'meta',title:'META（みんなの環境）',short:'現在、META機能は一時停止中です。',details:['環境集計の閲覧と新規共有は利用できません。以前の共有データは自動では削除されません。','過去の共有を取り消したい場合は、クラウドにログインして設定画面から操作できます。']},
  {id:'settings',title:'設定',short:'外観・クラウド同期・バックアップを管理します。',details:['外観はSYSTEM・DARK・LIGHTから選べます。端末内の記録はオフラインでも利用できます。']},
  {id:'sync',title:'クラウド同期',short:'設定したSupabaseへログインすると複数端末で同期できます。',details:['まず端末に保存し、通信が使えるときに同期します。ログアウトしても端末内の記録は残ります。','異なるアカウントに切り替えるときはJSONを保管し、設定から端末データと同期履歴を消去してください。']},
  {id:'backup',title:'バックアップと戦績CSV',short:'JSONにはレシピを含む全データ、戦績CSVには対戦記録を保存します。',details:['端末の紛失やブラウザのデータ削除に備え、定期的にJSONをエクスポートしてください。','ANALYSISから出力した戦績CSVは設定から取り込めます。レシピ本体はCSVに含まれません。']},
  {id:'deleteData',title:'データを削除',short:'全削除の前にJSONバックアップを保存してください。',details:['全削除は対戦・デッキ・イベントなどを端末から消します。ログイン中は次回同期時にクラウド側にも反映されます。','METAの共有を取り消したい場合は、ログインした状態で共有取り消しを先に行ってください。']}
 ]}
];
export const HELP_TOPICS=Object.fromEntries(HELP_SECTIONS.flatMap(section=>section.topics.map(topic=>[topic.id,topic])));
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function helpButton(id){
 const topic=HELP_TOPICS[id];if(!topic)throw Error(`Unknown help topic: ${id}`);
 return `<button type="button" class="help-trigger" data-help="${id}" aria-label="${esc(topic.title)}のヘルプ" aria-controls="help-popover" aria-expanded="false">${icon('help')}</button>`;
}
export function renderHelpPage(){
 return `<button type="button" class="back" data-help-back>‹ 前の画面に戻る</button><div class="page-head illustrated"><div class="page-head-copy"><div class="eyebrow">HELP</div><h1>使い方・ヘルプ</h1><p>知りたい項目を選んでください。</p></div></div><nav class="help-index" aria-label="ヘルプの目次">${HELP_SECTIONS.map(section=>`<a href="#help-${section.topics[0].id}">${esc(section.title)}</a>`).join('')}</nav>${HELP_SECTIONS.map(section=>`<section class="help-section" aria-label="${esc(section.title)}"><div class="section-title"><h2>${esc(section.title)}</h2></div>${section.topics.map(topic=>`<details class="card help-entry" id="help-${topic.id}"><summary><span>${icon('help')} ${esc(topic.title)}</span></summary><p>${esc(topic.short)}</p>${topic.details.map(detail=>`<p>${esc(detail)}</p>`).join('')}</details>`).join('')}</section>`).join('')}`;
}
