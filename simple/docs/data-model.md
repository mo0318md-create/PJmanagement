# データモデル（簡易版）─ スプレッドシート設計

最終更新: 2026-09-28 / 版: **簡易版 v1**

完全版は `../../docs/data-model.md`（16シート）。簡易版は **9シート**。
要件は `requirements.md`。

---

## 0. 設計方針

| 方針 | 内容 |
|---|---|
| 1シート = 1テーブル | スプレッドシート1冊の中にシートを9枚 |
| 1行目はヘッダー | コードは**列名で引く**。列を足しても順番を変えても壊れない |
| 主キー | 文字列の UUID（`Utilities.getUuid()`）。数値の連番にはしない |
| 日付 | `yyyy-MM-dd` の**文字列**で持つ。日付型はタイムゾーンでずれるため使わない |
| 日時 | ISO 8601 の文字列（`2026-09-28T09:15:00+09:00`） |
| JSON列 | 文字列で保存し、読み込み時に `JSON.parse`。空は `{}` / `[]` |
| 真偽値 | `TRUE` / `FALSE` の文字列 |
| 削除 | 行を物理削除する（履歴は残さない）。プロジェクト削除時は配下のタスクも消す |

---

## 1. ER図（論理）

```
users ──────┬── projects.owner_user_id
            ├── items.assignee_user_id
            └── notifications.user_id

templates ──┬── template_items   （テンプレートのタスク構成）
            ├── template_fields  （テンプレートのカスタム項目）
            └── projects.template_id（参照のみ。変更は遡及しない）

projects ───┬── items            （タスク／子タスク）
            └── summary_cache    （プロジェクト1件につき1行）

items ──────── items.parent_item_id（子タスク → 親タスク）

settings       （key-value。1行1設定）
```

---

## 2. テーブル定義

### 2.1 `users` ─ 利用者

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| user_id | str | ○ | | UUID。主キー |
| name | str | ○ | | 表示名 |
| email | str | ○ | | Googleアカウント。`Session.getActiveUser().getEmail()` と照合する |
| role | str | ○ | member | `admin` / `member` |
| active | bool | ○ | TRUE | FALSE なら担当者の選択肢に出さない |
| created_at | ts | ○ | | |

> 完全版にあった `weekly_capacity_days` / `capacity_note`（週の稼働）は、負荷機能を削ったため無し。

---

### 2.2 `templates` ─ プロジェクトテンプレート

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| template_id | str | ○ | | UUID。主キー |
| name | str | ○ | | 例：Webサイト制作 |
| description | str | | | |
| key_prefix | str | | | 課題キーの接頭辞（例：`CORP`） |
| active | bool | ○ | TRUE | FALSE なら作成画面の選択肢に出さない |
| sort_order | int | ○ | | 100刻み |
| created_at | ts | ○ | | |
| updated_at | ts | ○ | | タスク構成・設定項目を変えたときも進める |
| created_by / created_by_name | str | | | 登録者（`projects` の「登録者・更新者の列」と同じ） |
| updated_by / updated_by_name | str | | | 最終更新者 |

---

### 2.3 `template_items` ─ テンプレートのタスク構成

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| template_item_id | str | ○ | | UUID。主キー |
| template_id | str | ○ | | -> templates.template_id |
| level | int | ○ | | 1=タスク / 2=子タスク |
| parent_template_item_id | str | | | level=2 のとき親の template_item_id |
| sort_order | int | ○ | | 同一親内での並び順（100刻み） |
| name | str | ○ | | |
| item_type | str | ○ | work | `work` 作業 / `bug` バグ / `req` 要望 |
| start_offset_days | int | ○ | 0 | プロジェクト開始日からの相対日数 |
| duration_days | int | ○ | 1 | 期間（両端を含む日数） |

**実日付への展開**（F-1-2）：
`開始日 = プロジェクト開始日 + start_offset_days` / `終了日 = 開始日 + duration_days - 1`

---

### 2.4 `template_fields` ─ テンプレートのカスタム設定項目

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| field_id | str | ○ | | UUID。主キー |
| template_id | str | ○ | | -> templates.template_id |
| field_key | str | ○ | | 英数字。`projects.custom_fields` のキーになる |
| label | str | ○ | | 画面に出す名前（例：クライアント名） |
| type | str | ○ | text | `text` / `number` / `date` / `select` / `checkbox` |
| required | bool | ○ | FALSE | |
| options | json | | [] | `type=select` のときの選択肢。例：`["新規","リニューアル"]` |
| sort_order | int | ○ | | 100刻み |

---

### 2.5 `projects` ─ プロジェクト（第1階層）

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| project_id | str | ○ | | UUID。主キー |
| key | str | ○ | | 表示用のキー（例：`CORP`）。タスクのキーは `CORP-1` のように連番を付ける |
| name | str | ○ | | |
| description | str | | | |
| template_id | str | | | 生成元テンプレート（参照のみ。変更は遡及しない） |
| template_name | str | | | 生成時点のテンプレート名を**コピー保持**（テンプレート削除後も表示できる） |
| owner_user_id | str | ○ | | -> users.user_id |
| status | str | ○ | not_started | `not_started` / `in_progress` / `on_hold` / `done` |
| start_date | date | ○ | | |
| end_date | date | ○ | | start_date 以上であること |
| custom_fields | json | | {} | 設定項目の値。キーは field_defs の key。例: `{"client_name":"株式会社ABC","budget":480}` |
| field_defs | json | | （空欄） | 設定項目の定義。`[{key,label,type,options,required,source}]`。type は `text`/`number`/`date`/`select`/`checkbox`。source は `template`（作成時にテンプレートからコピー。名前・型・必須は変えられない）/ `project`（そのプロジェクトで足した項目）。**作成時にコピーするので、テンプレートを後で変えても遡及しない**。空欄の古い行は、テンプレートの定義と値のキー（文字型）から組み立てて扱い、次に保存したときに埋まる |
| next_item_seq | int | ○ | 1 | タスクキーの次の連番 |
| created_at | ts | ○ | | |
| updated_at | ts | ○ | | 衝突検知に使う（§5.1）。プロジェクトの設定を変えたときだけ進める（タスクの追加では進めない） |
| created_by / created_by_name | str | | | 登録者の社員コードと、その時点の氏名（下の「登録者・更新者の列」を参照） |
| updated_by / updated_by_name | str | | | 最終更新者の社員コードと、その時点の氏名 |

> **登録者・更新者の列**（`projects`・`items`・`templates` に共通）：
> 人は社員コード（共通マスタ）で指すが、退職などで一覧から消えても記録の名前が残るよう、氏名も一緒に書く。
> 列を足す前からある行は空欄のまま（画面では「記録なし」）。次に保存したときに埋まる。
> 列の見出しは、アプリが最初に読み書きしたときに自動で右端へ足す（setup() のやり直しは要らない）。

> 完全版から削除：`plan_status` / `plan_fixed_at` / `plan_fixed_by` / `baseline_version` /
> `baseline_start_date` / `baseline_end_date` / `baseline_set_at`（当初計画）、
> `progress_mode`（判定モード）、`progress_rate`（集計で求めるため）、`archived`（アーカイブ）。

---

### 2.6 `items` ─ タスク / 子タスク（第2・第3階層）

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| item_id | str | ○ | | UUID。主キー |
| project_id | str | ○ | | -> projects.project_id（**全行に保持**） |
| item_key | str | ○ | | 表示用（例：`CORP-12`） |
| level | int | ○ | | 1=タスク / 2=子タスク |
| parent_item_id | str | | | level=2 のとき親タスクの item_id。level=1 は空 |
| sort_order | int | ○ | | 同一親内での並び順（100刻み） |
| name | str | ○ | | |
| description | str | | | |
| item_type | str | ○ | work | `work` 作業 / `bug` バグ / `req` 要望 |
| assignee_user_id | str | | | -> users.user_id。空=未アサイン |
| status | str | ○ | not_started | `not_started` / `in_progress` / `on_hold` / `done` |
| start_date | date | | | |
| end_date | date | | | |
| progress_rate | int | | 0 | 0〜100。**子を持たないタスクだけ**が持つ。子を持つ行は空（要件 §3.2） |
| depends_on | json | | [] | 前のタスク（これが終わってから始める）の item_id の配列（要件 F-3-19）。同じプロジェクトの、自分・親・子以外。輪になるつなぎ方は保存しない。タスクを消したら、ほかの行からも外す（更新日時は変えない） |
| created_at | ts | ○ | | |
| updated_at | ts | ○ | | 衝突検知に使う |
| created_by / created_by_name | str | | | 登録者（`projects` の「登録者・更新者の列」と同じ） |
| updated_by / updated_by_name | str | | | 最終更新者 |

> 完全版から削除：`baseline_start_date` / `baseline_end_date` / `baseline_set_at`（当初計画）、
> `size_key` / `estimate_hours`（作業の重さ）、`milestone_id`、`label_ids`、`completed_at`、
> `actual_start_date` / `actual_end_date`（実績の開始日・終了日）。

**進捗率の入れ方**（要件 §3.2）
- 子を持たないタスク … 担当者が 0〜100 を入れる。完了にすると自動で 100。
- 子を持つタスク … 空にしておき、表示のときに子の平均を計算する。シートには書かない。

**読み込み方**：件数が1,000行程度のため、`getDataRange().getValues()` で全件を読んでメモリ上で絞り込む。
シートは `project_id` 列でソートしておくと、将来の範囲読み取りに切り替えやすい。

---

### 2.7 `settings` ─ システム設定（key-value）

| 列 | 型 | 説明 |
|---|---|---|
| key | str | 主キー |
| value | str | 値（数値・真偽値も文字列で持つ） |
| description | str | 画面に出す説明 |

| key | 既定 | 説明 |
|---|---|---|
| `notify_assign` | TRUE | お知らせ：担当になった／外れた |
| `notify_due` | TRUE | お知らせ：期限の前日と当日 |
| `notify_delayed` | TRUE | お知らせ：遅延になった |
| `notify_keep_days` | 90 | お知らせを残す日数 |
| `show_planned` | TRUE | 表示：進捗バーに今日時点の予定（縦線）と予定％を出す（F-5-16） |

> 完全版から削除：`default_progress_mode`、`threshold_at_risk`、`threshold_delayed`（状態は終了日だけで決めるため）、
> `overload_threshold`、`rollup_weight`、`size_days`、`hours_per_day`、`weekly_capacity_days`、`notify_overload`、`notify_baseline`。

---

### 2.8 `notifications` ─ 画面内のお知らせ（要件 F-5-9）

| 列 | 型 | 必須 | 既定 | 説明 |
|---|---|---|---|---|
| notification_id | str | ○ | | UUID。主キー |
| user_id | str | ○ | | -> users.user_id。受け取る人 |
| kind | str | ○ | | `assigned` 担当になった / `unassigned` 外れた / `due` 期限が近い / `delayed` 遅延になった |
| title | str | ○ | | 画面に出す1行 |
| project_id | str | | | -> projects.project_id（行き先） |
| item_id | str | | | -> items.item_id（行き先） |
| read | bool | ○ | FALSE | TRUE なら既読 |
| created_at | ts | ○ | | |

**作り方**（要件 §5.4）
- `assigned` / `unassigned` … 担当者を変えて保存したとき、その場で行を足す。
- `due` / `delayed` … 毎朝の時間主導トリガーでタスクを走査して作る。
  同じ日に同じタスクで同じ種類のお知らせを二重に作らないよう、`created_at` の日付で重複を避ける。
- `notify_keep_days`（既定90日）より古い行は、同じトリガーで削除する。

---

### 2.9 `summary_cache` ─ 集計キャッシュ（要件 F-5-6）

プロジェクト1件につき1行。**プロジェクト一覧はこのシートだけを読んで描く**（要件 §5.1）。

| 列 | 型 | 必須 | 説明 |
|---|---|---|---|
| project_id | str | ○ | -> projects.project_id。主キー |
| health | str | ○ | `done` / `delayed` / `on_track`（対応中）/ `not_started` / `no_period`。`at_risk` は簡易版では使わない |
| actual_rate | int | ○ | 実績進捗率（0〜100） |
| planned_rate | int | ○ | 予定進捗率（0〜100） |
| task_total | int | ○ | 第2階層の件数 |
| task_done | int | ○ | うち完了 |
| sub_total | int | ○ | 第3階層の件数 |
| sub_done | int | ○ | うち完了 |
| delayed_count | int | ○ | 配下の遅延件数（第2・第3階層の合計） |
| computed_at | ts | ○ | 計算した日時 |
| computed_for_date | date | ○ | **どの日を「今日」として計算したか** |

**更新のタイミング**
1. そのプロジェクトのタスクを保存したとき … その1行だけ計算し直す。
2. 毎朝の時間主導トリガー … 全プロジェクトを計算し直す。

**2 が要る理由**：状態と予定進捗率は「今日」に依存するため、
誰も触らなくても日付が変われば値が変わる。`computed_for_date` が今日と違う行は、
画面側で「古い値」とみなしてその場で計算し直す（タスクの裏読みが終わっていれば正しい値を出せる）。

---

## 3. ステータスの遷移

```
未着手 ──▶ 進行中 ──▶ 完了
   ▲         │  ▲        │
   │         ▼  │        │
   └──────  保留 ◀───────┘
```

| 遷移 | 自動で起きること |
|---|---|
| → 完了 | `progress_rate` を 100 にする |
| 完了 → ほかへ | `progress_rate` は 100 のまま残す（担当者が直す） |
| 担当者の変更 | `notifications` に2行（旧担当に `unassigned`、新担当に `assigned`） |
| いずれの保存でも | `updated_at` を更新し、`summary_cache` のそのプロジェクトの行を更新する |

---

## 4. バリデーション

| 対象 | ルール |
|---|---|
| projects.end_date | start_date 以上 |
| items.end_date | start_date 以上。どちらか片方だけは不可（両方空は可＝期間未設定） |
| items.progress_rate | 0〜100 の整数。子を持つ行には入れられない |
| items.parent_item_id | level=2 のとき必須。同じ project_id の level=1 の行を指すこと |
| template_fields.field_key | 同じテンプレート内で重複しないこと。英数字とアンダースコアのみ |
| projects.custom_fields | `field_defs` で `required` が TRUE の項目は空にできない。値は `field_defs` の型に合っていること（数値・日付 yyyy-MM-dd・選択肢のどれか・真偽） |
| 削除 | 子タスクを持つタスクは、先に子を消すか、まとめて消すか確認する |

---

## 5. 完全版から削ったシート

| シート | 内容 | 簡易版での扱い |
|---|---|---|
| `baselines` | 当初計画の版 | 削除 |
| `baseline_items` | 版ごとの当初日付 | 削除 |
| `milestones` | マイルストーン | 削除 |
| `labels` | ラベル | 種別（`item_type`）で代用 |
| `holidays` | 祝日・会社休日 | 削除（負荷計算をやめたため） |
| `leaves` | 個人の休み | 削除（同上） |
| `saved_filters` | 保存フィルタ | 削除（横断検索は残すが条件の保存はしない） |

16シート → **9シート**。
