/**
 * シートの読み書き（簡易版）
 *
 * 方針
 * - 1行目をヘッダーとし、列は名前で引く
 * - 読むときは getDataRange().getValues() の1回だけ。呼び出し回数が待ち時間になる
 * - 書くときは変えた1行だけ。全体の書き戻しはしない
 * - 日付は 'yyyy-MM-dd' の文字列で持つ（日付型はタイムゾーンでずれるため）
 */

/** シートを取る。無ければ作ってヘッダーを入れる */
/*
 * 1回の実行（画面からの1回の呼び出し）の中で使い回すもの。
 * スプレッドシートへの呼び出しは1回ごとに時間がかかるので、同じシートを何度も開いたり読んだりしない。
 *   SHEET_MEMO_ … シートの取得
 *   READ_MEMO_  … readAll_ の結果。書き込んだら合わせて直す（または捨てる）
 * 書き込みの排他（withLock_）に入ったときは READ_MEMO_ を捨て、ロックの中では必ず最新を読む。
 */
var SHEET_MEMO_ = {};
var READ_MEMO_ = {};

function sheet_(name) {
  if (SHEET_MEMO_[name]) return SHEET_MEMO_[name];
  var ss = SS_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    var cols = SHEETS[name].cols;
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  SHEET_MEMO_[name] = sh;
  return sh;
}

/**
 * 定義にあってシートに無い列の見出しを、右端に足す（列を増やしたときに setup() をやり直さなくてよいように）。
 * 見出しが無い列は書き込みが黙って捨てられるため。すでに読んだ見出しを渡すので、余計な読み出しはしない。
 */
function ensureCols_(name, sh, head) {
  if (!SHEETS[name] || !head.length) return head;
  var missing = SHEETS[name].cols.filter(function (c) { return head.indexOf(c) < 0; });
  if (!missing.length) return head;
  sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  return head.concat(missing);
}

/** ヘッダー行（列名の配列） */
function header_(sh) {
  var last = sh.getLastColumn();
  if (last < 1) return [];
  return sh.getRange(1, 1, 1, last).getValues()[0].map(function (v) { return String(v).trim(); });
}

/** セルの生の値を、列の型に合わせて直す */
function decodeCell_(col, v) {
  if (JSON_COLS.hasOwnProperty(col)) {
    if (v === '' || v === null || v === undefined) return JSON.parse(JSON_COLS[col]);
    if (typeof v === 'object') return v;
    try { return JSON.parse(String(v)); } catch (e) { return JSON.parse(JSON_COLS[col]); }
  }
  if (BOOL_COLS.hasOwnProperty(col)) {
    if (v === true || v === false) return v;
    var s = String(v).trim().toUpperCase();
    return s === 'TRUE' || s === '1' || s === 'はい';
  }
  if (NUM_COLS.hasOwnProperty(col)) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  // 日付の列：スプレッドシート側で日付型になっていても文字列に直す
  if (col.indexOf('_date') >= 0 || col === 'computed_for_date') {
    if (v instanceof Date) return Utilities.formatDate(v, TZ_(), 'yyyy-MM-dd');
    return v === null || v === undefined ? '' : String(v).trim();
  }
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ_(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  return typeof v === 'number' ? v : String(v);
}

/** オブジェクトの値を、セルに入れる形に直す */
function encodeCell_(col, v) {
  if (JSON_COLS.hasOwnProperty(col)) return JSON.stringify(v === undefined || v === null ? JSON.parse(JSON_COLS[col]) : v);
  if (BOOL_COLS.hasOwnProperty(col)) return v ? 'TRUE' : 'FALSE';
  if (v === null || v === undefined) return '';
  return v;
}

/** シートを全部読んでオブジェクトの配列にする（同じ実行の中では2回目から読み直さない） */
function readAll_(name) {
  if (READ_MEMO_[name]) return READ_MEMO_[name].slice();
  var sh = sheet_(name);
  var values = sh.getDataRange().getValues();
  var head = (values[0] || []).map(function (v) { return String(v).trim(); });
  ensureCols_(name, sh, head);
  if (values.length < 2) { READ_MEMO_[name] = []; return []; }
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (String(row[0]).trim() === '') continue;      // 主キーが空の行は飛ばす
    var o = {};
    for (var c = 0; c < head.length; c++) {
      if (!head[c]) continue;
      o[head[c]] = decodeCell_(head[c], row[c]);
    }
    o.__row = r + 1;                                  // シート上の行番号（更新に使う）
    out.push(o);
  }
  READ_MEMO_[name] = out;
  return out.slice();
}

/** 主キーで1件引く */
function findById_(name, id) {
  var key = SHEETS[name].key;
  var all = readAll_(name);
  for (var i = 0; i < all.length; i++) if (String(all[i][key]) === String(id)) return all[i];
  return null;
}

/** 1行を足す。obj は列名をキーにしたオブジェクト */
function insertRow_(name, obj) {
  var sh = sheet_(name);
  var head = ensureCols_(name, sh, header_(sh));
  delete READ_MEMO_[name];
  var row = head.map(function (col) { return encodeCell_(col, obj[col]); });
  sh.appendRow(row);
  return obj;
}

/**
 * 1行を書き換える。obj.__row があればその行、無ければ主キーで探す。
 * 渡したキーだけを更新し、他の列はそのまま残す。
 */
function updateRow_(name, id, patch) {
  var sh = sheet_(name);
  var head = ensureCols_(name, sh, header_(sh));
  var key = SHEETS[name].key;
  var keyCol = head.indexOf(key) + 1;
  if (keyCol < 1) throw new Error(name + ' に ' + key + ' 列がありません');

  // この実行の中で読んだ行なら、行番号はもう分かっている（読み直さない）
  var memoRow = null;
  (READ_MEMO_[name] || []).some(function (o) { if (String(o[key]) === String(id)) { memoRow = o; return true; } return false; });
  var rowIndex = memoRow ? memoRow.__row : -1;
  if (rowIndex < 0) {
    var ids = sh.getRange(1, keyCol, Math.max(sh.getLastRow(), 1), 1).getValues();
    for (var r = 1; r < ids.length; r++) {
      if (String(ids[r][0]).trim() === String(id)) { rowIndex = r + 1; break; }
    }
  }
  if (rowIndex < 0) throw new Error(name + ' に ' + id + ' が見つかりません');

  var current = sh.getRange(rowIndex, 1, 1, head.length).getValues()[0];
  for (var c = 0; c < head.length; c++) {
    var col = head[c];
    if (col && patch.hasOwnProperty(col)) current[c] = encodeCell_(col, patch[col]);
  }
  sh.getRange(rowIndex, 1, 1, head.length).setValues([current]);
  if (memoRow) Object.keys(patch).forEach(function (k) { memoRow[k] = patch[k]; });   // 読んだ内容も合わせる
  return rowIndex;
}

/** 1行を消す */
function deleteRow_(name, id) {
  var sh = sheet_(name);
  delete READ_MEMO_[name];                                 // 行番号がずれるので捨てる
  var head = header_(sh);
  var keyCol = head.indexOf(SHEETS[name].key) + 1;
  var ids = sh.getRange(1, keyCol, Math.max(sh.getLastRow(), 1), 1).getValues();
  for (var r = ids.length - 1; r >= 1; r--) {
    if (String(ids[r][0]).trim() === String(id)) { sh.deleteRow(r + 1); return true; }
  }
  return false;
}

/** 複数行をまとめて消す（お知らせの掃除で使う） */
function deleteRowsWhere_(name, pred) {
  var sh = sheet_(name);
  var all = readAll_(name);
  var rows = all.filter(pred).map(function (o) { return o.__row; }).sort(function (a, b) { return b - a; });
  delete READ_MEMO_[name];
  rows.forEach(function (r) { sh.deleteRow(r); });
  return rows.length;
}

/** 書き込みを1つずつに直列化する。同時編集での上書き事故を防ぐ */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('ほかの人が書き込み中です。少し待ってからもう一度お試しください');
  READ_MEMO_ = {};   // ロックを取る前に読んだ内容は古いかもしれない。ロックの中では読み直す
  try { return fn(); } finally { lock.releaseLock(); }
}

/** 設定を key-value のオブジェクトで返す（既定値で埋める） */
function readSettings_() {
  var out = {};
  Object.keys(SETTING_DEFAULTS).forEach(function (k) { out[k] = SETTING_DEFAULTS[k]; });
  readAll_('settings').forEach(function (r) { if (r.key) out[r.key] = String(r.value); });
  return out;
}

function settingBool_(s, key) { return String(s[key]).toUpperCase() === 'TRUE'; }
function settingNum_(s, key) { var n = Number(s[key]); return isNaN(n) ? Number(SETTING_DEFAULTS[key]) : n; }
