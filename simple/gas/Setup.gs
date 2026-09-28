/**
 * 初期セットアップ（簡易版）
 *
 * 使い方
 *   1. スプレッドシートを1つ作る（またはこのスクリプトを紐づけたシートを使う）
 *   2. スタンドアロンの場合は、スクリプトプロパティに SPREADSHEET_ID を入れる
 *   3. エディタで setup() を実行する → 9シートを作り、ヘッダーと初期設定を入れる
 *   4. 試したい場合は seedSampleData() を実行する → 見本のデータが入る
 *   5. installDailyTrigger() を実行する → 毎朝のお知らせ作りを仕掛ける
 *   6. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」で公開する
 */

/**
 * データを置くスプレッドシートを新しく作り、そのIDをスクリプトプロパティに登録する。
 * スタンドアロンのスクリプト（シートに紐づいていない）で、最初に1度だけ実行する。
 * すでに登録済みなら何もしない。続けて setup() まで済ませる。
 */
function createSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try {
      var exist = SpreadsheetApp.openById(id);
      return 'すでに登録済みです：' + exist.getName() + '\n' + exist.getUrl();
    } catch (e) {
      // 登録されているが開けない。作り直してよいか分からないので、ここでは消さずに知らせる
      throw new Error('SPREADSHEET_ID（' + id + '）が登録されていますが開けません。' +
        '別のブックを使うなら、スクリプト プロパティからこの値を消してから実行してください。');
    }
  }
  var ss = SpreadsheetApp.create('PJ管理データ');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  // 作ったばかりの「シート1」は使わないので、9シートを作ってから消す
  var msg = setup();
  var first = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  return 'スプレッドシートを作り、IDを登録しました。\n' + ss.getUrl() + '\n' + msg;
}

/** 9シートを作り、ヘッダーと初期設定を入れる。何度実行しても壊れない */
function setup() {
  Object.keys(SHEETS).forEach(function (name) {
    var sh = sheet_(name);
    var head = header_(sh);
    var cols = SHEETS[name].cols;
    // ヘッダーが空、または足りない列があれば整える
    if (head.length === 0 || head[0] === '') {
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      var missing = cols.filter(function (c) { return head.indexOf(c) < 0; });
      if (missing.length) {
        sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      }
    }
  });

  // 設定の既定値
  Object.keys(SETTING_DEFAULTS).forEach(function (k) {
    if (!findById_('settings', k)) {
      insertRow_('settings', { key: k, value: SETTING_DEFAULTS[k], description: SETTING_DESC[k] || '' });
    }
  });

  // 最初のユーザー（実行した人）を管理者として登録
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  if (email && !readAll_('users').some(function (u) { return String(u.email).toLowerCase() === email.toLowerCase(); })) {
    insertRow_('users', {
      user_id: uuid_(), name: email.split('@')[0], email: email,
      role: 'admin', active: true, created_at: now_()
    });
  }

  SpreadsheetApp.flush();
  return '9シートを用意しました。' + (email ? email + ' を管理者として登録しました。' : '');
}

/** 見本のデータを入れる（テンプレート1件とユーザー数名）。空のときだけ動く */
function seedSampleData() {
  if (readAll_('templates').length) return 'すでにテンプレートがあるため、何もしませんでした';

  var users = [
    ['山田 太郎', 'yamada@example.co.jp', 'admin'],
    ['佐藤 花子', 'sato@example.co.jp', 'member'],
    ['鈴木 一郎', 'suzuki@example.co.jp', 'member'],
    ['田中 美咲', 'tanaka@example.co.jp', 'admin'],
    ['高橋 健', 'takahashi@example.co.jp', 'member']
  ];
  users.forEach(function (u) {
    if (readAll_('users').some(function (x) { return x.email === u[1]; })) return;
    insertRow_('users', { user_id: uuid_(), name: u[0], email: u[1], role: u[2], active: true, created_at: now_() });
  });

  var tplId = uuid_();
  insertRow_('templates', {
    template_id: tplId, name: 'Webサイト制作', description: 'コーポレートサイト・採用サイトなどの制作案件',
    key_prefix: 'WEB', active: true, sort_order: 100, created_at: now_(), updated_at: now_()
  });

  // 親タスク（level 1）と子タスク（level 2）
  var parents = [
    ['要件定義', 0, 11], ['情報設計', 8, 10], ['デザイン', 15, 28],
    ['コンテンツ制作', 23, 25], ['実装', 35, 17], ['総合テスト', 52, 5], ['本番公開', 57, 4]
  ];
  var ids = {};
  parents.forEach(function (p, i) {
    var id = uuid_();
    ids[p[0]] = id;
    insertRow_('template_items', {
      template_item_id: id, template_id: tplId, level: 1, parent_template_item_id: '',
      sort_order: (i + 1) * 100, name: p[0], item_type: 'work',
      start_offset_days: p[1], duration_days: p[2]
    });
  });
  var kids = [
    ['デザイン', 'ワイヤーフレーム', 15, 7], ['デザイン', 'トップページデザイン', 22, 13],
    ['デザイン', '下層ページデザイン', 25, 18],
    ['実装', 'フロント実装', 35, 11], ['実装', 'CMS構築', 42, 10]
  ];
  kids.forEach(function (k, i) {
    insertRow_('template_items', {
      template_item_id: uuid_(), template_id: tplId, level: 2, parent_template_item_id: ids[k[0]],
      sort_order: (i + 1) * 100, name: k[1], item_type: 'work',
      start_offset_days: k[2], duration_days: k[3]
    });
  });

  var fields = [
    ['client_name', 'クライアント名', 'text', true, []],
    ['contract_type', '契約区分', 'select', true, ['新規', 'リニューアル', '保守']],
    ['budget', '予算（万円）', 'number', false, []],
    ['kickoff_date', 'キックオフ日', 'date', false, []],
    ['needs_cms', 'CMSを入れる', 'checkbox', false, []]
  ];
  fields.forEach(function (f, i) {
    insertRow_('template_fields', {
      field_id: uuid_(), template_id: tplId, field_key: f[0], label: f[1],
      type: f[2], required: f[3], options: f[4], sort_order: (i + 1) * 100
    });
  });

  SpreadsheetApp.flush();
  return 'テンプレート「Webサイト制作」と、ユーザー ' + users.length + ' 名を入れました';
}

/** 毎朝のトリガーを仕掛ける（二重に作らない） */
function installDailyTrigger() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyJob'; });
  if (exists) return 'すでに仕掛けてあります';
  ScriptApp.newTrigger('dailyJob').timeBased().atHour(7).everyDays(1).create();
  return '毎朝7時台に dailyJob を動かすよう仕掛けました';
}

/** 仕掛けたトリガーを外す */
function removeDailyTrigger() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailyJob') { ScriptApp.deleteTrigger(t); n++; }
  });
  return n + ' 件のトリガーを外しました';
}
