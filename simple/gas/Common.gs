/**
 * Common.gs — 共通マスタ（社員・所属・役職）を**読むだけ**の口
 *
 * 別システム（稟議システム）の `purchase/Common.js` と同じ作法で書いてある。
 * 源泉はクロノス／XronosLink から毎朝同期されるスプレッドシート。
 *
 * **書き込む関数はこのファイルに置かない。**
 * common のオーナーとこのアプリのデプロイ者が同じアカウントになりうるため、
 * 権限では書き込みを止められない。境界を担保するのは**コードだけ**である。
 *
 * 守っていること
 *  - **スプレッドシートIDをコードに書かない**（スクリプトプロパティ `COMMON_MASTER_SS_ID`）
 *  - **`getDisplayValues()` を使う**。`getValues()` だと所属コード `23-1` が日付になり、
 *    先頭ゼロのコードが数値になって消える。**コードは文字列として扱う**
 *  - **列名でインデックスを引く**。列は予告なく末尾へ増える
 *  - **参照してよいシートだけを開く**。許可制にして、うっかり配線できないようにする
 *  - **読めないときもこのアプリを止めない**。最後に読めた内容を控えとして持つ
 */

/** 参照してよいシート。ここに無い名前は開かない */
var COMMON_SHEETS_ = {
  EMP_VIEW: '社員一覧',     // 通常はここだけ読めば足りる（非正規化ビュー）
  DEPT: '所属マスタ',
  POS: '役職マスタ',
  SYNC_LOG: '同期ログ'      // 向こうの同期が今日走ったかの確認
};

/** 共通マスタのキャッシュ（秒）。数式ビューなので開くたび再計算が走る */
var COMMON_CACHE_TTL_SEC_ = 600;

/** 控えを置く隠しシート。common が読めないときはここから読む */
var COMMON_FALLBACK_SHEET_ = '_common_控え';

/* 実行内メモ。1回の実行で同じシートを何度も開かない */
var COMMON_SS_MEMO_ = null;
var COMMON_ROWS_MEMO_ = {};

/** 共通マスタのスプレッドシートID（未設定なら、何をすればよいかまで言う） */
function commonMasterId_() {
  var id = PropertiesService.getScriptProperties().getProperty('COMMON_MASTER_SS_ID');
  if (!id) {
    throw new Error('COMMON_MASTER_SS_ID が未設定です。' +
      '共通マスタ（社員・所属）のスプレッドシートIDを、GASエディタの ' +
      'プロジェクトの設定 ▸ スクリプト プロパティ に登録してください' +
      '（テスト環境では本物ではなくコピーのIDを入れます）。');
  }
  return id;
}

/** 共通マスタが設定されているか（例外を投げずに知りたいとき） */
function hasCommonMaster_() {
  try { return !!PropertiesService.getScriptProperties().getProperty('COMMON_MASTER_SS_ID'); }
  catch (e) { return false; }
}

function commonSpreadsheet_() {
  if (COMMON_SS_MEMO_) return COMMON_SS_MEMO_;
  COMMON_SS_MEMO_ = SpreadsheetApp.openById(commonMasterId_());
  return COMMON_SS_MEMO_;
}

/**
 * 共通マスタの1シートをオブジェクトの配列で返す。
 * 値はすべて文字列（`getDisplayValues`）。**型を推測して変換しない**。
 * 必要な側が `Number()` する。
 */
function commonRows_(sheetName) {
  var allowed = Object.keys(COMMON_SHEETS_).map(function (k) { return COMMON_SHEETS_[k]; });
  if (allowed.indexOf(sheetName) === -1) {
    throw new Error('共通マスタの「' + sheetName + '」は参照してよいシートではありません' +
      '（内部構造のため予告なく変わります）。参照できるのは: ' + allowed.join(' / '));
  }
  if (COMMON_ROWS_MEMO_[sheetName]) return COMMON_ROWS_MEMO_[sheetName];

  var key = 'common:' + commonMasterId_() + ':' + sheetName;
  var rows = null;
  try {
    var hit = CacheService.getScriptCache().get(key);
    if (hit) rows = JSON.parse(hit);
  } catch (e) { /* キャッシュは無くても動く */ }

  if (!rows) {
    var sh = commonSpreadsheet_().getSheetByName(sheetName);
    if (!sh) {
      throw new Error('共通マスタに「' + sheetName + '」シートがありません。' +
        'COMMON_MASTER_SS_ID が別のスプレッドシートを指していないか確認してください。');
    }
    var grid = sh.getDataRange().getDisplayValues();
    var head = (grid[0] || []).map(function (h) { return String(h == null ? '' : h).trim(); });
    rows = [];
    for (var i = 1; i < grid.length; i++) {
      var line = grid[i] || [];
      // 1列目が空の行は数式の余白（展開されなかった行）。データではない
      if (String(line[0] == null ? '' : line[0]).trim() === '') continue;
      var o = {};
      head.forEach(function (h, j) { if (h) o[h] = String(line[j] == null ? '' : line[j]); });
      rows.push(o);
    }
    try { CacheService.getScriptCache().put(key, JSON.stringify(rows), COMMON_CACHE_TTL_SEC_); }
    catch (e) { /* 容量超過は握る（読み直せばよいだけ） */ }
  }
  COMMON_ROWS_MEMO_[sheetName] = rows;
  return rows;
}

/** 共通マスタのキャッシュを捨てる（同期の直前・テストの後始末で使う） */
function bustCommonCache_() {
  Object.keys(COMMON_ROWS_MEMO_).forEach(function (k) { delete COMMON_ROWS_MEMO_[k]; });
  COMMON_SS_MEMO_ = null;
  try {
    if (!hasCommonMaster_()) return;
    var id = commonMasterId_();
    CacheService.getScriptCache().removeAll(
      Object.keys(COMMON_SHEETS_).map(function (k) { return 'common:' + id + ':' + COMMON_SHEETS_[k]; }));
  } catch (e) { /* 捨てられなくても TTL で消える */ }
}

/* ============ 読み出し（用途ごとの入口） ============ */

/**
 * 社員一覧。既定は**在籍者だけ**。退職者も同じシートに残っているため、
 * 担当者の候補に使うときは必ず絞る。過去の記録を表示するときだけ全件を使う。
 */
function commonEmployees_(全員) {
  return commonRows_(COMMON_SHEETS_.EMP_VIEW).filter(function (r) {
    if (String(r['社員コード(xronos)'] || '').trim() === '') return false;
    return 全員 ? true : (String(r['在籍区分'] || '') === '在籍');
  });
}

/** 所属マスタ。`活動中のみ` を渡すと `状態 = 有効` だけを返す */
function commonDepartments_(活動中のみ) {
  return commonRows_(COMMON_SHEETS_.DEPT).filter(function (r) {
    if (String(r['所属コード(xronos)'] || '').trim() === '') return false;
    return 活動中のみ ? (String(r['状態'] || '') === '有効') : true;
  });
}

/**
 * 共通マスタ側の同期が今日成功しているか。**止まっていても読めてしまう**のが
 * このマスタの怖いところで、古い値のまま静かに回り続ける。
 * 「鮮度」とは呼ばない。起きている事実は「向こうの同期が今日走ったか」。
 */
function commonSyncStatus_() {
  var last = null;
  try {
    var rows = commonRows_(COMMON_SHEETS_.SYNC_LOG);
    last = rows.length ? rows[rows.length - 1] : null;
  } catch (e) {
    return { 当日: false, 最終: '', 結果: '同期ログを読めません: ' + String((e && e.message) || e) };
  }
  if (!last) return { 当日: false, 最終: '', 結果: '同期ログが空です' };
  // 列名は common 側の都合で変わりうるので、位置（1列目＝日時／2列目＝結果）で読む
  var keys = Object.keys(last);
  var 日時 = String(last[keys[0]] || '');
  var 結果 = String(last[keys[1]] || '');
  return { 当日: 結果 === '成功' && 日時.indexOf(today_()) === 0, 最終: 日時, 結果: 結果 };
}

/* ============ 控え（common が読めないとき） ============ */

/**
 * 控えを書く。common から読めたときだけ、このアプリのブックの隠しシートに写す。
 * **人は編集しない。** 機械が上書きするだけ。
 * キャッシュ（10分）を超える停止にも耐えるように、隠しシートに置く。
 */
function saveCommonFallback_(people) {
  try {
    var ss = SS_();
    var sh = ss.getSheetByName(COMMON_FALLBACK_SHEET_);
    if (!sh) { sh = ss.insertSheet(COMMON_FALLBACK_SHEET_); sh.hideSheet(); }
    sh.clear();
    sh.getRange(1, 1, 1, 2).setValues([['written_at', 'json']]);
    // 1セルの上限は5万字。人数が多いときは分割して書く
    var text = JSON.stringify(people);
    var chunks = [];
    for (var i = 0; i < text.length; i += 40000) chunks.push(text.slice(i, i + 40000));
    var rows = chunks.map(function (c, idx) { return [idx === 0 ? now_() : '', c]; });
    if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
  } catch (e) {
    // 控えが書けなくてもアプリは動く。次に読めたときに書き直す
  }
}

/** 控えを読む。無ければ null */
function readCommonFallback_() {
  try {
    var sh = SS_().getSheetByName(COMMON_FALLBACK_SHEET_);
    if (!sh || sh.getLastRow() < 2) return null;
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    var text = vals.map(function (r) { return String(r[1] || ''); }).join('');
    if (!text) return null;
    return { writtenAt: String(vals[0][0] || ''), people: JSON.parse(text) };
  } catch (e) {
    return null;
  }
}

/* ============ このアプリが使う形 ============ */

/**
 * 担当者の候補を返す。**このアプリで人を指すのは社員コード**（メールではない）。
 * メールは「いまの連絡先」として、使うそのときに common から引く。
 * こうしておくと、common 側でメールが変わっても担当の紐づけは切れない。
 *
 * @returns [{ code, name, email, deptCode, deptName, positionName }]
 */
function commonPeople_() {
  return commonEmployees_(false).map(function (r) {
    return {
      code: String(r['社員コード(xronos)'] || '').trim(),
      name: String(r['氏名'] || r['社員名'] || '').trim(),
      email: String(r['メールアドレス(xronos)'] || '').trim(),
      deptCode: String(r['所属コード(xronos)'] || '').trim(),
      deptName: String(r['所属名'] || r['所属'] || '').trim(),
      positionName: String(r['役職名'] || r['役職'] || '').trim()
    };
  }).filter(function (p) { return p.code; });
}

/**
 * 人の一覧を返す。common が読めなければ控え、控えも無ければ users シート。
 * **どこから読んだかを必ず返す**。画面に「共通マスタを読めていません」と出すため。
 *
 * @returns { people: [...], source: 'common'|'控え'|'ローカル', note: string, sync: {...}|null }
 */
function peopleForUi_() {
  if (hasCommonMaster_()) {
    try {
      var people = commonPeople_();
      if (people.length) {
        saveCommonFallback_(people);
        var sync = commonSyncStatus_();
        return {
          people: people, source: 'common',
          note: sync.当日 ? '' : '共通マスタの同期が今日まだ走っていません（最終 ' + (sync.最終 || '不明') + '）',
          sync: sync
        };
      }
    } catch (e) {
      var fb = readCommonFallback_();
      if (fb && fb.people && fb.people.length) {
        return {
          people: fb.people, source: '控え',
          note: '共通マスタを読めないため、' + fb.writtenAt + ' に控えた内容を使っています（' +
                String((e && e.message) || e) + '）',
          sync: null
        };
      }
    }
  }

  // common を設定していない、または控えも無い。ローカルの users シートで動かす
  var users = readAll_('users').filter(function (u) { return u.active !== false; });
  return {
    people: users.map(function (u) {
      return { code: u.user_id, name: u.name, email: u.email, deptCode: '', deptName: '', positionName: '' };
    }),
    source: 'ローカル',
    note: hasCommonMaster_() ? '共通マスタを読めないため、このアプリの users シートを使っています' : '',
    sync: null
  };
}

/** 社員コードから氏名を引く（記録の表示に使う） */
function personName_(code) {
  if (!code) return '';
  var list = peopleForUi_().people;
  for (var i = 0; i < list.length; i++) if (list[i].code === code) return list[i].name;
  return '';
}

/* ============ 診断（管理者専用） ============ */

/**
 * 共通マスタに届いているか・中身がどうなっているかを見る。**1行も書かない。**
 * 設定直後の確認と、同期が止まったときの切り分けに使う。
 */
function commonMasterStatus() {
  var me = currentUser_();
  if (!me || me.role !== 'admin') throw new Error('管理者だけが実行できます');
  if (!hasCommonMaster_()) {
    return { 設定: false, 案内: 'スクリプトプロパティ COMMON_MASTER_SS_ID が未設定です。' };
  }
  // **診断はキャッシュを見ない**。10分キャッシュしているので、向こうで列を足した直後に
  // 「まだ無い」と答えてしまう。「本当に無いのか、こちらが古いのか」が分からない診断は、無いより悪い。
  bustCommonCache_();
  var emps = commonEmployees_(true);
  var 在籍 = emps.filter(function (r) { return String(r['在籍区分'] || '') === '在籍'; });
  var depts = commonDepartments_(false);
  var out = {
    設定: true,
    同期状況: commonSyncStatus_(),
    社員: {
      全件: emps.length, 在籍: 在籍.length,
      在籍でメール空: 在籍.filter(function (r) {
        return String(r['メールアドレス(xronos)'] || '').trim() === '';
      }).length
    },
    所属: { 全件: depts.length, 有効: commonDepartments_(true).length },
    メール列: (emps[0] && emps[0]['メールアドレス(xronos)'] !== undefined) ? 'あり' : 'まだ無い',
    // **実際の列をそのまま出す**。「まだ無い」とだけ言われても、向こうの誰に何を頼めばよいか分からない
    社員一覧の列: emps[0] ? Object.keys(emps[0]) : [],
    控え: (function () { var f = readCommonFallback_(); return f ? f.writtenAt + '（' + f.people.length + '人）' : 'なし'; })()
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
