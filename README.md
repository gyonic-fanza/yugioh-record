# OCG RECORD

遊戯王OCGの戦績を、スマートフォンで記録する静的Webアプリです。GitHub Pagesでそのまま動きます。アカウントとサーバーは不要です。

## 機能（Phase 1）

- デッキ登録、MAIN / EXTRA / SIDEのカード名と枚数、独立したレシピ版の追加・複製
- イベント登録とイベントごとの対戦一覧
- MATCH（最大3ゲーム）/ SINGLE記録。ゲーム別先後・勝敗、マッチ自動判定と手動修正、メモ・タグ、履歴の編集・削除
- HOMEの月間集計、ANALYSISの期間・デッキ・対面・ゲーム先後別の基本集計
- LIGHT / DARK / SYSTEM、全データのJSONエクスポート、上書き・マージ復元

## 起動方法

ローカルではこのディレクトリで `python3 -m http.server 8000` を実行し、`http://localhost:8000` を開きます。`file://` で直接開くとES Modulesがブラウザの制限で動かない場合があります。

## GitHub Pages

このディレクトリの中身をリポジトリのルートへ置き、GitHubの **Settings → Pages → Build and deployment → Deploy from a branch** で対象ブランチの `/ (root)` を指定します。サブパスでも動くよう全アセットを相対パスで参照しています。ビルドやAPIキーは不要です。GitHub Pagesの公開操作とURL取得はリポジトリ所有者が行います。

## データモデル

| エンティティ | 主なフィールド | 関係 |
| --- | --- | --- |
| User（将来） | id | 初期版の全レコードの `userId` は `null` |
| Event | id, userId, name, date, venue, type, deckId, rank, participants, notes | Match 1対多 |
| Match | id, userId, eventId, deckId, deckVersionId, opponentDeckName, opponentDeckId, format, playedAt, result, resultSource, notes, tags | Game 1対多。`opponentDeckId` は将来の正規化用 |
| Game | id, userId, matchId, number, turn, result | 先後・勝敗は各ゲームに属する |
| Deck | id, userId, name, type, notes | DeckVersion 1対多 |
| DeckVersion | id, userId, deckId, label, cards, notes | 保存後は内容を変更せず、新版を作る |
| DeckCard | `DeckVersion.cards.main/extra/side` 内の `{id, cardId, name, count}` | `cardId` は将来カード辞書を導入した際に使用 |
| Tag | id, userId, name | Match の `tags` に文字列配列も保持 |

各主要レコードにはUUIDと `createdAt`, `updatedAt` を保存します。Eventの日付は `date`、Matchの対戦日は `playedAt` です。MATCHとGAMEの集計母数は別々です。先後別勝率は各ゲーム単位で算出し、MATCHに先攻・後攻を割り当てません。引き分けは勝率の分母に含め、分子には含めません。両敗は敗北に含めます。相手デッキ名は自由入力です。

## 画面と主要フロー

HOME（概要・履歴）→ DECKS（デッキ・レシピ版を登録）→ EVENTS（任意で大会を登録）→ RECORD（デッキ版と相手、ゲーム別結果を記録）→ HOME / ANALYSIS（振り返り）。記録は履歴を開いて編集・削除できます。設定にはHOME右上から移動します。

## 保存とバックアップ

対戦、ゲーム、デッキ、レシピ版、イベント、タグはブラウザのIndexedDBに保存します。テーマ設定はlocalStorageです。設定の「JSONをエクスポート」でバックアップし、「JSONから復元」で上書きまたはID単位でマージできます。ブラウザのデータ削除や別端末への移動に備えてJSONを保管してください。マージ時にIDが同じレコードは読み込んだ側を採用します。レシピ版は対戦からID参照されるため、新版追加で過去のレシピは変わりません。

## ディレクトリ構造

```text
index.html
css/style.css
js/storage.js   IndexedDBRepository / SettingsRepository
js/services.js  入力検証、記録保存、集計
js/main.js      画面表示とイベント処理
README.md
```

## クラウド移行方針

UIは `AppService` を経由して保存します。`IndexedDBRepository` と同じ `list/get/put/remove/snapshot/replaceAll/merge` 契約を実装するクラウドRepositoryへ差し替えられます。ユーザー認証後に `userId` を付与し、所有者ごとのアクセス制御、同期時の `updatedAt` とIDによる競合解決、オフラインキューを追加します。カード辞書の `cardId` と相手デッキの正規化を行えば、匿名化した全体統計や採用率の集計にも拡張できます。クラウド導入時には既存JSONからの移行処理も用意します。

## 今後の範囲

Phase 2: タグ分析、デッキ版比較、グラフ、CSV、環境区分の保存と詳細分析。Phase 3: 認証と同期。Phase 4: 全体の環境統計。現バージョンのANALYSISは基本集計のみです。
