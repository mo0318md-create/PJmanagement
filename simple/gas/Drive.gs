/**
 * プロジェクトごとの資料フォルダ（要件 F-5-17）
 *
 * ・フォルダは「決めた親フォルダ」の下に、[キー] プロジェクト名 で作る。
 * ・作るのはボタンを押したときだけ（プロジェクトの作成は速いままにする）。
 * ・親フォルダのIDは、共通マスタと同じくスクリプトプロパティに置く（本番とテストで差し替えるため）。
 * ・このアプリは「アクセスした人の権限」で動くので、親フォルダは共有ドライブか、
 *   全員に共有されたフォルダであること。そうでないと、作った人以外が開けない。
 */

/** 親フォルダのID。未設定なら、何をすればよいかまで言う */
function driveRootId_() {
  var id = PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID');
  if (!id) {
    throw new Error('DRIVE_ROOT_FOLDER_ID が未設定です。' +
      '資料フォルダを置く親フォルダ（共有ドライブの中か、全員に共有したフォルダ）のIDを、' +
      'GASエディタの プロジェクトの設定 ▸ スクリプト プロパティ に登録してください。');
  }
  return id;
}

/** 親フォルダが設定されているか（例外を投げずに知りたいとき） */
function hasDriveRoot_() {
  try { return !!PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID'); }
  catch (e) { return false; }
}

/** フォルダの名前。[CORP] コーポレートサイトリニューアル */
function folderName_(p) {
  return '[' + String(p.key || '').trim() + '] ' + String(p.name || '').trim();
}

function folderUrl_(id) { return 'https://drive.google.com/drive/folders/' + id; }

/**
 * 資料フォルダを開く。無ければ作ってから返す。
 * @return { url, folder_id, created } created=true なら今作った
 */
function openProjectFolder(projectId) {
  var me = currentUser_();
  return withLock_(function () {
    var p = findById_('projects', projectId);
    if (!p) throw new Error('プロジェクトが見つかりません');

    // すでにあれば、それが今も開けるかだけ確かめて返す
    if (p.drive_folder_id) {
      try {
        var f = DriveApp.getFolderById(p.drive_folder_id);
        if (!f.isTrashed()) return { url: folderUrl_(p.drive_folder_id), folder_id: p.drive_folder_id, created: false };
      } catch (e) {
        throw new Error('登録されている資料フォルダを開けません。' +
          '消されたか、共有されていない可能性があります。プロジェクトの編集で登録し直してください。');
      }
    }

    var root;
    try {
      root = DriveApp.getFolderById(driveRootId_());
    } catch (e) {
      if (String(e.message).indexOf('DRIVE_ROOT_FOLDER_ID') >= 0) throw e;
      throw new Error('資料フォルダを置く親フォルダを開けません。' +
        'あなたにそのフォルダが共有されているか、管理者に確認してください。');
    }

    // 同じ名前のフォルダがすでにあれば、それを使う（作り直さない）
    var name = folderName_(p), folder = null;
    var it = root.getFoldersByName(name);
    if (it.hasNext()) folder = it.next();
    else folder = root.createFolder(name);

    updateRow_('projects', p.project_id, stampEdit_({ drive_folder_id: folder.getId() }, me));
    return { url: folderUrl_(folder.getId()), folder_id: folder.getId(), created: true };
  });
}

/** 資料フォルダを手で登録する／外す（URL でも ID でもよい）。Drive の権限は要らない */
function setProjectFolder(projectId, urlOrId) {
  var me = currentUser_();
  return withLock_(function () {
    var p = findById_('projects', projectId);
    if (!p) throw new Error('プロジェクトが見つかりません');
    var s = String(urlOrId || '').trim();
    var id = '';
    if (s) {
      var m = s.match(/[-\w]{25,}/);
      if (!m) throw new Error('フォルダのURLが読み取れません。Drive でフォルダを開いて「リンクをコピー」した文字列を貼ってください。');
      id = m[0];
    }
    updateRow_('projects', p.project_id, stampEdit_({ drive_folder_id: id }, me));
    return { ok: true, folder_id: id, url: id ? folderUrl_(id) : '' };
  });
}
