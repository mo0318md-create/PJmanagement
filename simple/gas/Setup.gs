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
 *
 * スクリプトプロパティ（プロジェクトの設定 ▸ スクリプト プロパティ で入れる）
 *   SPREADSHEET_ID        … データを置くスプレッドシートのID（必須）
 *   COMMON_MASTER_SS_ID   … 共通マスタ（社員・所属）のスプレッドシートのID
 *   DRIVE_ROOT_FOLDER_ID  … 資料フォルダを置く親フォルダのID（F-5-17）
 *                           入れたら checkDriveRoot() を実行して、正しいか確かめる
 *
 * common を読む前に作ったデータがあるとき
 *   migrateIdsPreview() で下見 → migrateIdsApply() で、古い人のIDを社員コードに付け替える
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

/* ============ common 連携前のIDを社員コードに付け替える ============
 *
 * common を読む前は、人をこのアプリの users シートのID（や、メールアドレス）で記録していた。
 * いまは common の社員コードで人を指すので、古いIDのままの行は「（一覧に無い人）」になる。
 *
 * 使い方（どちらもエディタから実行。管理者だけ）
 *   1. migrateIdsPreview() … 何をどう付け替えるかをログに出すだけ。**1行も書かない**
 *   2. 中身を確かめたら migrateIdsApply() … 実際に書き換える
 *
 * 付け替え方：古いIDから users シートのメールを引き（IDがメールならそのまま）、
 * common の社員一覧で同じメールの人の社員コードにする。見つからないIDは触らず「未解決」として出す。
 * 記録の名前（〜_by_name）も common の氏名にそろえる。更新日時は変えない（人の操作ではないため）。
 */
var MIGRATE_TARGETS_ = [
  { sheet: 'projects', cols: [['owner_user_id', null], ['created_by', 'created_by_name'], ['updated_by', 'updated_by_name']] },
  { sheet: 'items', cols: [['assignee_user_id', null], ['created_by', 'created_by_name'], ['updated_by', 'updated_by_name']] },
  { sheet: 'templates', cols: [['created_by', 'created_by_name'], ['updated_by', 'updated_by_name']] },
  { sheet: 'notifications', cols: [['user_id', null]] }
];

function migrateIdsPreview() { return migrateIds_(false); }
function migrateIdsApply() { return migrateIds_(true); }

function migrateIds_(apply) {
  var me = currentUser_();
  if (!me || me.role !== 'admin') throw new Error('管理者だけが実行できます');
  if (!hasCommonMaster_()) throw new Error('COMMON_MASTER_SS_ID が未設定です。common を読めるようにしてから実行してください');

  var people = commonPeople_();
  var codes = {}, byEmail = {};
  people.forEach(function (p) {
    codes[p.code] = p;
    if (p.email) byEmail[p.email.toLowerCase()] = p;
  });
  var localEmail = {};
  readAll_('users').forEach(function (u) { if (u.user_id) localEmail[String(u.user_id)] = String(u.email || '').toLowerCase(); });

  // 古いID → common の人（見つからなければ null）
  var map = {}, unresolved = {};
  function resolve(id) {
    id = String(id || '').trim();
    if (!id || codes[id]) return null;            // 空、またはすでに社員コード
    if (map.hasOwnProperty(id)) return map[id];
    var email = localEmail[id] || (id.indexOf('@') > 0 ? id.toLowerCase() : '');
    var p = email ? byEmail[email] : null;
    map[id] = p || null;
    if (!p) unresolved[id] = email || '（メールが分からない）';
    return map[id];
  }

  var count = {};
  var work = function () {
    MIGRATE_TARGETS_.forEach(function (t) {
      readAll_(t.sheet).forEach(function (row) {
        var patch = {};
        t.cols.forEach(function (pair) {
          var p = resolve(row[pair[0]]);
          if (!p) return;
          patch[pair[0]] = p.code;
          if (pair[1]) patch[pair[1]] = p.name;
          var k = t.sheet + '.' + pair[0];
          count[k] = (count[k] || 0) + 1;
        });
        if (apply && Object.keys(patch).length) updateRow_(t.sheet, row[SHEETS[t.sheet].key], patch);
      });
    });
  };
  if (apply) withLock_(work); else work();

  var out = {
    実行: apply ? '書き換えました' : '下見だけです（何も書いていません）。よければ migrateIdsApply() を実行してください',
    付け替え: Object.keys(map).filter(function (k) { return map[k]; }).map(function (k) {
      return k + ' → ' + map[k].code + '（' + map[k].name + '）';
    }),
    件数: count,
    未解決: Object.keys(unresolved).map(function (k) {
      return k + '（' + unresolved[k] + '）… common の社員一覧に同じメールの人がいません。触っていません';
    })
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/**
 * 資料フォルダの親フォルダ（DRIVE_ROOT_FOLDER_ID）が正しく入っているか確かめる。
 * 入れたあとに1度実行して、出てきた文章を読む。
 */
function checkDriveRoot() {
  var id = PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID');
  if (!id) {
    return 'DRIVE_ROOT_FOLDER_ID が入っていません。' +
      'プロジェクトの設定 ▸ スクリプト プロパティ で、資料フォルダを置く親フォルダのIDを入れてください。';
  }
  var folder;
  try {
    folder = DriveApp.getFolderById(id);
  } catch (e) {
    return 'そのIDのフォルダを開けません（入っている値：' + id + '）。' +
      'IDが違うか、このアカウントに共有されていません。' +
      'Drive でフォルダを開いたときのURLの folders/ のうしろを入れてください。';
  }

  var out = ['フォルダ名：' + folder.getName(), 'URL：' + folder.getUrl()];
  // 共有ドライブの中にあるか（親をたどれなければ共有ドライブの直下）
  var inShared = false;
  try {
    var parents = folder.getParents();
    inShared = !parents.hasNext();
  } catch (e) { inShared = true; }

  if (inShared) {
    out.push('置き場所：共有ドライブの中とみられます。全員が開けるので、このまま使えます。');
  } else {
    var access = String(folder.getSharingAccess());
    if (access === 'DOMAIN' || access === 'DOMAIN_WITH_LINK' || access === 'ANYONE' || access === 'ANYONE_WITH_LINK') {
      out.push('置き場所：個人のドライブですが、組織に共有されています（' + access + '）。使えます。');
    } else {
      out.push('⚠ 置き場所：個人のドライブで、組織に共有されていません（' + access + '）。' +
        'このままだと、フォルダを作った人以外は開けません。' +
        '共有ドライブに移すか、このフォルダを nazatec.co.jp 全員に共有してください。');
    }
  }
  // 書き込めるかどうか（フォルダを作れないと意味がない）
  try {
    var t = folder.createFolder('__確認用（すぐ消します）__');
    t.setTrashed(true);
    out.push('書き込み：できます。設定は完了です。');
  } catch (e) {
    out.push('⚠ 書き込み：できません。このフォルダへの編集権限がありません。');
  }
  return out.join('\n');
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
