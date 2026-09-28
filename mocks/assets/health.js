/**
 * health.js ─ 期間と進捗から「順調 / 遅延」を判定する共通ロジック
 *
 * モックと本実装（GAS / Firebase）の両方から同じコードを使う。
 * 外部依存なし。ブラウザでは window.Health、GASでは this.Health として公開される。
 * 仕様は docs/requirements.md §F-2 / §3 を参照。
 *
 * ステータスはプロジェクトごとにカスタム定義される（例: 未対応 / デザイン中 / レビュー待ち / 完了）。
 * 判定ロジックが見るのは個々のステータスではなく、各ステータスが持つ
 * 「分類（category）」= not_started / in_progress / on_hold / done の4種。
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------------
  // 定数
  // ------------------------------------------------------------------

  /** ステータスの分類。判定ロジックが見るのはこちら */
  var CATEGORY = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    DONE: 'done'
  };

  var CATEGORY_LABEL = {
    not_started: '未着手',
    in_progress: '進行中',
    on_hold: '保留',
    done: '完了'
  };

  /** ステータス定義を持たないプロジェクト用の既定列 */
  var DEFAULT_STATUSES = [
    { key: 'not_started', label: '未着手', category: 'not_started', color: 'gray', order: 100 },
    { key: 'in_progress', label: '進行中', category: 'in_progress', color: 'blue', order: 200 },
    { key: 'on_hold', label: '保留', category: 'on_hold', color: 'amber', order: 300 },
    { key: 'done', label: '完了', category: 'done', color: 'green', order: 400 }
  ];

  var HEALTH = {
    DONE: 'done',
    NOT_STARTED: 'not_started',
    ON_TRACK: 'on_track',
    AT_RISK: 'at_risk',
    DELAYED: 'delayed',
    NO_DATE: 'no_date'
  };

  var HEALTH_LABEL = {
    done: '完了',
    not_started: '開始前',
    on_track: '順調',
    at_risk: '注意',
    delayed: '遅延',
    no_date: '期間未設定'
  };

  // 色に依存しないための記号（色覚多様性への配慮 / F-2-11）
  var HEALTH_ICON = {
    done: '✓',
    not_started: '・',
    on_track: '●',
    at_risk: '▲',
    delayed: '!'
  };

  var PRIORITY = { HIGH: 'high', NORMAL: 'normal', LOW: 'low' };
  var PRIORITY_LABEL = { high: '高', normal: '中', low: '低' };
  var PRIORITY_ICON = { high: '▲', normal: '－', low: '▼' };
  var PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

  var MODE = { AUTO: 'auto', MANUAL: 'manual', DEADLINE: 'deadline' };

  var MODE_LABEL = {
    auto: '自動集計',
    manual: '進捗率手入力',
    deadline: '終了日超過のみ'
  };

  var MODE_DESC = {
    auto: 'ステータスと子タスクの完了状況から進捗率を自動集計し、予定進捗と比較します。',
    manual: '各タスクに入力された進捗率(%)を予定進捗と比較します。未入力のタスクは自動集計にフォールバックします。',
    deadline: '進捗率は使わず、終了日を過ぎて未完了のものだけを遅延と判定します。'
  };

  var DEFAULT_THRESHOLDS = { atRisk: -0.10, delayed: -0.25 };

  // ステータス分類 → 進捗率換算（子を持たないタスク用）
  var CATEGORY_RATE = {
    not_started: 0,
    in_progress: 0.5,
    on_hold: 0.5,
    done: 1
  };

  // ------------------------------------------------------------------
  // 日付ユーティリティ（すべて 'YYYY-MM-DD' 文字列で扱う）
  // ------------------------------------------------------------------

  function toDate(iso) {
    if (!iso) return null;
    var p = String(iso).split('-');
    if (p.length !== 3) return null;
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function toISO(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function todayISO() {
    return toISO(new Date());
  }

  /** fromIso から toIso までの日数（to - from）。同日なら 0 */
  function diffDays(fromIso, toIso) {
    var a = toDate(fromIso);
    var b = toDate(toIso);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function addDays(iso, n) {
    var d = toDate(iso);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  /** 'YYYY-MM-DD' → 'M/D(曜)' */
  function formatDate(iso, withYear) {
    var d = toDate(iso);
    if (!d) return '—';
    var w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    var head = withYear ? d.getFullYear() + '/' : '';
    return head + (d.getMonth() + 1) + '/' + d.getDate() + '(' + w + ')';
  }

  // ------------------------------------------------------------------
  // ステータスの解決
  // ------------------------------------------------------------------

  /** プロジェクトのステータス定義（未定義なら既定列） */
  function statusesOf(project) {
    var list = (project && project.statuses && project.statuses.length)
      ? project.statuses : DEFAULT_STATUSES;
    return list.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  /** ステータスキー → 定義オブジェクト。見つからなければ先頭を返す */
  function resolveStatus(project, statusKey) {
    var list = statusesOf(project);
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === statusKey) return list[i];
    }
    return list[0];
  }

  /** ステータスキー → 分類（not_started / in_progress / on_hold / done） */
  function statusCategory(project, statusKey) {
    var s = resolveStatus(project, statusKey);
    return s ? s.category : CATEGORY.NOT_STARTED;
  }

  // ------------------------------------------------------------------
  // 進捗率の計算
  // ------------------------------------------------------------------

  /**
   * 予定進捗率。期間は両端を含む日数で数える。
   * 例) start=end の1日タスクは、当日になった時点で 100%
   */
  function plannedRate(startIso, endIso, todayIsoStr) {
    if (!startIso || !endIso) return null;
    var totalDays = diffDays(startIso, endIso) + 1;
    if (totalDays <= 0) totalDays = 1;
    var elapsed = diffDays(startIso, todayIsoStr) + 1;
    return clamp(elapsed / totalDays, 0, 1);
  }

  function categoryRate(category) {
    var r = CATEGORY_RATE[category];
    return typeof r === 'number' ? r : 0;
  }

  /** 期間の日数（両端を含む）。未設定なら 1 日として扱う */
  function durationDays(startIso, endIso) {
    if (!startIso || !endIso) return 1;
    var d = diffDays(startIso, endIso);
    return d === null ? 1 : Math.max(1, d + 1);
  }

  // ------------------------------------------------------------------
  // 作業の重さ（人日）
  // ------------------------------------------------------------------

  /** サイズ → 人日。設定で変更できる（settings.size_days_*） */
  var DEFAULT_SIZE_DAYS = { S: 0.5, M: 2, L: 5, XL: 10 };
  var SIZE_ORDER = ['S', 'M', 'L', 'XL'];
  var SIZE_LABEL = { S: 'S（半日）', M: 'M（2日）', L: 'L（1週間）', XL: 'XL（2週間）' };

  var DEFAULT_EFFORT = {
    sizeDays: DEFAULT_SIZE_DAYS,
    hoursPerDay: 8,           // 予定工数(h) → 人日 の換算
    weeklyCapacityDays: 5     // 1人の週あたり稼働（負荷率の分母）
  };

  function effortOpts(opts) {
    opts = opts || {};
    return {
      sizeDays: opts.sizeDays || DEFAULT_SIZE_DAYS,
      hoursPerDay: opts.hoursPerDay || DEFAULT_EFFORT.hoursPerDay,
      weeklyCapacityDays: opts.weeklyCapacityDays || DEFAULT_EFFORT.weeklyCapacityDays
    };
  }

  /** 期間日数からサイズを推定する（サイズ未入力のタスク用） */
  function autoSizeKey(days) {
    if (days <= 3) return 'S';
    if (days <= 7) return 'M';
    if (days <= 20) return 'L';
    return 'XL';
  }

  /**
   * 1タスクの重さ（人日）を返す。
   * 優先順位: 予定工数(h) > サイズ > 期間からの自動推定。
   * @returns {{days:number, source:'hours'|'size'|'auto', sizeKey:string}}
   */
  function effortDays(item, opts) {
    var o = effortOpts(opts);
    if (typeof item.estimateHours === 'number' && item.estimateHours > 0) {
      return { days: item.estimateHours / o.hoursPerDay, source: 'hours', sizeKey: item.sizeKey || '' };
    }
    if (item.sizeKey && o.sizeDays[item.sizeKey]) {
      return { days: o.sizeDays[item.sizeKey], source: 'size', sizeKey: item.sizeKey };
    }
    var key = autoSizeKey(durationDays(item.startDate, item.endDate));
    return { days: o.sizeDays[key] || DEFAULT_SIZE_DAYS[key], source: 'auto', sizeKey: key };
  }

  /**
   * 親の実績進捗率 = 子の加重平均。
   * 重みは既定で各子の期間日数（5分の作業と5日の作業を同列に扱わないため）。
   * ctx.rollupWeight === 'effort' なら重さ（人日）を重みにする。
   * 期間未設定の子は重み 1。数値の配列を渡した場合は単純平均（後方互換）。
   */
  function rollupRate(children, ctx) {
    if (!children || !children.length) return 0;
    var useEffort = !!(ctx && ctx.rollupWeight === 'effort');
    var sum = 0, weightSum = 0;
    children.forEach(function (c) {
      if (typeof c === 'number') { sum += c; weightSum += 1; return; }
      var w = useEffort
        ? (c.calc && c.calc.effortDays ? c.calc.effortDays : effortDays(c, ctx && ctx.effort).days)
        : durationDays(c.startDate, c.endDate);
      var rate = c.calc ? c.calc.actualRate : 0;
      sum += rate * w;
      weightSum += w;
    });
    return weightSum ? sum / weightSum : 0;
  }

  // ------------------------------------------------------------------
  // 健全性の判定
  // ------------------------------------------------------------------

  /**
   * 1タスク分の健全性を判定する。
   * @param {object} p - { statusCategory, startDate, endDate, actualRate }
   * @param {object} ctx - { mode, today, thresholds }
   */
  function judge(p, ctx) {
    var today = ctx.today;
    var th = ctx.thresholds || DEFAULT_THRESHOLDS;

    if (p.statusCategory === CATEGORY.DONE) return HEALTH.DONE;
    if (!p.startDate || !p.endDate) return HEALTH.NO_DATE;
    if (diffDays(today, p.startDate) > 0) return HEALTH.NOT_STARTED;

    var overdue = diffDays(p.endDate, today) > 0;

    if (ctx.mode === MODE.DEADLINE) {
      return overdue ? HEALTH.DELAYED : HEALTH.ON_TRACK;
    }
    if (overdue) return HEALTH.DELAYED;

    var delta = p.actualRate - plannedRate(p.startDate, p.endDate, today);
    if (delta >= th.atRisk) return HEALTH.ON_TRACK;
    if (delta >= th.delayed) return HEALTH.AT_RISK;
    return HEALTH.DELAYED;
  }

  // ------------------------------------------------------------------
  // ツリーの構築と評価
  // ------------------------------------------------------------------

  /**
   * プロジェクト1件と、その配下のフラットな items からツリーを組み立てる。
   * 各ノードにプロジェクトのステータス定義から解決した statusCategory / status を付ける。
   * 返り値: { ...project, level:0, children:[ {level:1, children:[{level:2}]} ] }
   */
  function buildTree(project, items) {
    var own = items.filter(function (it) { return it.projectId === project.projectId; });
    var byOrder = function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); };

    function decorate(it, children) {
      var st = resolveStatus(project, it.statusKey);
      return Object.assign({}, it, {
        status: st,
        statusCategory: st ? st.category : CATEGORY.NOT_STARTED,
        children: children || []
      });
    }

    var tasks = own.filter(function (it) { return it.level === 1; }).sort(byOrder);
    var subs = own.filter(function (it) { return it.level === 2; }).sort(byOrder);

    var nodes = tasks.map(function (t) {
      var children = subs
        .filter(function (s) { return s.parentItemId === t.itemId; })
        .sort(byOrder)
        .map(function (s) { return decorate(s); });
      return decorate(t, children);
    });

    var pst = resolveStatus(project, project.statusKey);
    return Object.assign({}, project, {
      itemId: project.projectId,
      level: 0,
      status: pst,
      statusCategory: pst ? pst.category : CATEGORY.NOT_STARTED,
      children: nodes
    });
  }

  /**
   * ツリーを再帰的に評価し、各ノードに `calc` を付ける（破壊的）。
   * calc = { actualRate, plannedRate, delta, health, delayDays, remainingDays,
   *          counts:{ task:{total,done}, subtask:{total,done} }, delayedCount, slippedCount,
   *          hasBaseline, slipDays, baselinePlannedRate, baselineDelta, baselineHealth }
   */
  function evaluateTree(node, options) {
    var ctx = {
      mode: (options && options.mode) || MODE.AUTO,
      today: (options && options.today) || todayISO(),
      thresholds: (options && options.thresholds) || DEFAULT_THRESHOLDS,
      // 'duration'（既定・期間日数で加重）か 'effort'（重さで加重）
      rollupWeight: (options && options.rollupWeight) || 'duration',
      effort: effortOpts(options && options.effort)
    };
    evaluateNode(node, ctx);
    return node;
  }

  function evaluateNode(node, ctx) {
    var children = node.children || [];
    children.forEach(function (c) { evaluateNode(c, ctx); });

    // --- 実績進捗率 ---
    var actual;
    if (ctx.mode === MODE.MANUAL && typeof node.progressRate === 'number') {
      actual = clamp(node.progressRate / 100, 0, 1);
    } else if (node.statusCategory === CATEGORY.DONE) {
      actual = 1;
    } else if (children.length) {
      actual = rollupRate(children, ctx);
    } else {
      actual = categoryRate(node.statusCategory);
    }

    // --- 作業の重さ（人日）。親は配下の合計 ---
    var effort;
    if (children.length) {
      var total = 0;
      children.forEach(function (c) { total += (c.calc && c.calc.effortDays) || 0; });
      effort = { days: total, source: 'rollup', sizeKey: '' };
    } else {
      effort = effortDays(node, ctx.effort);
    }

    // --- 予定進捗率と健全性 ---
    var planned = plannedRate(node.startDate, node.endDate, ctx.today);
    var health = judge({
      statusCategory: node.statusCategory,
      startDate: node.startDate,
      endDate: node.endDate,
      actualRate: actual
    }, ctx);

    // --- 実績の開始日・終了日（予実） ---
    // 子を持つタスクは配下から求める：開始＝配下で最も早い実績開始、終了＝自身が完了なら配下で最も遅い実績終了
    var actualStart = node.actualStartDate || null;
    var actualEnd = node.actualEndDate || null;
    if (children.length) {
      children.forEach(function (c) {
        var cs = c.calc && c.calc.actualStart;
        if (cs && (!actualStart || cs < actualStart)) actualStart = cs;
      });
      if (node.statusCategory === CATEGORY.DONE) {
        children.forEach(function (c) {
          var ce = c.calc && c.calc.actualEnd;
          if (ce && (!actualEnd || ce > actualEnd)) actualEnd = ce;
        });
      } else {
        actualEnd = null;
      }
    }
    if (node.statusCategory === CATEGORY.NOT_STARTED && !children.length) { actualStart = null; actualEnd = null; }
    if (node.statusCategory !== CATEGORY.DONE) actualEnd = null;

    var actualState = actualEnd ? 'done' : (actualStart ? 'running' : 'not_started');
    // 予定との差（日）。＋が遅れ
    var startVar = (actualStart && node.startDate) ? diffDays(node.startDate, actualStart) : null;
    var endVar = null;
    if (node.endDate) {
      if (actualEnd) endVar = diffDays(node.endDate, actualEnd);                       // 終わった：確定の差
      else if (diffDays(node.endDate, ctx.today) > 0) endVar = diffDays(node.endDate, ctx.today);   // 予定終了を過ぎて未完了：超過中
    }
    // 開始予定日を過ぎても始まっていない
    var notStartedLate = !actualStart && node.startDate && diffDays(node.startDate, ctx.today) > 0
      ? diffDays(node.startDate, ctx.today) : 0;

    // --- 期日までの日数 / 遅延日数 ---
    var remaining = node.endDate ? diffDays(ctx.today, node.endDate) : null;
    var delayDays = (remaining !== null && remaining < 0 && node.statusCategory !== CATEGORY.DONE)
      ? -remaining : 0;

    // --- 当初計画（ベースライン）との比較 ---
    // 予定進捗は「現在の」日付で計算するため、終了日を後ろへずらすと遅延が消える。
    // 当初日付を別に保持し、日程変更そのものを slipDays として見えるようにする。
    var hasBaseline = !!(node.baselineStartDate && node.baselineEndDate);
    var slipDays = hasBaseline ? diffDays(node.baselineEndDate, node.endDate) : null;
    var baselinePlanned = hasBaseline
      ? plannedRate(node.baselineStartDate, node.baselineEndDate, ctx.today) : null;
    var baselineHealth = hasBaseline ? judge({
      statusCategory: node.statusCategory,
      startDate: node.baselineStartDate,
      endDate: node.baselineEndDate,
      actualRate: actual
    }, ctx) : null;

    // --- 配下の集計 ---
    var counts = {
      task: { total: 0, done: 0 },
      subtask: { total: 0, done: 0 }
    };
    var delayedCount = 0;
    var slippedCount = 0;
    children.forEach(function (c) {
      var bucket = c.level === 1 ? counts.task : counts.subtask;
      bucket.total += 1;
      if (c.statusCategory === CATEGORY.DONE) bucket.done += 1;
      if (c.calc.health === HEALTH.DELAYED) delayedCount += 1;
      if (c.calc.slipDays > 0) slippedCount += 1;

      counts.task.total += c.calc.counts.task.total;
      counts.task.done += c.calc.counts.task.done;
      counts.subtask.total += c.calc.counts.subtask.total;
      counts.subtask.done += c.calc.counts.subtask.done;
      delayedCount += c.calc.delayedCount;
      slippedCount += c.calc.slippedCount;
    });

    node.calc = {
      actualRate: actual,
      plannedRate: planned,
      delta: planned === null ? null : actual - planned,
      health: health,
      delayDays: delayDays,
      remainingDays: remaining,
      counts: counts,
      delayedCount: delayedCount,
      slippedCount: slippedCount,
      hasBaseline: hasBaseline,
      slipDays: slipDays,
      baselinePlannedRate: baselinePlanned,
      baselineDelta: baselinePlanned === null ? null : actual - baselinePlanned,
      baselineHealth: baselineHealth,
      actualStart: actualStart,
      actualEnd: actualEnd,
      actualState: actualState,
      startVar: startVar,
      endVar: endVar,
      endVarRunning: !actualEnd && endVar !== null,
      notStartedLate: notStartedLate,
      effortDays: effort.days,
      effortSource: effort.source,
      sizeKey: effort.sizeKey,
      rollupWeight: ctx.rollupWeight,
      mode: ctx.mode
    };
    return node;
  }

  /** ツリーを深さ優先で平坦化（表示順のまま） */
  function flatten(node, out) {
    out = out || [];
    (node.children || []).forEach(function (c) {
      out.push(c);
      flatten(c, out);
    });
    return out;
  }

  // ------------------------------------------------------------------
  // 担当者ビュー用の期限区分
  // ------------------------------------------------------------------

  var BUCKET = {
    DELAYED: 'delayed',
    TODAY: 'today',
    WEEK: 'week',
    LATER: 'later',
    DONE: 'done',
    NO_DATE: 'no_date'
  };

  var BUCKET_LABEL = {
    delayed: '遅延',
    today: '今日期限',
    week: '今週',
    later: '以降',
    done: '完了済み',
    no_date: '終了日なし'
  };

  /**
   * タスクを期限で区分する（F-4-2）
   * @param {object} item - { statusCategory, endDate }
   */
  function dueBucket(item, todayIsoStr, weekRangeDays) {
    var today = todayIsoStr || todayISO();
    var range = typeof weekRangeDays === 'number' ? weekRangeDays : 7;
    if (item.statusCategory === CATEGORY.DONE) return BUCKET.DONE;
    if (!item.endDate) return BUCKET.NO_DATE;
    var d = diffDays(today, item.endDate);
    if (d < 0) return BUCKET.DELAYED;
    if (d === 0) return BUCKET.TODAY;
    if (d <= range) return BUCKET.WEEK;
    return BUCKET.LATER;
  }

  // ------------------------------------------------------------------
  // 表示ヘルパ
  // ------------------------------------------------------------------

  function pct(rate) {
    if (rate === null || rate === undefined) return '—';
    return Math.round(rate * 100) + '%';
  }

  /** 優先度順の比較関数（高→低）。同順位なら期限の早い順 */
  function byPriorityThenDue(a, b) {
    var pa = PRIORITY_ORDER[a.priority] === undefined ? 1 : PRIORITY_ORDER[a.priority];
    var pb = PRIORITY_ORDER[b.priority] === undefined ? 1 : PRIORITY_ORDER[b.priority];
    if (pa !== pb) return pa - pb;
    if (!a.endDate) return 1;
    if (!b.endDate) return -1;
    return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0;
  }

  global.Health = {
    CATEGORY: CATEGORY,
    CATEGORY_LABEL: CATEGORY_LABEL,
    CATEGORY_RATE: CATEGORY_RATE,
    DEFAULT_STATUSES: DEFAULT_STATUSES,
    HEALTH: HEALTH,
    HEALTH_LABEL: HEALTH_LABEL,
    HEALTH_ICON: HEALTH_ICON,
    PRIORITY: PRIORITY,
    PRIORITY_LABEL: PRIORITY_LABEL,
    PRIORITY_ICON: PRIORITY_ICON,
    PRIORITY_ORDER: PRIORITY_ORDER,
    MODE: MODE,
    MODE_LABEL: MODE_LABEL,
    MODE_DESC: MODE_DESC,
    DEFAULT_THRESHOLDS: DEFAULT_THRESHOLDS,
    BUCKET: BUCKET,
    BUCKET_LABEL: BUCKET_LABEL,

    toDate: toDate,
    toISO: toISO,
    todayISO: todayISO,
    diffDays: diffDays,
    addDays: addDays,
    clamp: clamp,
    formatDate: formatDate,

    statusesOf: statusesOf,
    resolveStatus: resolveStatus,
    statusCategory: statusCategory,

    plannedRate: plannedRate,
    categoryRate: categoryRate,
    durationDays: durationDays,
    SIZE_DAYS: DEFAULT_SIZE_DAYS,
    SIZE_ORDER: SIZE_ORDER,
    SIZE_LABEL: SIZE_LABEL,
    DEFAULT_EFFORT: DEFAULT_EFFORT,
    autoSizeKey: autoSizeKey,
    effortDays: effortDays,
    rollupRate: rollupRate,
    judge: judge,
    buildTree: buildTree,
    evaluateTree: evaluateTree,
    flatten: flatten,
    dueBucket: dueBucket,
    pct: pct,
    byPriorityThenDue: byPriorityThenDue
  };
})(typeof window !== 'undefined' ? window : this);
