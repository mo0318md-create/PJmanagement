/**
 * 進捗と状態の判定（サーバー側）
 * 要件書 §3 に対応。ブラウザ側の health.html と同じ計算をする。
 *
 * ここはサーバーでも使う：集計キャッシュの更新（Api.gs）と、
 * 毎朝のお知らせ作り（Triggers.gs）から呼ぶ。
 *
 * 【重要】計算を直すときは health.html も同じに直すこと。
 */

function hParse_(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function hToISO_(d) {
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/** b - a（日数）。同じ日なら 0 */
function hDiffDays_(a, b) {
  return Math.round((hParse_(b) - hParse_(a)) / 86400000);
}

function hAddDays_(iso, n) {
  var d = hParse_(iso);
  return hToISO_(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** 両端を含む日数 */
function hDuration_(s, e) { return hDiffDays_(s, e) + 1; }

/** 予定進捗率（§3.1）。期間が無ければ null */
function hPlannedRate_(start, end, today) {
  if (!start || !end) return null;
  var total = hDuration_(start, end);
  var passed = hDiffDays_(start, today) + 1;
  return Math.max(0, Math.min(1, passed / total));
}

/** 子を持たないタスクの進捗率（§3.2）。完了は必ず100% */
function hLeafRate_(node) {
  if (node.status === STATUS.DONE) return 1;
  var v = node.progress_rate;
  if (v === null || v === undefined || v === '') return 0;
  return Math.max(0, Math.min(1, Number(v) / 100));
}

/** 子の単純平均（§3.2） */
function hAverage_(rates) {
  if (!rates.length) return 0;
  var sum = 0;
  rates.forEach(function (r) { sum += r; });
  return sum / rates.length;
}

/**
 * 状態の判定（§3.3）。上から順に見て、最初に合致したものを返す。
 * 簡易版では「遅延」は終了日を過ぎて未完了のときだけ。進捗率は使わない。
 */
function hJudge_(status, start, end, today) {
  if (status === STATUS.DONE) return 'done';
  if (end && today > end) return 'delayed';
  if (!start || !end) return 'no_period';
  if (today < start) return 'not_started';
  return 'on_track';
}

/**
 * プロジェクト1件を、配下のタスクごと計算する。
 * @param project projects の1行
 * @param items   そのプロジェクトの items（level 1 と 2 が混在）
 * @param today   'yyyy-MM-dd'
 * @returns { health, actualRate, plannedRate, taskTotal, taskDone, subTotal, subDone, delayedCount, tasks }
 */
function hEvaluateProject_(project, items, today) {
  var byParent = {};
  items.forEach(function (it) {
    if (Number(it.level) !== 2) return;
    (byParent[it.parent_item_id] = byParent[it.parent_item_id] || []).push(it);
  });
  var bySort = function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); };

  var subTotal = 0, subDone = 0, delayedCount = 0;

  var tasks = items.filter(function (it) { return Number(it.level) === 1; }).sort(bySort).map(function (t) {
    var kids = (byParent[t.item_id] || []).sort(bySort).map(function (s) {
      var h = hJudge_(s.status, s.start_date, s.end_date, today);
      if (h === 'delayed') delayedCount++;
      subTotal++;
      if (s.status === STATUS.DONE) subDone++;
      return { node: s, health: h, rate: hLeafRate_(s) };
    });

    var rate = kids.length ? hAverage_(kids.map(function (k) { return k.rate; })) : hLeafRate_(t);
    var health = hJudge_(t.status, t.start_date, t.end_date, today);
    if (health === 'delayed') delayedCount++;
    return { node: t, health: health, rate: rate, kids: kids };
  });

  var taskTotal = tasks.length;
  var taskDone = tasks.filter(function (t) { return t.node.status === STATUS.DONE; }).length;
  var actual = tasks.length ? hAverage_(tasks.map(function (t) { return t.rate; })) : 0;
  var planned = hPlannedRate_(project.start_date, project.end_date, today);

  return {
    health: hJudge_(project.status, project.start_date, project.end_date, today),
    actualRate: Math.round(actual * 100),
    plannedRate: planned === null ? 0 : Math.round(planned * 100),
    taskTotal: taskTotal,
    taskDone: taskDone,
    subTotal: subTotal,
    subDone: subDone,
    delayedCount: delayedCount,
    tasks: tasks
  };
}
