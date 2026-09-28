/**
 * ガントチャート（簡易版）
 * 月の帯 ＋ 週（または月）の目盛り ＋ 今日線。各行は1本のバーで、中を進捗率ぶん濃く塗る。
 * ui.js のあとに読み込むと UI.ganttHtml が使えるようになる。
 */
(function (global) {
  'use strict';

  var H = global.Health, D = global.MockData, U = global.UI;
  var esc = U.esc;

  /**
   * 日付軸。
   * @param scale 'week' 週（月曜）ごと ／ 'month' 月の1日ごと ／ 未指定なら期間の長さで自動
   */
  function buildAxis(min, max, today, scale) {
    var span = H.diffDays(min, max) + 1;
    var pos = function (iso) { return (H.diffDays(min, iso) / span) * 100; };
    if (scale !== 'week' && scale !== 'month') scale = span <= 120 ? 'week' : 'month';

    var months = [];
    var cur = min.slice(0, 8) + '01';
    while (cur <= max) {
      var d = H.parse(cur);
      var nextIso = H.toISO(new Date(d.getFullYear(), d.getMonth() + 1, 1));
      var from = cur < min ? min : cur;
      var to = nextIso > max ? max : H.addDays(nextIso, -1);
      months.push({
        label: (d.getMonth() === 0 ? d.getFullYear() + '年 ' : '') + (d.getMonth() + 1) + '月',
        left: pos(from),
        width: ((H.diffDays(from, to) + 1) / span) * 100,
        odd: months.length % 2 === 1
      });
      cur = nextIso;
    }

    // 目盛り。週なら月曜ごと、月なら各月の1日。どちらも M/D で日付を出す
    var ticks = [];
    if (scale === 'week') {
      var dow = H.parse(min).getDay();
      var first = H.addDays(min, (8 - (dow === 0 ? 7 : dow)) % 7);   // 最初の月曜
      for (var iso = first; iso <= max; iso = H.addDays(iso, 7)) {
        var d = H.parse(iso);
        ticks.push({ left: pos(iso), label: (d.getMonth() + 1) + '/' + d.getDate() });
      }
    } else {
      var cur2 = min.slice(0, 8) + '01';
      if (cur2 < min) cur2 = H.toISO(new Date(H.parse(cur2).getFullYear(), H.parse(cur2).getMonth() + 1, 1));
      for (; cur2 <= max; cur2 = H.toISO(new Date(H.parse(cur2).getFullYear(), H.parse(cur2).getMonth() + 1, 1))) {
        var d2 = H.parse(cur2);
        ticks.push({ left: pos(cur2), label: (d2.getMonth() + 1) + '/' + d2.getDate() });
      }
    }

    return {
      span: span, pos: pos, months: months, ticks: ticks, scale: scale,
      todayPos: (today >= min && today <= max) ? pos(today) : null
    };
  }

  /** 目盛り線。ヘッダーと各行の背景に同じものを敷く */
  function gridLines(axis) {
    var out = axis.ticks.map(function (t) {
      return '<div class="g-line" style="left:' + t.left.toFixed(2) + '%"></div>';
    });
    axis.months.forEach(function (m, i) {
      if (i > 0) out.push('<div class="g-line month" style="left:' + m.left.toFixed(2) + '%"></div>');
    });
    return out.join('');
  }

  /**
   * @param rows  [{ name, level, startDate, endDate, calc, href, tag, metaHtml, itemType, itemKey }]
   * @param opt   { today, labelHead, emptyText, scale }
   */
  function ganttHtml(rows, opt) {
    opt = opt || {};
    var today = opt.today || D.today;
    var empty = '<div class="empty">' + esc(opt.emptyText || '期間の入ったタスクがありません') + '</div>';
    if (!rows.length) return empty;

    var dated = rows.filter(function (r) { return r.startDate && r.endDate; });
    if (!dated.length) return empty;

    var min = null, max = null;
    dated.forEach(function (r) {
      if (!min || r.startDate < min) min = r.startDate;
      if (!max || r.endDate > max) max = r.endDate;
    });
    if (today < min) min = today;
    if (today > max) max = today;
    min = H.addDays(min, -3);
    max = H.addDays(max, 3);

    var axis = buildAxis(min, max, today, opt.scale);
    var lines = gridLines(axis);
    var todayLine = axis.todayPos === null ? ''
      : '<div class="g-today" style="left:' + axis.todayPos.toFixed(2) + '%"></div>';

    var head =
      '<div class="g-head">' +
        '<div class="g-headlabel">' + esc(opt.labelHead || 'タスク（期間）') + '</div>' +
        '<div class="g-axis">' +
          '<div class="g-months">' +
            (axis.todayPos === null ? '' :
              '<span class="g-todaytag" style="left:' + axis.todayPos.toFixed(2) + '%">今日 ' +
              esc(H.formatDate(today)) + '</span>') +
            axis.months.map(function (m) {
              return '<div class="g-month' + (m.odd ? ' odd' : '') + '" style="left:' + m.left.toFixed(2) +
                '%;width:' + m.width.toFixed(2) + '%">' + esc(m.label) + '</div>';
            }).join('') + '</div>' +
          '<div class="g-ticks">' + lines + axis.ticks.map(function (t) {
            return '<span class="g-tick" style="left:' + t.left.toFixed(2) + '%">' + esc(t.label) + '</span>';
          }).join('') + todayLine +
          '</div>' +
        '</div>' +
      '</div>';

    var widthOf = function (a, b) { return Math.max(0.6, ((H.diffDays(a, b) + 1) / axis.span) * 100); };

    var body = rows.map(function (r) {
      var c = r.calc || {};
      // 名前の出し方は一覧の表と同じ（種別チップ＋キー＋名前）
      var nameHtml =
        (r.itemType ? U.typeChip(r.itemType) + ' ' : '') +
        (r.itemKey ? '<span class="small muted" style="flex-shrink:0">' + esc(r.itemKey) + '</span> ' : '') +
        (r.href
          ? '<a class="row-link txt" href="' + esc(r.href) + '">' + esc(r.name) + '</a>'
          : '<span class="txt">' + esc(r.name) + '</span>');

      // ---- まとめ行（プロジェクト・担当者の見出し）----
      // 配下の期間をまとめた細い帯だけを描く。開閉できる
      if (r.kind === 'group' || r.kind === 'sub') {
        var span = (r.startDate && r.endDate)
          ? '<div class="g-span ' + (c.health || '') + '" style="left:' + axis.pos(r.startDate).toFixed(2) +
            '%;width:' + widthOf(r.startDate, r.endDate).toFixed(2) + '%"' +
            ' title="' + esc(H.formatDate(r.startDate) + '〜' + H.formatDate(r.endDate)) + '"></div>'
          : '';
        return '<div class="g-row g-' + r.kind + '"' + (r.attrs || '') + '>' +
          '<div class="g-label"><div class="g-name">' +
            (r.kind === 'group'
              ? '<span class="g-caret" aria-hidden="true">' + (r.open ? '▾' : '▸') + '</span>' : '') +
            nameHtml + (r.badgeHtml || '') +
          '</div>' + (r.metaHtml ? '<div class="g-dates">' + r.metaHtml + '</div>' : '') + '</div>' +
          '<div class="g-track">' + lines + span + todayLine + '</div></div>';
      }

      // 期間・期限・担当の書き方は一覧の表と同じにそろえる（U.periodText / U.dueText / U.assignee）
      var meta = r.metaHtml !== undefined ? r.metaHtml
        : (U.periodText(r.startDate, r.endDate) +
           (r.startDate && r.endDate ? ' ・ ' + U.dueText(c) : '') +
           (r.tag ? ' ・ ' + esc(r.tag) : ''));

      var label = '<div class="g-label"><div class="g-name">' + nameHtml +
        (c.health === 'delayed' ? ' <span class="badge delayed"><span class="ico" aria-hidden="true">!</span>遅延</span>' : '') +
        '</div><div class="g-dates">' + meta + '</div></div>';

      if (!r.startDate || !r.endDate) {
        return '<div class="g-row lv' + (r.level || 1) + '">' + label +
          '<div class="g-track">' + lines + todayLine + '</div></div>';
      }

      var width = Math.max(0.6, ((H.diffDays(r.startDate, r.endDate) + 1) / axis.span) * 100);
      var done = Math.round((c.actualRate || 0) * 100);
      // バー全体が期間。左から進捗率ぶんを濃く塗り、残りを薄くする
      var bar = '<div class="g-bar ' + (c.health || 'not_started') + '" style="left:' +
        axis.pos(r.startDate).toFixed(2) + '%;width:' + width.toFixed(2) + '%"' +
        ' title="' + esc(H.formatDate(r.startDate) + '〜' + H.formatDate(r.endDate) + '（進捗 ' + done + '%）') + '">' +
        '<span class="g-rest" style="width:' + (100 - done) + '%"></span>' +
        (width > 6 ? '<span class="g-pct">' + done + '%</span>' : '') +
        '</div>';

      return '<div class="g-row lv' + (r.level || 1) + '">' + label +
        '<div class="g-track">' + lines + bar + todayLine + '</div></div>';
    }).join('');

    // 横スクロールできる箱に入れる。名前の欄は左に貼り付いたまま残る（CSS の position:sticky）
    return '<div class="gantt-scroll"><div class="gantt">' + head +
      '<div class="g-rows">' + body + '</div></div></div>';
  }

  function ganttLegend() {
    return '<div class="gantt-legend">' +
      '<span><i style="background:var(--h-on-track)"></i>濃い部分＝進んだぶん</span>' +
      '<span><i style="background:var(--h-on-track);opacity:.28"></i>薄い部分＝残り</span>' +
      '<span><i style="width:2px;background:var(--today-line)"></i>今日</span>' +
      '<span>目盛りの数字＝その線の日付（週表示は月曜、月表示は1日）</span>' +
      '<span>バーの色＝状態（緑 対応中／赤 遅延／青 完了／灰 開始前）</span>' +
      '</div>';
  }

  U.ganttHtml = ganttHtml;
  U.ganttLegend = ganttLegend;
})(window);
