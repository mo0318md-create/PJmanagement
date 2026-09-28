/**
 * 進捗と状態の判定（簡易版）
 * 要件書 §3 に対応。引数だけで答えが決まる純粋な関数だけを置く。
 * ブラウザでもGAS（集計キャッシュ・お知らせの生成）でも同じコードを使う。
 */
(function (global) {
  'use strict';

  // ---------------- 日付 ----------------

  function toISO(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parse(iso) { return new Date(iso + 'T00:00:00'); }
  function addDays(iso, n) {
    var d = parse(iso);
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  }
  /** b - a（日数）。同じ日なら 0 */
  function diffDays(a, b) {
    return Math.round((parse(b) - parse(a)) / 86400000);
  }
  /** 両端を含む日数 */
  function durationDays(start, end) { return diffDays(start, end) + 1; }

  var DOW = ['日', '月', '火', '水', '木', '金', '土'];
  function formatDate(iso) {
    if (!iso) return '—';
    var d = parse(iso);
    return (d.getMonth() + 1) + '/' + d.getDate() + '(' + DOW[d.getDay()] + ')';
  }
  function formatDateY(iso) {
    if (!iso) return '—';
    return parse(iso).getFullYear() + '/' + formatDate(iso);
  }

  // ---------------- ステータス（4つ固定） ----------------

  var STATUS = { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', ON_HOLD: 'on_hold', DONE: 'done' };
  var STATUS_LABEL = { not_started: '未着手', in_progress: '進行中', on_hold: '保留', done: '完了' };
  var STATUS_ORDER = ['not_started', 'in_progress', 'on_hold', 'done'];

  var TYPE_LABEL = { work: '作業', bug: 'バグ', req: '要望' };
  var TYPE_ICON = { work: '▣', bug: '✳', req: '◈' };

  // 簡易版の状態は5つ。「注意」は持たない（判定が終了日だけのため）
  var HEALTH_LABEL = {
    done: '完了', delayed: '遅延', on_track: '対応中', not_started: '開始前', no_period: '期間未設定'
  };
  var HEALTH_ICON = {
    done: '✓', delayed: '!', on_track: '●', not_started: '・', no_period: '—'
  };

  // ---------------- §3.1 予定進捗率 ----------------

  /** 期間に対して今日がどこまで来ているか。0〜1。期間が無ければ null */
  function plannedRate(startDate, endDate, today) {
    if (!startDate || !endDate) return null;
    var total = durationDays(startDate, endDate);
    var passed = diffDays(startDate, today) + 1;
    return Math.max(0, Math.min(1, passed / total));
  }

  // ---------------- §3.2 実績進捗率（手入力） ----------------

  /**
   * 子を持たないタスクの進捗率。0〜1。
   * 完了なら必ず 100%。それ以外は手入力の値（未入力は 0%）。
   */
  function leafRate(node) {
    if (node.status === STATUS.DONE) return 1;
    var v = node.progressRate;
    if (v === null || v === undefined || v === '') return 0;
    return Math.max(0, Math.min(1, Number(v) / 100));
  }

  /** 子を持つときの進捗率＝子の単純平均（要件 §3.2） */
  function averageRate(childRates) {
    if (!childRates.length) return 0;
    var sum = 0;
    childRates.forEach(function (r) { sum += r; });
    return sum / childRates.length;
  }

  // ---------------- §3.3 状態 ----------------

  /**
   * 上から順に見て、最初に合致したものを返す。
   *
   * 簡易版では「遅延」は**終了日を過ぎて未完了**のときだけ。
   * 進捗率と予定進捗率の差では判定しない（＝「注意」は無い）。
   * 進捗率の入力が滞っても判定がぶれない代わりに、
   * 終了日が来るまでは遅れかけていても「対応中」のままになる。
   */
  function judge(o) {
    if (o.status === STATUS.DONE) return 'done';
    if (o.endDate && o.today > o.endDate) return 'delayed';
    if (!o.startDate || !o.endDate) return 'no_period';
    if (o.today < o.startDate) return 'not_started';
    return 'on_track';
  }

  // ---------------- 1件ぶんの計算 ----------------

  /**
   * @param node  { status, startDate, endDate, progressRate }
   * @param children  計算済みの子（[{ calc }]）。無ければ空配列
   * @param ctx   { today }
   */
  function evaluate(node, children, ctx) {
    var today = ctx.today;
    var hasChildren = children.length > 0;

    var actualRate = hasChildren
      ? averageRate(children.map(function (c) { return c.calc.actualRate; }))
      : leafRate(node);

    var planned = plannedRate(node.startDate, node.endDate, today);
    var health = judge({
      status: node.status, startDate: node.startDate, endDate: node.endDate, today: today
    });

    // 終了日までの残り日数。マイナスなら超過している
    var remainingDays = node.endDate ? diffDays(today, node.endDate) : null;
    var overDays = (remainingDays !== null && remainingDays < 0 && node.status !== STATUS.DONE)
      ? -remainingDays : 0;

    // 配下の遅延件数（親が対応中でも中に遅延があることを一覧で出すため）
    var delayedInside = 0;
    children.forEach(function (c) {
      if (c.calc.health === 'delayed') delayedInside++;
      delayedInside += c.calc.delayedInside;
    });

    return {
      actualRate: actualRate,
      plannedRate: planned,
      delta: planned === null ? null : actualRate - planned,
      health: health,
      hasChildren: hasChildren,
      remainingDays: remainingDays,
      overDays: overDays,
      delayedInside: delayedInside,
      doneCount: children.filter(function (c) { return c.node.status === STATUS.DONE; }).length,
      childCount: children.length
    };
  }

  // ---------------- ツリー全体 ----------------

  /**
   * プロジェクト1件を、配下のタスクごと計算してツリーにする。
   * @param project  プロジェクト1件
   * @param items    そのプロジェクトのタスク（level 1 / 2 が混在）
   * @param ctx      { today }
   * @returns { node, calc, children: [ { node, calc, children: [...] } ] }
   */
  function evaluateTree(project, items, ctx) {
    var byParent = {};
    items.forEach(function (it) {
      if (it.level !== 2) return;
      (byParent[it.parentItemId] = byParent[it.parentItemId] || []).push(it);
    });
    var bySort = function (a, b) { return a.sortOrder - b.sortOrder; };

    var tasks = items.filter(function (it) { return it.level === 1; }).sort(bySort).map(function (task) {
      var subs = (byParent[task.itemId] || []).sort(bySort).map(function (sub) {
        return { node: sub, calc: evaluate(sub, [], ctx), children: [] };
      });
      return { node: task, calc: evaluate(task, subs, ctx), children: subs };
    });

    return { node: project, calc: evaluate(project, tasks, ctx), children: tasks };
  }

  /** ツリーを平らにする（リスト・ガント・検索で使う） */
  function flatten(tree) {
    var out = [];
    tree.children.forEach(function (t) {
      out.push(t);
      t.children.forEach(function (s) { out.push(s); });
    });
    return out;
  }

  function pct(rate) { return rate === null || rate === undefined ? '—' : Math.round(rate * 100) + '%'; }

  global.Health = {
    toISO: toISO, parse: parse, addDays: addDays, diffDays: diffDays, durationDays: durationDays,
    formatDate: formatDate, formatDateY: formatDateY,
    STATUS: STATUS, STATUS_LABEL: STATUS_LABEL, STATUS_ORDER: STATUS_ORDER,
    TYPE_LABEL: TYPE_LABEL, TYPE_ICON: TYPE_ICON,
    HEALTH_LABEL: HEALTH_LABEL, HEALTH_ICON: HEALTH_ICON,
    plannedRate: plannedRate, leafRate: leafRate, averageRate: averageRate,
    judge: judge, evaluate: evaluate, evaluateTree: evaluateTree, flatten: flatten, pct: pct
  };
})(window);
