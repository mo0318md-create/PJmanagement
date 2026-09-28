/**
 * Webアプリの入口（簡易版）
 *
 * 画面は1ページ。HtmlService はページ遷移のたびに doGet が走って毎回2〜4秒かかるので、
 * 画面の切り替えはブラウザ側で行い、サーバーへは行かない（要件書 §5.1）。
 */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('index');
  t.appTitle = 'PJ管理';
  return t.evaluate()
    .setTitle('PJ管理')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
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
