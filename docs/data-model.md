# データモデル設計書

最終更新: 2026-09-17 / 対象基盤: Google Apps Script + スプレッドシート（将来 Firestore 移行）

---

## 0. 設計方針

| 方針 | 理由 |
|---|---|
| 1シート = 1テーブル、1行目をヘッダー行にする | GASの `getDataRange().getValues()` でそのままオブジェクト配列に変換できる |
| **タスクと子タスクを `items` シートに統合**し `level` で区別する | GASはシートへのアクセス回数がコスト。1回の読み取りでプロジェクト配下を全取得できる |
| `items` の全行に `project_id` を持たせる（非正規化） | プロジェクト単位／担当者単位のどちらのフィルタも1シートで完結する |
| IDはUUID文字列（行番号に依存しない） | 並べ替え・削除に強く、Firestoreのドキュメントidへそのまま移行できる |
| 日付は ISO `YYYY-MM-DD` の**文字列**で統一 | スプレッドシートのDate型はタイムゾーンで1日ずれる事故が起きやすい |
| 可変項目は JSON 文字列で保持 | 列追加なしで項目を増やせる。Firestore移行時は map / array にそのまま対応 |
| 並び順は `sort_order`（100刻みの整数） | 行の物理順に依存せず、間に挿入できる |

**型の凡例**: `str`=文字列 / `int`=整数 / `num`=数値 / `bool`=TRUE/FALSE / `date`=YYYY-MM-DD / `ts`=ISO8601日時 / `json`=JSON文字列

---

## 1. ER図（論理）

```
users ------+
            +---< projects >---< items >---< items (self: parent_item_id)
templates --+        |
   |                 +-- custom_fields (JSON)
   +---< template_items (self: parent_template_item_id)
   +---< template_fields

settings      (key-value)
summary_cache (project_id -> 集計結果JSON)
```

---

## 2. テーブル定義

### 2.1 `users` ─ 利用者

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| user_id | str | ○ | | UUID。主キー |
| name | str | ○ | | 表示氏名 |
| email | str | ○ | | Googleアカウントのメール。**ログイン時の突合キー**（一意） |
| role | str | ○ | member | `admin` / `member` |
| active | bool | ○ | TRUE | FALSEなら担当者候補に出さない（過去データは保持） |
| created_at | ts | ○ | | |
| weekly_capacity_days | num | | 5 | 週の稼働（人日／5営業日）。兼務・時短は小さくする。負荷率の分母（要件 §3.6） |
| capacity_note | str | | | 稼働の補足（例：PM・営業と兼務、時短勤務） |

サンプル:

```
u_001 | 山田 太郎 | yamada@example.com | admin  | TRUE | 2026-04-01T09:00:00+09:00
u_002 | 佐藤 花子 | sato@example.com   | member | TRUE | 2026-04-01T09:00:00+09:00
```

---

### 2.2 `templates` ─ プロジェクトテンプレート

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| template_id | str | ○ | | UUID。主キー |
| name | str | ○ | | 例:「Webサイト制作」 |
| description | str | | | 用途の説明 |
| category | str | | | 分類。例: 制作 / 販促 / 開発 |
| default_duration_days | int | | 30 | 既定の全体日数（新規作成フォームの初期値） |
| active | bool | ○ | TRUE | FALSEなら新規作成の選択肢に出さない |
| created_at | ts | ○ | | |
| updated_at | ts | ○ | | |

---

### 2.3 `template_items` ─ テンプレートのタスク構成

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| template_item_id | str | ○ | | UUID。主キー |
| template_id | str | ○ | | -> templates.template_id |
| level | int | ○ | | 1=タスク / 2=子タスク |
| parent_template_item_id | str | | | level=2 のとき親タスクのID。level=1 は空 |
| sort_order | int | ○ | | 同一親内での並び順（100刻み） |
| name | str | ○ | | |
| description | str | | | |
| offset_start_days | int | ○ | 0 | **プロジェクト開始日からの相対日数**（0=初日） |
| offset_duration_days | int | ○ | 1 | 期間日数（両端含む。1=当日のみ） |
| default_role | str | | | 既定の担当ロール（作成時のアサイン候補の絞り込みに使用） |

日付の展開:

```
開始日 = プロジェクト開始日 + offset_start_days
終了日 = 開始日 + offset_duration_days - 1
```

サンプル（Webサイト制作）:

```
ti_001 | tpl_web | 1 |        | 100 | 要件定義       | 0  | 10
ti_002 | tpl_web | 2 | ti_001 | 100 | 現状調査       | 0  | 4
ti_003 | tpl_web | 2 | ti_001 | 200 | 要件ヒアリング | 4  | 3
ti_004 | tpl_web | 1 |        | 200 | デザイン       | 10 | 15
```

---

### 2.4 `template_fields` ─ テンプレートのカスタム設定項目

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| template_field_id | str | ○ | | UUID。主キー |
| template_id | str | ○ | | -> templates.template_id |
| field_key | str | ○ | | 英数字スネークケース。`projects.custom_fields` のキーになる（テンプレート内で一意） |
| label | str | ○ | | 画面上の表示名。例:「クライアント名」 |
| type | str | ○ | text | `text` / `number` / `date` / `select` / `checkbox` |
| options | json | | | type=select のときの選択肢。例: ["新規","リニューアル","保守"] |
| required | bool | ○ | FALSE | 必須入力か |
| sort_order | int | ○ | | 表示順（100刻み） |
| help_text | str | | | 入力欄の下に出す補足説明 |

サンプル:

```
tf_001 | tpl_web | client_name     | クライアント名 | text     | -                              | TRUE  | 100
tf_002 | tpl_web | contract_type   | 契約区分       | select   | ["新規","リニューアル","保守"] | TRUE  | 200
tf_003 | tpl_web | contract_amount | 契約金額(円)   | number   | -                              | FALSE | 300
tf_004 | tpl_web | has_cms         | CMS導入あり    | checkbox | -                              | FALSE | 400
```

---

### 2.5 `projects` ─ プロジェクト（第1階層）

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| project_id | str | ○ | | UUID。主キー |
| name | str | ○ | | |
| description | str | | | |
| template_id | str | | | 生成元テンプレート（参照のみ。変更は遡及しない） |
| template_name | str | | | 生成時点のテンプレート名を**コピー保持**（テンプレート削除後も表示できる） |
| owner_user_id | str | ○ | | -> users.user_id |
| status | str | ○ | not_started | `not_started` / `in_progress` / `done` / `on_hold` |
| start_date | date | ○ | | |
| end_date | date | ○ | | start_date 以上であること |
| plan_status | str | ○ | planning | `planning`（計画中）/ `fixed`（確定済み）。計画中は当初計画を持たない（§6） |
| plan_fixed_at | ts | | | 計画を確定した日時 |
| plan_fixed_by | str | | | 計画を確定した管理者 -> users.user_id |
| baseline_version | int | | | 比較の既定に使う当初計画の版（通常は最新版） |
| baseline_start_date | date | | | **当初計画の開始日**（最新版の値を持つキャッシュ。正本は `baseline_items`） |
| baseline_end_date | date | | | **当初計画の終了日**（同上） |
| baseline_set_at | ts | | | 最新版を保存した日時 |
| progress_rate | int | | | 0〜100。progress_mode=manual のときのみ使用 |
| progress_mode | str | | | `auto` / `manual` / `deadline`。**空ならシステム既定値を継承** |
| custom_fields | json | | {} | 例: {"client_name":"株式会社ABC","contract_type":"リニューアル"} |
| archived | bool | ○ | FALSE | TRUEなら一覧から除外 |
| created_at | ts | ○ | | |
| updated_at | ts | ○ | | |

---

### 2.6 `items` ─ タスク / 子タスク（第2・第3階層）

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| item_id | str | ○ | | UUID。主キー |
| project_id | str | ○ | | -> projects.project_id（**全行に保持**） |
| level | int | ○ | | 1=タスク / 2=子タスク |
| parent_item_id | str | | | level=2 のとき親タスクのitem_id。level=1 は空 |
| sort_order | int | ○ | | 同一親内での並び順（100刻み） |
| name | str | ○ | | |
| description | str | | | |
| assignee_user_id | str | | | -> users.user_id。空=未アサイン |
| status | str | ○ | not_started | `not_started` / `in_progress` / `done` / `on_hold` |
| start_date | date | | | |
| end_date | date | | | |
| baseline_start_date | date | | | 当初計画の開始日（作成時にコピー） |
| baseline_end_date | date | | | 当初計画の終了日（作成時にコピー） |
| baseline_set_at | ts | | | ベースラインを設定／引き直した日時 |
| size_key | str | | | 作業の重さ。`S` / `M` / `L` / `XL`。空=期間から自動推定 |
| estimate_hours | num | | | 予定工数（時間）。入れると size_key より優先（要件 §3.7） |
| progress_rate | int | | | 0〜100。progress_mode=manual のときのみ使用 |
| milestone_id | str | | | -> milestones.milestone_id（空＝なし） |
| label_ids | json | | [] | 付けたラベルの label_id 一覧（-> labels） |
| actual_start_date | date | | | **実績開始日**。分類が初めて進行中／保留／完了になった日を自動記録（手で修正可） |
| actual_end_date | date | | | **実績終了日**。分類が完了になった日を自動記録。完了から戻したら空に戻す（手で修正可） |
| completed_at | ts | | | status を done にした日時（実績分析用） |
| created_at | ts | ○ | | |
| updated_at | ts | ○ | | |

**期間は必ず入れる**: 親の進捗率は子の**期間日数を重み**にした加重平均で求めるため（要件 §3.2.1）、`start_date` / `end_date` が空のタスクは重み 1 として扱われ、実態より軽く見積もられる。

**重さの決まり方**: `estimate_hours` ＞ `size_key` ＞ 期間からの自動推定（3日以内=S / 7日以内=M / 20日以内=L / それ以上=XL）。どちらも空のまま運用でき、その場合は推定値が使われる（要件 §3.7）。親・プロジェクトの重さは配下の合計。

**インデックス代わりの運用**: 件数が1,000行程度のため全件読み込み＋メモリ上でフィルタする。
`project_id` 列でシートをソートしておけば、範囲読み取りへの最適化が後から可能。

---

### 2.7 `settings` ─ システム設定（key-value）

| 列 | 型 | 説明 |
|---|---|---|
| key | str | 設定キー。主キー |
| value | str | 値（数値・真偽値も文字列で保持） |
| description | str | 設定の説明 |

初期値:

```
default_progress_mode | auto       | 判定モードの既定値
threshold_at_risk     | -0.10      | この差分を下回ると「注意」
threshold_delayed     | -0.25      | この差分を下回ると「遅延」
week_range_days       | 7          | 担当者ビューの「今週」の日数
overload_threshold    | 4          | 担当者別の負荷：同時進行がこの件数以上で「多い」
weekly_capacity_days  | 5          | 週の稼働（人日）の既定値。人ごとの値は users.weekly_capacity_days
hours_per_day         | 8          | 予定工数(h)→人日 の換算
size_days             | {"S":0.5,"M":2,"L":5,"XL":10} | サイズ→人日
rollup_weight         | duration   | 親への積み上げの重み。duration=期間日数 / effort=作業の重さ
notify_reassign       | true       | お知らせ：担当になった・外れた
notify_due            | true       | お知らせ：期限の前日・当日
notify_delay          | true       | お知らせ：担当のタスクが遅延になった
notify_overload       | true       | お知らせ：担当者が稼働超過になりそう（管理者）
notify_baseline       | true       | お知らせ：計画の確定・当初計画の引き直し
timezone              | Asia/Tokyo | 日付計算の基準タイムゾーン
```

---

### 2.7b `baselines` ─ 当初計画の版

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| baseline_id | str | ○ | | UUID。主キー |
| project_id | str | ○ | | -> projects.project_id |
| version | int | ○ | | 1, 2, 3 …（プロジェクト内で連番） |
| kind | str | ○ | | `fix`（計画確定＝第1版）/ `rebase`（引き直し） |
| scope | str | ○ | all | `all`（全体）/ `items`（選んだタスクだけ） |
| item_ids | json | | [] | scope=items のとき対象の item_id 一覧 |
| reason_kind | str | ○ | | 入力ミスの訂正 / 仕様・範囲の変更 / 顧客都合の日程変更 / その他 |
| reason | str | ○ | | 具体的な理由（必須） |
| set_by | str | ○ | | 実行した管理者 -> users.user_id |
| set_at | ts | ○ | | 保存日時 |

### 2.7c `baseline_items` ─ 版ごとの当初日付（スナップショット）

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| baseline_id | str | ○ | -> baselines.baseline_id |
| item_id | str | ○ | -> items.item_id（プロジェクト自身の行は空＝プロジェクト全体の日付） |
| start_date | date | ○ | その版での当初開始日 |
| end_date | date | ○ | その版での当初終了日 |

各版は**全タスクの写し**を持つ（scope=items の版も、対象外は前の版の値をそのまま写す）。比較する版を選んだら、その版の行を `items.baseline_*` の代わりに使う。件数は「版数 × タスク数」で、1プロジェクト数十件・数版なら数百行に収まる。

---

### 2.7d `milestones` ─ マイルストーン

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| milestone_id | str | ○ | UUID。主キー |
| project_id | str | ○ | -> projects.project_id |
| name | str | ○ | 例：M1 デザインFIX |
| date | date | ○ | 期日 |
| note | str | | メモ |

状態（達成／期日超過／あと何日）は保存せず、紐づくタスク（`items.milestone_id`）から毎回求める。

### 2.7e `labels` ─ ラベル（全プロジェクト共通）

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| label_id | str | ○ | UUID。主キー |
| name | str | ○ | 表示名 |
| color | str | ○ | 背景色（6色から選択） |

### 2.7f `holidays` ─ 祝日・会社休日（全員）

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| date | date | ○ | 主キー |
| name | str | ○ | 例：敬老の日、年末休暇 |
| kind | str | ○ | `祝日`（毎年取り込み）/ `会社休日`（管理者が追加） |

### 2.7g `leaves` ─ 個人の休み

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| leave_id | str | ○ | UUID。主キー |
| user_id | str | ○ | -> users.user_id |
| start_date | date | ○ | |
| end_date | date | ○ | 1日だけなら start と同じ |
| reason | str | | 休暇・研修・出張 など |

### 2.7h `notifications` ─ 画面内のお知らせ

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| notification_id | str | ○ | UUID。主キー |
| user_id | str | ○ | 受け取る人 -> users.user_id |
| kind | str | ○ | `reassign` / `due` / `delay` / `overload` / `baseline` |
| text | str | ○ | 表示文 |
| link | str | | 移動先（タスク・プロジェクト・個人ページ） |
| created_at | ts | ○ | |
| read_at | ts | | 既読にした日時（空＝未読） |

`due` / `delay` / `overload` は毎朝の時間主導トリガー（GAS）で作り、`reassign` / `baseline` はその操作の保存時に作る。種類ごとのオン／オフは `settings` の `notify_<kind>`（true/false）。

### 2.7i `saved_filters` ─ 保存フィルタ

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| filter_id | str | ○ | UUID。主キー |
| owner_user_id | str | ○ | 作った人 |
| name | str | ○ | |
| shared | bool | ○ | TRUE＝チーム全員に見える |
| conditions | json | ○ | 絞り込み条件（テキスト・プロジェクト・担当者・分類・優先度・種別・ラベル・健全性・期限） |
| sort_order | int | | 並び順 |

---

### 2.8 `summary_cache` ─ 集計キャッシュ

| 列 | 型 | 説明 |
|---|---|---|
| project_id | str | 主キー |
| payload | json | 集計結果（下記） |
| updated_at | ts | 再計算した日時 |

payload の構造:

```json
{
  "health": "delayed",
  "actualRate": 0.375,
  "plannedRate": 0.672,
  "delta": -0.297,
  "delayDays": 0,
  "counts": { "task": { "total": 4, "done": 1 }, "subtask": { "total": 11, "done": 4 } },
  "delayedCount": 2
}
```

**更新タイミング**: プロジェクト配下のタスクを書き込んだときに、該当プロジェクトのみ再計算する。
plannedRate は日付が変わると変化するため、**参照時に日付が updated_at と異なれば再計算**する。

---

## 3. ステータスの遷移

```
not_started --> in_progress --> done
     ^              |   ^         |
     |              v   |         |
     +---------- on_hold <--------+
```

- done にしたとき `completed_at` を記録し、done から戻したときはクリアする。
- 親タスクのステータスは自動更新しない（利用者の意図を尊重）。ただし「子が全て完了」のときは画面上で完了を促す。

---

## 4. Firestore 移行時のマッピング

| スプレッドシート | Firestore |
|---|---|
| `users` シート | `users/{userId}` |
| `templates` シート | `templates/{templateId}` |
| `template_items` / `template_fields` | `templates/{templateId}` 内の配列フィールド（件数が少ないため内包） |
| `projects` シート | `projects/{projectId}` |
| `items` シート | `projects/{projectId}/items/{itemId}`（サブコレクション） |
| 担当者ビューの横断検索 | コレクショングループクエリ collectionGroup("items").where("assigneeUserId","==",uid) |
| `settings` シート | `config/app` ドキュメント |
| `summary_cache` シート | `projects/{projectId}` の summary フィールドに内包 |

移行時の変更は**データアクセス層（`repo.gs`）のみ**に閉じる。
業務ロジック（`service.gs`）と健全性判定（`health.js`）はそのまま流用できる。

---

## 6. 当初計画（ベースライン）の運用

予定進捗率は現在の `start_date` / `end_date` から計算するため、当初計画がないと**終了日を延ばした瞬間に遅延が消える**。当初計画は**計画確定時に人が保存**し、引き直しは版として残す（要件 §3.4）。

| 操作 | `start_date` / `end_date` | 当初計画 |
|---|---|---|
| プロジェクト作成（テンプレート展開） | 展開した実日付を書く | 作らない。`plan_status = planning`、`baseline_*` は空 |
| 計画中に日付を直す | 更新する | 変化なし（当初比は出ない） |
| 管理者が「計画を確定」 | そのまま | `baselines` に第1版（kind=fix, scope=all）、`baseline_items` に全タスクの写し。`plan_status = fixed`、`items.baseline_*` を更新 |
| 確定後に担当者が日程を直す／バーを動かす | 更新する | **変更しない** → 当初比に出る |
| 管理者が「引き直し」（全体） | そのまま | 新しい版（kind=rebase, scope=all）。全タスクをいまの日付で写す |
| 管理者が「引き直し」（選んだタスクだけ） | そのまま | 新しい版（scope=items）。選んだタスクだけいまの日付、それ以外は前の版の値を写す |
| 確定後にタスクを追加 | 入力値 | 追加時の日付を `items.baseline_*` に入れる。追加日時 > `plan_fixed_at` なら「確定後に追加」と表示 |

算出される値（`health.js` の `calc`）:

| 値 | 計算 |
|---|---|
| `slipDays` | `end_date − baseline_end_date`（正なら後ろ倒し） |
| `baselinePlannedRate` | 当初日程で計算した予定進捗率 |
| `baselineHealth` | 当初日程で判定した健全性 |
| `slippedCount` | 配下で `slipDays > 0` のタスク件数 |

比較する版を切り替えるときは、選んだ版の `baseline_items` を `baseline_*` として当てはめてから評価する（モックの `MockData.withBaseline(project, version)`）。当初計画の無いタスクは、これらが `null` になり当初比の表示を出さない。

---

## 7. バリデーション

| 対象 | ルール |
|---|---|
| projects.end_date | start_date 以上 |
| items.end_date | start_date 以上 |
| items（子タスク） | 親タスクの期間内に収まらない場合は警告（保存は許可） |
| items.progress_rate | 0〜100の整数 |
| template_fields.field_key | 小文字英字で始まるスネークケース。テンプレート内で一意 |
| projects.custom_fields | テンプレートの required=TRUE の項目がすべて埋まっていること |
| 削除 | プロジェクト削除時は配下の items も削除（運用上は論理削除 archived を推奨） |
