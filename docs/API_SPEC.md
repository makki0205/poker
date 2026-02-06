# API Specification (MVP)

## 1. 基本方針
- APIバージョン: `/api/v1`
- 役割分離
  - HTTP: 作成/参加/開始/参照などのコマンドと参照
  - WebSocket: ハンド進行のリアルタイム同期
- 認証: MVPは簡易セッション（名前入力ベース）
- データ保持: メモリのみ

## 2. ドメイン前提
- 1卓固定、最大9席
- トーナメント時間: `30 | 60 | 90` 分から選択
- Bot: 作成時に人数指定して追加
- リバイ: 回数無制限
- アクション時間: 無制限（サーバー側タイムアウトなし）

## 3. 主要エンティティ
- Tournament
  - `id`, `status(waiting|running|finished)`, `durationMinutes`, `blindLevel`, `createdAt`
- SeatPlayer
  - `playerId`, `name`, `isBot`, `stack`, `status(active|busted|folded|allin|disconnected)`
- HandState
  - `handId`, `phase(preflop|flop|turn|river|showdown)`, `pot`, `board`, `currentActorId`

## 4. HTTP API

### 4.1 トーナメント作成
- `POST /api/v1/tournaments`
- request
```json
{
  "name": "Daily Tournament",
  "durationMinutes": 60,
  "maxSeats": 9,
  "startingStack": 20000,
  "botCount": 3
}
```
- constraints
  - `durationMinutes`: `30 | 60 | 90`
  - `maxSeats`: MVPは `9` 固定
  - `botCount`: `0..8`
- response `201`
```json
{
  "tournamentId": "trn_123",
  "status": "waiting"
}
```

### 4.2 トーナメント詳細取得
- `GET /api/v1/tournaments/:tournamentId`
- response `200`
```json
{
  "id": "trn_123",
  "status": "waiting",
  "durationMinutes": 60,
  "players": [],
  "spectatorCount": 0
}
```

### 4.3 プレイヤー参加
- `POST /api/v1/tournaments/:tournamentId/join`
- request
```json
{
  "name": "makki"
}
```
- response `200`
```json
{
  "playerId": "pl_1",
  "sessionId": "sess_xxx",
  "seatNo": 2
}
```

### 4.4 観戦参加
- `POST /api/v1/tournaments/:tournamentId/spectators`
- request
```json
{
  "name": "viewer01"
}
```
- response `200`
```json
{
  "spectatorId": "sp_1",
  "sessionId": "sess_yyy"
}
```

### 4.5 トーナメント開始
- `POST /api/v1/tournaments/:tournamentId/start`
- response `200`
```json
{
  "status": "running",
  "startedAt": "2026-02-06T12:00:00.000Z"
}
```

### 4.6 リバイ
- `POST /api/v1/tournaments/:tournamentId/rebuys`
- request
```json
{
  "playerId": "pl_1"
}
```
- response `200`
```json
{
  "playerId": "pl_1",
  "newStack": 20000,
  "rebuyCount": 4
}
```

### 4.7 履歴取得
- `GET /api/v1/tournaments/:tournamentId/hands?limit=20&cursor=...`
- response `200`
```json
{
  "items": [],
  "nextCursor": null
}
```

### 4.8 ヘルスチェック
- `GET /api/v1/health`
- response `200`
```json
{
  "status": "ok"
}
```

## 5. WebSocket

### 5.1 接続
- endpoint: `/ws`
- query params
  - `tournamentId`
  - `sessionId`

### 5.2 Client -> Server events

#### `player.action`
```json
{
  "type": "player.action",
  "payload": {
    "handId": "h_1",
    "playerId": "pl_1",
    "action": "fold",
    "amount": 0
  }
}
```
- `action`: `fold | check | call | bet | raise | allin`

#### `player.ping`
```json
{
  "type": "player.ping",
  "payload": {
    "ts": 1730000000000
  }
}
```

### 5.3 Server -> Client events

#### `table.snapshot`
```json
{
  "type": "table.snapshot",
  "payload": {
    "tournamentId": "trn_123",
    "status": "running",
    "table": {},
    "you": {
      "playerId": "pl_1",
      "role": "player"
    }
  }
}
```

#### `hand.started`
```json
{
  "type": "hand.started",
  "payload": {
    "handId": "h_10",
    "dealerSeat": 5,
    "blindLevel": 3
  }
}
```

#### `action.applied`
```json
{
  "type": "action.applied",
  "payload": {
    "handId": "h_10",
    "playerId": "pl_2",
    "action": "raise",
    "amount": 1200,
    "nextActorId": "pl_4"
  }
}
```

#### `hand.finished`
```json
{
  "type": "hand.finished",
  "payload": {
    "handId": "h_10",
    "winners": ["pl_2"],
    "payouts": [{ "playerId": "pl_2", "amount": 5400 }]
  }
}
```

#### `tournament.finished`
```json
{
  "type": "tournament.finished",
  "payload": {
    "tournamentId": "trn_123",
    "winnerPlayerId": "pl_2",
    "rankings": ["pl_2", "pl_7", "pl_1"]
  }
}
```

#### `error`
```json
{
  "type": "error",
  "payload": {
    "code": "INVALID_ACTION",
    "message": "Action is not allowed in current state"
  }
}
```

## 6. エラーコード
- `BAD_REQUEST`: 入力不正
- `NOT_FOUND`: tournament/playerが存在しない
- `INVALID_STATE`: 開始済みトーナメントに対する不正操作など
- `INVALID_ACTION`: 手番外アクションや金額不正
- `TABLE_FULL`: 参加満席
- `UNAUTHORIZED`: セッション不正

## 7. 仕様変更ルール
- 破壊的変更は `/api/v2` として追加
- 非破壊的変更は optional field 追加で対応
- 追加イベントは既存イベントを壊さない命名で拡張
