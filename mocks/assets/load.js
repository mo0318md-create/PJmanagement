/**
 * 負荷の計算（担当者一覧・個人ページ・担当者別ガントで共通）
 *
 * ・稼働日＝月〜金のうち、祝日・会社休日でない日
 * ・1件の重さ（人日）は、そのタスクの期間の「稼働日」に均等に配る
 *   （期限を過ぎて未完了なら今日まで延ばす。期間に稼働日が無ければ暦日で配る）
 * ・人ごとの週の稼働 ＝ 週の稼働人日（5営業日あたり） × その週の稼働日のうち休みでない日 ÷ 5
 * ・負荷率 ＝ その週の負荷 ÷ その週の稼働
 */
(function (global) {
  'use strict';
  var H = global.Health, D = global.MockData, U = global.UI;

  var holidaySet = {};
  D.holidays.forEach(function (h) { holidaySet[h.date] = h; });

  function isWorkday(iso) {
    var dow = new Date(iso + 'T00:00:00').getDay();
    return dow !== 0 && dow !== 6 && !holidaySet[iso];
  }
  function onLeave(uid, iso) {
    return D.leaves.some(function (l) { return l.userId === uid && iso >= l.start && iso <= l.end; });
  }
  function countDays(a, b, pred) {
    var n = 0;
    for (var iso = a; iso <= b; iso = H.addDays(iso, 1)) if (pred(iso)) n++;
    return n;
  }
  function mondayOf(iso) {
    var dow = new Date(iso + 'T00:00:00').getDay();
    return H.addDays(iso, -((dow + 6) % 7));
  }
  function capacityPerWeek(uid) {
    var u = D.userById(uid);
    if (u && typeof u.weeklyCapacityDays === 'number') return u.weeklyCapacityDays;
    return D.settings.weeklyCapacityDays || 5;
  }
  /** その人のその週の稼働（人日） */
  function capacityOf(uid, ws, we) {
    var work = countDays(ws, we, function (iso) { return isWorkday(iso) && !(uid && onLeave(uid, iso)); });
    return capacityPerWeek(uid) * work / 5;
  }

  /**
   * 週ごとの負荷。units は { node } の配列（未完了の作業単位）。
   * @returns [{ start, end, load, count, cap, rate, workdays, holidays, leaveDays }]
   */
  function weekLoads(units, uid, weeks, week0) {
    week0 = week0 || mondayOf(D.today);
    var out = [];
    for (var i = 0; i < weeks; i++) {
      var ws = H.addDays(week0, i * 7), we = H.addDays(ws, 6);
      var load = 0, count = 0;
      units.forEach(function (x) {
        var n = x.node;
        if (!n.startDate || !n.endDate) return;
        var end = n.endDate < D.today ? D.today : n.endDate;
        var s = n.startDate > ws ? n.startDate : ws, e = end < we ? end : we;
        if (s > e) return;
        count++;
        var spanWork = countDays(n.startDate, end, isWorkday);
        var inWeek = spanWork
          ? countDays(s, e, isWorkday) / spanWork
          : (H.diffDays(s, e) + 1) / (H.diffDays(n.startDate, end) + 1);
        load += n.calc.effortDays * inWeek;
      });
      var cap = capacityOf(uid, ws, we);
      out.push({
        start: ws, end: we, load: load, count: count, cap: cap,
        rate: cap > 0 ? load / cap : (load > 0 ? 9.99 : 0),
        workdays: countDays(ws, we, isWorkday),
        holidays: D.holidays.filter(function (h) { return h.date >= ws && h.date <= we; }),
        leaveDays: uid ? countDays(ws, we, function (iso) { return isWorkday(iso) && onLeave(uid, iso); }) : 0
      });
    }
    return out;
  }

  /** 週の見出しに添える注記（祝日・休み） */
  function weekNote(w) {
    var parts = [];
    if (w.workdays < 5) parts.push('稼働日' + w.workdays);
    if (w.leaveDays) parts.push('休み' + w.leaveDays + '日');
    return parts.join('・');
  }

  U.isWorkday = isWorkday;
  U.capacityOf = capacityOf;
  U.capacityPerWeek = capacityPerWeek;
  U.weekLoads = weekLoads;
  U.weekNote = weekNote;
  U.mondayOf = mondayOf;
})(window);
