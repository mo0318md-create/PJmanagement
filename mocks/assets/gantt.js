/**
 * ガントチャート（日付軸つき）
 * mock-ui.js の後に読み込むと UI.ganttHtml が使えるようになる。
 * 月の帯 ＋ 週（または月）の目盛り ＋ 今日線を描き、各行に期間の実日付を出す。
 */
(function (global) {
  'use strict';

  var H = global.Health, D = global.MockData, U = global.UI;
  var esc = U.esc;

  /** 日付軸。期間が短ければ週（月曜）ごと、長ければ月ごとに目盛りを置く */
  function buildAxis(min, max, today) {
    var span = H.diffDays(min, max) + 1;
    var pos = function (iso) { return (H.diffDays(min, iso) / span) * 100; };

    // --- 月の帯 ---
    var months = [];
    var cur = min.slice(0, 8) + '01';
    while (cur <= max) {
      var d = new Date(cur + 'T00:00:00');
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

    // --- 目盛り（週 or 月の頭） ---
    var ticks = [], weekly = span <= 120;
    if (weekly) {
      var dow = new Date(min + 'T00:00:00').getDay();
      var first = H.addDays(min, (8 - (dow === 0 ? 7 : dow)) % 7);   // 最初の月曜
      for (var iso = first; iso <= max; iso = H.addDays(iso, 7)) {
        ticks.push({ left: pos(iso), label: H.formatDate(iso).replace(/\(.\)/, '') });
      }
    } else {
      months.forEach(function (m) { if (m.left > 0) ticks.push({ left: m.left, label: m.label }); });
    }

    return {
      span: span, pos: pos, months: months, ticks: ticks,
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
   * @param {Array} rows - { name, level, startDate, endDate, calc, baselineStartDate, baselineEndDate, href, tag }
   * @param {object} opt - { today, labelHead, emptyText, min, max }
   */
  function ganttHtml(rows, opt) {
    opt = opt || {};
    var today = opt.today || D.today;
    if (!rows.length) {
      return '<div class="empty">' + esc(opt.emptyText || '期間の入ったタスクがありません') + '</div>';
    }
    var dated = rows.filter(function (r) { return r.startDate && r.endDate; });
    // 担当者の行（負荷の帯）も表示範囲に含める。折りたたんで見出しだけになっても軸を出すため
    rows.forEach(function (r) {
      (r.bands || []).forEach(function (b) { dated.push({ startDate: b.start, endDate: b.end }); });
    });
    rows.forEach(function (r) {
      var c = r.calc || {};
      if (c.actualStart) dated.push({ startDate: c.actualStart, endDate: c.actualEnd || c.actualStart });
    });
    if (!dated.length) {
      return '<div class="empty">' + esc(opt.emptyText || '期間の入ったタスクがありません') + '</div>';
    }

    var min = opt.min || null, max = opt.max || null;
    dated.forEach(function (r) {
      if (!min || r.startDate < min) min = r.startDate;
      if (!max || r.endDate > max) max = r.endDate;
      if (r.baselineStartDate && r.baselineStartDate < min) min = r.baselineStartDate;
      if (r.baselineEndDate && r.baselineEndDate > max) max = r.baselineEndDate;
    });
    if (today < min) min = today;
    if (today > max) max = today;
    min = H.addDays(min, -3);
    max = H.addDays(max, 3);

    var axis = buildAxis(min, max, today);
    var lines = gridLines(axis);
    // マイルストーン：期日に縦の点線（期日超過は赤）
    var ms = (opt.milestones || []).filter(function (m) { return m.date >= min && m.date <= max; });
    ms.forEach(function (m) {
      lines += '<div class="g-ms-line' + (m.date < today ? ' past' : '') + '" style="left:' + axis.pos(m.date).toFixed(2) + '%"></div>';
    });
    var msRow = ms.length ? '<div class="g-ms-row">' + ms.map(function (m) {
      return '<span class="g-ms' + (m.date < today ? ' past' : '') + '" style="left:' + axis.pos(m.date).toFixed(2) + '%" title="' +
        esc(m.name + ' ' + H.formatDate(m.date) + (m.note ? '（' + m.note + '）' : '')) + '">◆ ' + esc(m.name) + '</span>';
    }).join('') + '</div>' : '';
    var todayLine = axis.todayPos === null ? ''
      : '<div class="g-today" style="left:' + axis.todayPos.toFixed(2) + '%"></div>';

    var head =
      '<div class="g-head">' +
        '<div class="g-headlabel">' + esc(opt.labelHead || 'タスク') + '</div>' +
        '<div class="g-axis">' +
          // 「今日」ラベルは月の帯の側に置く（週の目盛りと重ならないように）
          '<div class="g-months">' +
            (axis.todayPos === null ? '' :
              '<span class="g-todaytag" style="left:' + axis.todayPos.toFixed(2) + '%">今日 ' +
              esc(H.formatDate(today).replace(/\(.\)/, '')) + '</span>') +
            axis.months.map(function (m) {
              return '<div class="g-month' + (m.odd ? ' odd' : '') + '" style="left:' + m.left.toFixed(2) +
                '%;width:' + m.width.toFixed(2) + '%">' + esc(m.label) + '</div>';
            }).join('') + '</div>' +
          msRow +
          '<div class="g-ticks">' + lines + axis.ticks.map(function (t) {
            return '<span class="g-tick" style="left:' + t.left.toFixed(2) + '%">' + esc(t.label) + '</span>';
          }).join('') + todayLine +
          '</div>' +
        '</div>' +
      '</div>';

    var body = rows.map(function (r) {
      // ---- 見出し行：担当者（group）・プロジェクト（sub） ----
      if (r.kind === 'group') {
        var bands = (r.bands || []).map(function (b) {
          var cls = b.rate > 1 ? 'l4' : b.rate >= 0.7 ? 'l3' : b.rate > 0 ? 'l1' : 'l0';
          return '<div class="g-band ' + cls + '" style="left:' + axis.pos(b.start).toFixed(2) + '%;width:' +
            (((H.diffDays(b.start, b.end) + 1) / axis.span) * 100).toFixed(2) + '%"' +
            ' title="' + esc(H.formatDate(b.start) + '週の負荷率 ' + Math.round(b.rate * 100) + '%' +
              (typeof b.cap === "number" ? '（負荷 ' + (Math.round(b.load * 10) / 10) + '人日 ／ 稼働 ' + (Math.round(b.cap * 10) / 10) + '人日' + (U.weekNote ? (U.weekNote(b) ? '・' + U.weekNote(b) : '') : '') + '）' : '')) + '">' +
            (b.rate > 0 ? Math.round(b.rate * 100) + '%' : '') + '</div>';
        }).join('');
        return '<div class="g-row g-group"' + (r.attrs || '') + '>' +
          '<div class="g-label"><div class="g-name">' +
            '<span class="g-caret" aria-hidden="true">' + (r.open ? '▾' : '▸') + '</span>' +
            (r.href ? '<a class="row-link txt" href="' + esc(r.href) + '">' + esc(r.name) + '</a>'
                    : '<span class="txt">' + esc(r.name) + '</span>') +
            (r.badgeHtml || '') +
          '</div><div class="g-dates">' + (r.metaHtml || '') + '</div></div>' +
          '<div class="g-track">' + lines + bands + todayLine + '</div></div>';
      }
      if (r.kind === 'sub') {
        var span = (r.startDate && r.endDate)
          ? '<div class="g-span" style="left:' + axis.pos(r.startDate).toFixed(2) + '%;width:' +
            (((H.diffDays(r.startDate, r.endDate) + 1) / axis.span) * 100).toFixed(2) + '%"></div>'
          : '';
        return '<div class="g-row g-sub"' + (r.attrs || '') + '>' +
          '<div class="g-label"><div class="g-name">' +
            (r.href ? '<a class="row-link txt" href="' + esc(r.href) + '">' + esc(r.name) + '</a>'
                    : '<span class="txt">' + esc(r.name) + '</span>') +
            (r.badgeHtml || '') +
          '</div>' + (r.metaHtml ? '<div class="g-dates">' + r.metaHtml + '</div>' : '') + '</div>' +
          '<div class="g-track">' + lines + span + todayLine + '</div></div>';
      }

      var c = r.calc || {};
      var f = function (iso) { return esc(H.formatDate(iso)); };
      var diffTag = function (n, prefix) {
        if (n === null || n === undefined) return '';
        if (n > 0) return ' <span class="g-var late">' + (prefix || '') + '+' + n + '日</span>';
        if (n < 0) return ' <span class="g-var early">' + (prefix || '') + n + '日</span>';
        return ' <span class="g-var ok">' + (prefix ? prefix + '±0' : '予定どおり') + '</span>';
      };

      // 予定の行
      var planLine = (r.startDate && r.endDate)
        ? '<span class="g-k plan">予定</span>' + f(r.startDate) + ' 〜 ' + f(r.endDate) +
          ' <span class="faint">' + H.durationDays(r.startDate, r.endDate) + '日</span>'
        : '<span class="g-k plan">予定</span><span class="faint">期間未設定</span>';

      // 実績の行
      var actLine = '<span class="g-k act">実績</span>';
      if (c.actualState === 'done') {
        actLine += f(c.actualStart) + ' 〜 ' + f(c.actualEnd) +
          ' <span class="faint">' + H.durationDays(c.actualStart, c.actualEnd) + '日</span>' +
          (c.startVar ? diffTag(c.startVar, '開始') : '') + diffTag(c.endVar, c.startVar ? '終了' : '');
      } else if (c.actualState === 'running') {
        actLine += f(c.actualStart) + ' 〜 <span class="g-running">進行中</span>' +
          (c.startVar ? diffTag(c.startVar, '開始') : '') +
          (c.endVarRunning ? ' <span class="g-var late" title="予定の終了日を過ぎても終わっていない日数">超過+' + c.endVar + '日</span>' : '');
      } else {
        actLine += '<span class="faint">未着手</span>' +
          (c.notStartedLate ? ' <span class="g-var late" title="予定の開始日を過ぎても始まっていない日数">開始遅れ+' + c.notStartedLate + '日</span>' : '');
      }

      var label =
        '<div class="g-label g-label-task">' +
        '<div class="g-label-main">' +
          '<div class="g-name">' +
            (r.href ? '<a class="row-link txt" href="' + esc(r.href) + '">' + esc(r.name) + '</a>'
                    : '<span class="txt">' + esc(r.name) + '</span>') +
            (c.health === 'delayed' ? ' <span class="badge delayed">!</span>' : '') +
            (c.slipDays > 0 ? ' <span class="small delay-note" title="当初計画からの後ろ倒し">当初比+' + c.slipDays + '日</span>' : '') +
          '</div>' +
          '<div class="g-dates g-plan-line">' + planLine + (r.tag ? ' <span class="g-tag">・ ' + esc(r.tag) + '</span>' : '') + '</div>' +
          '<div class="g-dates g-act-line">' + actLine + '</div>' +
        '</div>' +
        (r.nameExtraHtml ? '<div class="g-side">' + r.nameExtraHtml + '</div>' : '') +
        '</div>';

      var rowAttrs = r.attrs || '';
      if (!r.startDate || !r.endDate) {
        return '<div class="g-row g-task lv' + (r.level || 1) + '"' + rowAttrs + '>' + label +
          '<div class="g-track">' + lines + todayLine + '</div></div>';
      }

      var fill = Math.round((c.actualRate || 0) * 100);
      var health = c.health || 'not_started';
      var widthOf = function (a, b) { return Math.max(0.6, ((H.diffDays(a, b) + 1) / axis.span) * 100); };

      // 当初計画（ベースライン）：予定とずれているときだけ、いちばん上に細線で
      var base = '';
      if (r.baselineStartDate && r.baselineEndDate &&
          (r.baselineStartDate !== r.startDate || r.baselineEndDate !== r.endDate)) {
        base = '<div class="g-base" style="left:' + axis.pos(r.baselineStartDate).toFixed(2) + '%;width:' +
          widthOf(r.baselineStartDate, r.baselineEndDate).toFixed(2) + '%"' +
          ' title="当初計画 ' + f(r.baselineStartDate) + '〜' + f(r.baselineEndDate) + '"></div>';
      }

      // 予定バー（上段・枠線）
      var plan = '<div class="g-plan ' + health + '"' + (r.barAttrs || '') + ' style="left:' + axis.pos(r.startDate).toFixed(2) +
        '%;width:' + widthOf(r.startDate, r.endDate).toFixed(2) + '%"' +
        ' title="' + esc('予定 ' + H.formatDate(r.startDate) + '〜' + H.formatDate(r.endDate) + '（進捗 ' + fill + '%）') + '"></div>';

      // 実績バー（下段・塗り）。進行中は今日まで伸ばし、右端を点線にする
      var act = '';
      if (c.actualStart) {
        var aEnd = c.actualEnd || (D.today > c.actualStart ? D.today : c.actualStart);
        act = '<div class="g-act ' + health + (c.actualState === 'running' ? ' running' : '') + '" style="left:' +
          axis.pos(c.actualStart).toFixed(2) + '%;width:' + widthOf(c.actualStart, aEnd).toFixed(2) + '%"' +
          ' title="' + esc('実績 ' + H.formatDate(c.actualStart) + '〜' + (c.actualEnd ? H.formatDate(c.actualEnd) : '進行中')) + '"></div>';
      }

      return '<div class="g-row g-task lv' + (r.level || 1) + '"' + rowAttrs + '>' + label +
        '<div class="g-track yj">' + lines + base + plan + act + todayLine + '</div></div>';
    }).join('');

    return '<div class="gantt">' + head + '<div class="g-rows">' + body + '</div></div>';
  }

  /** ガントの凡例（予実の読み方） */
  function ganttLegend() {
    return '<div class="gantt-legend">' +
      '<span><i style="border:1.5px solid var(--h-on-track);background:var(--h-on-track-bg)"></i>予定（上段・枠線）</span>' +
      '<span><i style="background:var(--h-on-track)"></i>実績（下段・塗り）</span>' +
      '<span><i style="background:var(--h-delayed);border-radius:3px 0 0 3px"></i>▶ 進行中（今日まで）</span>' +
      '<span><i style="height:2px;background:var(--text-muted);opacity:.55"></i>当初計画（ずれたときだけ）</span>' +
      '<span><i style="width:2px;background:var(--today-line)"></i>今日</span>' +
      '<span>色＝健全性（緑 順調／黄 注意／赤 遅延／青 完了／灰 開始前）</span>' +
      "</div>";
  }

  U.ganttLegend = ganttLegend;
  U.ganttHtml = ganttHtml;
  U.buildAxis = buildAxis;
})(window);
