# Architecture Plan

## 1. 目的
今後の追加開発で破綻しないように、責務を分離した構成で実装する。

## 2. 設計原則
- ルールエンジンをUI/HTTP/WebSocketから分離する
- `server` と `client` で共有する型は `packages/shared` に集約する
- 1機能1フォルダを基本にし、機能単位で追加できる構造にする
- 外部I/O（HTTP, WS, ストレージ）をドメインロジックから隔離する
- 仕様変更点は `docs/` に追記し、実装と同時に更新する

## 3. 推奨フォルダ構成
```text
.
├─ apps/
│  ├─ server/
│  │  ├─ src/
│  │  │  ├─ app.ts
│  │  │  ├─ index.ts
│  │  │  ├─ config/
│  │  │  ├─ modules/
│  │  │  │  ├─ tournament/
│  │  │  │  │  ├─ api/
│  │  │  │  │  ├─ domain/
│  │  │  │  │  ├─ service/
│  │  │  │  │  └─ store/
│  │  │  │  ├─ table/
│  │  │  │  │  ├─ domain/
│  │  │  │  │  ├─ service/
│  │  │  │  │  └─ ws/
│  │  │  │  ├─ player/
│  │  │  │  └─ bot/
│  │  │  ├─ platform/
│  │  │  │  ├─ http/
│  │  │  │  └─ websocket/
│  │  │  └─ test/
│  │  └─ package.json
│  └─ client/
│     ├─ src/
│     │  ├─ app/
│     │  ├─ pages/
│     │  │  ├─ lobby/
│     │  │  ├─ table/
│     │  │  └─ result/
│     │  ├─ features/
│     │  │  ├─ tournament/
│     │  │  ├─ action/
│     │  │  ├─ spectator/
│     │  │  └─ rebuy/
│     │  ├─ shared/
│     │  └─ test/
│     └─ package.json
├─ packages/
│  └─ shared/
│     ├─ src/
│     │  ├─ protocol/
│     │  ├─ domain/
│     │  └─ utils/
│     └─ package.json
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ API_SPEC.md
│  └─ TEST_PLAN.md
└─ README.md
```

## 4. サーバー責務分割
- `modules/tournament`: トーナメント作成、進行、終了判定
- `modules/table`: 1ハンド進行、ポット管理、勝敗判定呼び出し
- `modules/player`: プレイヤー状態・接続状態管理
- `modules/bot`: Bot行動決定（戦略差し替え可能）
- `platform/http`: Honoのルーティングと入力バリデーション
- `platform/websocket`: 接続管理・イベント配信

## 5. クライアント責務分割
- `pages`: 画面単位（ロビー/テーブル/結果）
- `features`: ユースケース単位（参加、アクション、観戦、リバイ）
- `shared`: UI部品、共通hooks、API/WSクライアント

## 6. コード規約（拡張性重視）
- パスは `relative import` を深くしすぎず、`index.ts` 再エクスポートで整理
- 型は `packages/shared` を参照し、二重定義しない
- API入出力は `zod` などでスキーマ検証する
- ドメイン層はフレームワーク依存を避ける
- 状態遷移ロジックは純粋関数ベースでテスト可能に保つ

## 7. 追加開発フロー
1. `docs/API_SPEC.md` と `docs/TEST_PLAN.md` を先に更新
2. `packages/shared` に型を追加
3. `apps/server` のドメイン・サービス・APIを実装
4. `apps/client` の feature とページを実装
5. ユニット/統合/E2Eの順でテスト追加

## 8. 将来拡張の想定
- マルチテーブル化
- 永続化DB導入（メモリストア差し替え）
- Bot戦略の難易度追加
- 認証基盤（OAuth）追加
