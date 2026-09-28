/**
 * 設定とシートの定義（簡易版）
 * データモデル: ../docs/data-model.md の 9 シートに対応する。
 *
 * 列は「名前」で引く。並び順を変えても、列を足しても壊れない。
 */

/** スプレッドシートを開く。スタンドアロンで使うときはスクリプトプロパティに ID を入れる */
function SS_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

/** シート名と列の定義。ここが唯一の正 */
var SHEETS = {
  users: {
    key: 'user_id',
    cols: ['user_id', 'name', 'email', 'role', 'active', 'created_at']
  },
  templates: {
    key: 'template_id',
    cols: ['template_id', 'name', 'description', 'key_prefix', 'active', 'sort_order', 'created_at', 'updated_at']
  },
  template_items: {
    key: 'template_item_id',
    cols: ['template_item_id', 'template_id', 'level', 'parent_template_item_id', 'sort_order',
           'name', 'item_type', 'start_offset_days', 'duration_days']
  },
  template_fields: {
    key: 'field_id',
    cols: ['field_id', 'template_id', 'field_key', 'label', 'type', 'required', 'options', 'sort_order']
  },
  projects: {
    key: 'project_id',
    cols: ['project_id', 'key', 'name', 'description', 'template_id', 'template_name', 'owner_user_id',
           'status', 'start_date', 'end_date', 'custom_fields', 'next_item_seq', 'created_at', 'updated_at']
  },
  items: {
    key: 'item_id',
    cols: ['item_id', 'project_id', 'item_key', 'level', 'parent_item_id', 'sort_order',
           'name', 'description', 'item_type', 'assignee_user_id', 'status',
           'start_date', 'end_date', 'progress_rate', 'created_at', 'updated_at']
  },
  settings: {
    key: 'key',
    cols: ['key', 'value', 'description']
  },
  notifications: {
    key: 'notification_id',
    cols: ['notification_id', 'user_id', 'kind', 'title', 'project_id', 'item_id', 'read', 'created_at']
  },
  summary_cache: {
    key: 'project_id',
    cols: ['project_id', 'health', 'actual_rate', 'planned_rate', 'task_total', 'task_done',
           'sub_total', 'sub_done', 'delayed_count', 'computed_at', 'computed_for_date']
  }
};

/** JSON として読み書きする列 */
var JSON_COLS = { custom_fields: '{}', options: '[]' };

/** 真偽値として読み書きする列 */
var BOOL_COLS = { active: true, required: false, read: false };

/** 数値として読み書きする列 */
var NUM_COLS = {
  level: 1, sort_order: 100, start_offset_days: 0, duration_days: 1, progress_rate: 0,
  next_item_seq: 1, actual_rate: 0, planned_rate: 0, task_total: 0, task_done: 0,
  sub_total: 0, sub_done: 0, delayed_count: 0
};

/** 設定の既定値。シートに無いキーはこれを使う */
var SETTING_DEFAULTS = {
  notify_assign: 'TRUE',
  notify_due: 'TRUE',
  notify_delayed: 'TRUE',
  notify_keep_days: '90'
};

var SETTING_DESC = {
  notify_assign: 'お知らせ：担当になった／外れた',
  notify_due: 'お知らせ：期限の前日と当日',
  notify_delayed: 'お知らせ：遅延になった',
  notify_keep_days: 'お知らせを残す日数'
};

/** ステータス（4つ固定） */
var STATUS = { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', ON_HOLD: 'on_hold', DONE: 'done' };

/** タスクの種別（3つ固定） */
var ITEM_TYPES = ['work', 'bug', 'req'];

/** タイムゾーン。日付の文字列化に使う */
function TZ_() {
  return Session.getScriptTimeZone() || 'Asia/Tokyo';
}

/** 今日を 'yyyy-MM-dd' で返す */
function today_() {
  return Utilities.formatDate(new Date(), TZ_(), 'yyyy-MM-dd');
}

/** 現在時刻を ISO 8601 で返す */
function now_() {
  return Utilities.formatDate(new Date(), TZ_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function uuid_() {
  return Utilities.getUuid();
}
