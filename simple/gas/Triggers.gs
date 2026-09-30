/**
 * 毎朝の処理（簡易版）
 * 要件書 §5.4 に対応。
 *
 *   1. 全プロジェクトの集計キャッシュを計算し直す
 *      （状態と予定進捗率は「今日」に依存するので、誰も触らなくても日付が変われば変わる）
 *   2. 期限が近いタスク・遅延になったタスクのお知らせを作る
 *   3. 古いお知らせを消す
 *
 * 1,000行の走査と書き込みで、6分の実行制限には十分収まる。
 */

function dailyJob() {
  var t = today_();
  var s = readSettings_();

  refreshAllSummaries();

  var items = readAll_('items');
  var projects = {};
  readAll_('projects').forEach(function (p) { projects[p.project_id] = p; });

  // 今日すでに作ったお知らせ（二重に作らないため）
  var madeToday = {};
  readAll_('notifications').forEach(function (n) {
    if (String(n.created_at).slice(0, 10) === t) madeToday[n.kind + '|' + n.item_id + '|' + n.user_id] = true;
  });

  var created = 0;
  items.forEach(function (it) {
    if (!it.assignee_user_id) return;
    if (it.status === STATUS.DONE) return;
    if (!it.end_date) return;

    var p = projects[it.project_id];
    var name = it.name;

    // 期限の前日と当日
    if (settingBool_(s, 'notify_due')) {
      var left = hDiffDays_(t, it.end_date);
      if (left === 0 || left === 1) {
        var k1 = 'due|' + it.item_id + '|' + it.assignee_user_id;
        if (!madeToday[k1]) {
          addNotification_(it.assignee_user_id, 'due',
            '「' + name + '」は ' + fmtDate_(it.end_date) + ' が期限です', it.project_id, it.item_id);
          madeToday[k1] = true;
          created++;
        }
      }
    }

    // 遅延になった（前日は遅延でなかったものだけ）
    if (settingBool_(s, 'notify_delayed')) {
      var wasDelayed = hJudge_(it.status, it.start_date, it.end_date, hAddDays_(t, -1)) === 'delayed';
      var isDelayed = hJudge_(it.status, it.start_date, it.end_date, t) === 'delayed';
      if (isDelayed && !wasDelayed) {
        var k2 = 'delayed|' + it.item_id + '|' + it.assignee_user_id;
        if (!madeToday[k2]) {
          addNotification_(it.assignee_user_id, 'delayed',
            '「' + name + '」が遅延になりました', it.project_id, it.item_id);
          madeToday[k2] = true;
          created++;
        }
      }
    }
  });

  var removed = cleanOldNotifications_(settingNum_(s, 'notify_keep_days'));
  return 'お知らせ ' + created + ' 件を作り、' + removed + ' 件を消しました';
}

/** お知らせを1件足す */
function addNotification_(userId, kind, title, projectId, itemId) {
  insertRow_('notifications', {
    notification_id: uuid_(),
    user_id: userId,
    kind: kind,
    title: title,
    project_id: projectId || '',
    item_id: itemId || '',
    read: false,
    created_at: now_()
  });
}

/**
 * 担当者が変わったときのお知らせ（その場で作る）
 * 旧担当に「外れた」、新担当に「担当になった」。
 */
function notifyAssignChange_(item, oldUserId, newUserId) {
  var s = readSettings_();
  if (!settingBool_(s, 'notify_assign')) return;
  if (oldUserId) addNotification_(oldUserId, 'unassigned', '「' + item.name + '」の担当から外れました', item.project_id, item.item_id);
  if (newUserId) addNotification_(newUserId, 'assigned', '「' + item.name + '」の担当になりました', item.project_id, item.item_id);
}

/** 古いお知らせを消す */
function cleanOldNotifications_(keepDays) {
  var limit = hAddDays_(today_(), -Math.abs(keepDays || 90));
  return deleteRowsWhere_('notifications', function (n) {
    return String(n.created_at).slice(0, 10) < limit;
  });
}

function fmtDate_(iso) {
  if (!iso) return '';
  // 期限の表示は yyyy/mm/dd に統一（画面と同じ）
  var d = hParse_(iso), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '/' + p2(d.getMonth() + 1) + '/' + p2(d.getDate());
}
