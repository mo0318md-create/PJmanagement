/**
 * Webアプリの入口（簡易版）
 *
 * 画面は1ページ。HtmlService はページ遷移のたびに doGet が走って毎回2〜4秒かかるので、
 * 画面の切り替えはブラウザ側で行い、サーバーへは行かない（要件書 §5.1）。
 */

/**
 * 各ページに直接アクセスできるようにする（要件 F-6-1）。
 *
 *   ?p=projects            プロジェクト一覧
 *   ?p=detail&id=<UUID>    プロジェクト詳細
 *   ?p=task&id=<UUID>      タスクの編集を開いた状態
 *   ?p=mine / people / search / new / notifications
 *
 * 【安全のための決まり】
 *  - **URLの値は信用しない。** 画面名は決め打ちの一覧に無ければ一覧に落とす。
 *    IDは形（UUID）だけを見て通し、実在と閲覧可否はブラウザ側で読み込んだデータで確かめる。
 *  - **URLは権限を与えない。** リンクを知っていても、ウェブアプリの公開範囲
 *    （appsscript.json の access）の外の人は開けない。ここは Google 側が守る。
 *  - **IDをそのまま画面に出さない。** 取り違えたときは「見つかりません」とだけ返す。
 */
var ALLOWED_PAGES_ = ['projects', 'detail', 'task', 'mine', 'people', 'search', 'new', 'notifications'];

function doGet(e) {
  var p = (e && e.parameter) || {};

  // 画面名：決め打ちの一覧にあるものだけ通す。無ければ一覧
  var page = ALLOWED_PAGES_.indexOf(String(p.p || '')) >= 0 ? String(p.p) : 'projects';

  // ID：UUIDの形だけを見る。実在の確認はブラウザ側（読み込んだデータの中）で行う
  var id = String(p.id || '');
  if (!/^[0-9a-fA-F-]{8,40}$/.test(id)) id = '';

  var t = HtmlService.createTemplateFromFile('index');
  t.appTitle = 'PJ管理';
  t.initialPage = page;
  t.initialId = id;
  return t.evaluate()
    .setTitle('PJ管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** index.html から <?!= include('css') ?> のように差し込む */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * 動作確認用。エディタから実行すると、シートの状態を Logger に出す。
 * 初回は setup() → seedSampleData() の順に実行すること。
 */
function checkSetup() {
  var lines = [];
  Object.keys(SHEETS).forEach(function (name) {
    var rows = readAll_(name);
    lines.push(name + ': ' + rows.length + ' 行');
  });
  lines.push('今日: ' + today_());
  var me = currentUser_();
  lines.push('ログイン中: ' + (me ? me.name + '（' + me.role + '）' : '未登録'));
  var msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}
