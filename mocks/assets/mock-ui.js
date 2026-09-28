/**
 * mock-ui.js ─ モック共通のUI部品（ヘッダー／サイドナビ／バッジ／進捗バー）
 * health.js, mock-data.js の後に読み込むこと。
 */
(function (global) {
  'use strict';

  var H = global.Health;
  var D = global.MockData;

  // ------------------------------------------------------------------
  // 小物
  // ------------------------------------------------------------------

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** URLクエリの取得。例: project-detail.html?id=p1 */
  function qs(name, fallback) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : (fallback !== undefined ? fallback : null);
  }

  /** localStorage は file:// やプライベートウィンドウで失敗しうるので必ず try/catch */
  function lsGet(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* 無視 */ }
  }

  function currentUserId() {
    return qs('user') || lsGet('pm_mock_user', 'u2');
  }
  function setCurrentUser(id) {
    lsSet('pm_mock_user', id);
  }

  function themeInit() {
    var t = lsGet('pm_mock_theme', '');
    if (t) document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    lsSet('pm_mock_theme', next);
  }

  // ------------------------------------------------------------------
  // 表示部品
  // ------------------------------------------------------------------

  /** 健全性バッジ（色＋記号＋文字。色だけに依存しない / F-2-11） */
  function healthBadge(health, extra) {
    var label = H.HEALTH_LABEL[health] || health;
    var icon = H.HEALTH_ICON[health] || '';
    return '<span class="badge ' + esc(health) + '">' +
      (icon ? '<span class="ico" aria-hidden="true">' + icon + '</span>' : '') +
      esc(label) + (extra ? ' ' + esc(extra) : '') + '</span>';
  }

  /**
   * ステータスのチップ。buildTree 済みのノードなら status はオブジェクト、
   * 生データならキー文字列なので、project を渡してプロジェクトのステータス定義から引く。
   */
  function statusChip(status, project) {
    var s = (status && typeof status === 'object') ? status : H.resolveStatus(project || null, status);
    var label = s ? s.label : String(status || '');
    var cat = s ? s.category : 'not_started';
    return '<span class="chip s-' + esc(cat) + '" title="分類: ' + esc(H.CATEGORY_LABEL[cat] || cat) + '">' + esc(label) + '</span>';
  }

  /** 当初計画から後ろ倒しされていれば「当初比 +N日」 */
  /** 人日の表示（0.5 / 2 / 10 のように、いらない小数は出さない） */
  function days(n) {
    return (Math.round(n * 10) / 10) + "人日";
  }

  /**
   * 重さのチップ。自動推定はうす字＋「推定」、手入力は濃字。
   * @param {object} calc - node.calc
   */
  function effortChip(calc) {
    if (!calc || typeof calc.effortDays !== "number") return "";
    var src = calc.effortSource;
    if (src === "rollup") return '<span class="badge faint" title="配下の合計">' + days(calc.effortDays) + '</span>';
    if (src === "hours") return '<span class="badge" title="予定工数を手入力">' + days(calc.effortDays) + '</span>';
    if (src === "size") return '<span class="badge" title="サイズ ' + calc.sizeKey + '">' + calc.sizeKey + ' ・ ' + days(calc.effortDays) + '</span>';
    return '<span class="badge faint" title="期間からの推定値。直すとここが濃くなります">' + calc.sizeKey + ' ・ ' + days(calc.effortDays) + '（推定）</span>';
  }

  function slipChip(calc) {
    if (!calc || !calc.hasBaseline || !(calc.slipDays > 0)) return '';
    return '<span class="badge delayed" title="当初計画からの後ろ倒し">当初比 +' + calc.slipDays + '日</span>';
  }

  /**
   * 進捗バー。実績を塗り、予定進捗の位置にマーカーを立てる（F-2-7）
   * @param {object} calc - Health.evaluateTree が付けた calc
   */
  function progressBar(calc, showPct) {
    var actual = Math.round((calc.actualRate || 0) * 100);
    var planned = calc.plannedRate === null || calc.plannedRate === undefined
      ? null : Math.round(calc.plannedRate * 100);
    var html = '<div class="prog-wrap">' +
      '<div class="prog ' + esc(calc.health) + '" role="img" aria-label="実績' + actual + '%' +
      (planned === null ? '' : ' / 予定' + planned + '%') + '">' +
      '<div class="fill" style="width:' + actual + '%"></div>' +
      (planned === null ? '' : '<div class="planned" style="left:calc(' + planned + '% - 1px)" title="予定進捗 ' + planned + '%"></div>') +
      '</div>';
    if (showPct !== false) html += '<span class="pct num">' + actual + '%</span>';
    return html + '</div>';
  }

  function progressLegend() {
    return '<div class="legend">' +
      '<span class="key"><span class="sw" style="background:var(--h-on-track)"></span>順調</span>' +
      '<span class="key"><span class="sw" style="background:var(--h-at-risk)"></span>注意</span>' +
      '<span class="key"><span class="sw" style="background:var(--h-delayed)"></span>遅延</span>' +
      '<span class="key"><span class="sw" style="background:var(--h-done)"></span>完了</span>' +
      '<span class="key"><span class="sw" style="background:var(--h-not-started)"></span>開始前</span>' +
      '<span class="key"><span class="sw planned-key"></span>予定進捗ライン</span>' +
      '</div>';
  }

  /** 期日の表示（遅延なら赤字で「超過+n日」） */
  function dueText(calc, endDate) {
    if (!endDate) return '<span class="faint">期限なし</span>';
    var base = '<span class="num">' + esc(H.formatDate(endDate)) + '</span>';
    if (calc.delayDays > 0) {
      return base + ' <span class="delay-note">' + '超過+' + calc.delayDays + '日</span>';
    }
    if (calc.health !== 'done' && calc.remainingDays !== null && calc.remainingDays <= 7) {
      var t = calc.remainingDays === 0 ? '本日' : 'あと' + calc.remainingDays + '日';
      return base + ' <span class="small muted">' + t + '</span>';
    }
    return base;
  }

  function periodText(startDate, endDate) {
    if (!startDate && !endDate) return '<span class="faint">未設定</span>';
    return '<span class="num small">' + esc(H.formatDate(startDate)) + ' 〜 ' + esc(H.formatDate(endDate)) + '</span>';
  }

  // ------------------------------------------------------------------
  // シェル（ヘッダー＋サイドナビ）
  // ------------------------------------------------------------------

  var NAV = [
    { group: "プロジェクト単位" },
    { key: "dashboard", href: "dashboard-manager.html", ico: "▤", label: "プロジェクト一覧", m: "一覧" },
    { key: "portfolio", href: "portfolio.html", ico: "▭", label: "全プロジェクトのガント" },
    { key: "search", href: "search.html", ico: "⌕", label: "横断検索・保存フィルタ", m: "検索" },
    { key: "project-new", href: "project-new.html", ico: "＋", label: "プロジェクト作成" },
    { group: "担当者単位" },
    { key: "workload", href: "workload.html", ico: "▥", label: "担当者一覧・負荷", m: "担当者" },
    { key: "my-tasks", href: "my-tasks.html", ico: "☑", label: "マイタスク（自分）", m: "マイタスク" },
    { group: "管理" },
    { key: "templates", href: "template-list.html", ico: "⧉", label: "テンプレート" },
    { key: "settings", href: "settings.html", ico: "⚙", label: "設定", m: "設定" },
    { key: "rules", href: "rules.html", ico: "？", label: "判定ルール" },
    { group: "モック" },
    { key: "index", href: "index.html", ico: "◎", label: "画面一覧" }
  ];

  /**
   * 共通シェルを描画する。
   * @param {object} opt - { active: navキー, view: 'manager' | 'member' }
   */
  /** ヘッダーのベル：画面内のお知らせ（メール・チャットはスコープ外） */
  function renderBell(me) {
    var btn = document.getElementById("ui-bell"), panel = document.getElementById("ui-bell-panel");
    if (!btn || !D.notificationsOf) return;
    function draw() {
      var list = D.notificationsOf(me.userId);
      var unread = list.filter(function (n) { return !n.read; }).length;
      document.getElementById("ui-bell-count").textContent = unread ? unread : "";
      panel.innerHTML = "<div class=\"bell-head\"><strong>お知らせ</strong><span class=\"spacer\"></span>" +
        (unread ? "<button class=\"btn ghost sm\" id=\"ui-bell-all\">すべて既読</button>" : "") + "</div>" +
        (list.length ? list.map(function (n) {
          return "<a class=\"bell-item" + (n.read ? "" : " unread") + "\" href=\"" + esc(n.href) + "\" data-nid=\"" + n.id + "\">" +
            "<span class=\"bell-dot\"></span><span>" + esc(n.text) + "<br><span class=\"small faint\">" + esc(H.formatDate(n.at)) + "</span></span></a>";
        }).join("") : "<div class=\"empty\">お知らせはありません</div>") +
        "<div class=\"bell-foot small\"><a href=\"settings.html\">お知らせの設定</a></div>";
      var all = document.getElementById("ui-bell-all");
      if (all) all.addEventListener("click", function (e) { e.stopPropagation(); list.forEach(function (n) { n.read = true; }); draw(); });
      panel.querySelectorAll("[data-nid]").forEach(function (a) {
        a.addEventListener("click", function () { list.forEach(function (n) { if (n.id === a.getAttribute("data-nid")) n.read = true; }); });
      });
    }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      btn.setAttribute("aria-expanded", String(!panel.hidden));
    });
    document.addEventListener("click", function (e) { if (!panel.hidden && !panel.contains(e.target)) { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
    draw();
    U_refreshBell = draw;
  }
  var U_refreshBell = function () {};

  function renderShell(opt) {
    opt = opt || {};
    themeInit();

    // view: 'project'（プロジェクト単位）/ 'people'（担当者単位）。旧 manager / member も受ける
    var axis = (opt.view === 'people' || opt.view === 'member') ? 'people' : 'project';

    var uid = currentUserId();
    var me = D.userById(uid) || D.users[0];

    var topbar = document.getElementById('topbar');
    if (topbar) {
      var userOptions = D.users.map(function (u) {
        return '<option value="' + esc(u.userId) + '"' + (u.userId === me.userId ? ' selected' : '') + '>' +
          esc(u.name) + '（' + (u.role === 'admin' ? '管理者' : '担当者') + '）</option>';
      }).join('');

      topbar.innerHTML =
        '<div class="brand"><span class="logo" aria-hidden="true">P</span><span class="name">PJ管理</span></div>' +
        '<nav class="view-switch" aria-label="見る軸の切替">' +
        '<a href="dashboard-manager.html"' + (axis === 'project' ? ' class="active"' : '') + '>プロジェクト単位</a>' +
        '<a href="workload.html"' + (axis === 'people' ? ' class="active"' : '') + '>担当者単位</a>' +
        '</nav>' +
        '<span class="spacer"></span>' +
        '<span class="today num">今日: ' + esc(H.formatDate(D.today, true)) + '</span>' +
        '<select class="inline" id="ui-user" aria-label="ログインユーザー（モック用切替）">' + userOptions + '</select>' +
        '<span class="bell-wrap"><button class="btn ghost sm" id="ui-bell" aria-label="お知らせ" aria-expanded="false">🔔<span class="bell-count" id="ui-bell-count"></span></button>' +
        '<div class="bell-panel" id="ui-bell-panel" hidden></div></span>' +
        '<button class="btn ghost sm" id="ui-theme" title="ライト／ダーク切替">◐</button>';

      var sel = document.getElementById('ui-user');
      if (sel) {
        sel.addEventListener('change', function () {
          setCurrentUser(this.value);
          // ?user= が付いている場合は取り除いてから再読込
          location.href = location.pathname;
        });
      }
      var tbtn = document.getElementById('ui-theme');
      if (tbtn) tbtn.addEventListener('click', toggleTheme);
      renderBell(me);
    }

    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.innerHTML = NAV.map(function (n) {
        if (n.group) return '<div class="group">' + esc(n.group) + '</div>';
        // スマホでは m（短い名前）がある5項目だけを下部タブバーに出す
        var cls = (n.key === opt.active ? 'active' : '') + (n.m ? ' m-tab' : '');
        return '<a href="' + esc(n.href) + '"' + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '>' +
          '<span class="ico" aria-hidden="true">' + n.ico + '</span><span class="lbl-full">' + esc(n.label) + '</span>' +
          (n.m ? '<span class="lbl-short">' + esc(n.m) + '</span>' : '') + '</a>';
      }).join('');
    }

    return me;
  }

  // ------------------------------------------------------------------
  // データ取得ヘルパ（本実装では service.gs の呼び出しに置き換わる）
  // ------------------------------------------------------------------

  /** プロジェクト1件を評価済みツリーで返す */
  function projectTree(project, modeOverride) {
    var tree = H.buildTree(project, D.itemsOfProject(project.projectId));
    return H.evaluateTree(tree, {
      mode: modeOverride || D.modeOf(project),
      today: D.today,
      thresholds: D.thresholds(),
      rollupWeight: D.settings.rollupWeight,
      effort: D.effortSettings()
    });
  }

  /** 全プロジェクトを評価済みツリーの配列で返す */
  function allProjectTrees() {
    return D.projects.map(function (p) { return projectTree(p); });
  }

  /** 指定ユーザーにアサインされたタスクを、評価情報つきで返す */
  function assignedItems(userId) {
    var out = [];
    allProjectTrees().forEach(function (tree) {
      H.flatten(tree).forEach(function (node) {
        if (node.assigneeUserId !== userId) return;
        var parent = node.level === 2
          ? tree.children.filter(function (t) { return t.itemId === node.parentItemId; })[0]
          : null;
        out.push({
          item: node,
          project: tree,
          parentTask: parent,
          bucket: H.dueBucket(node, D.today, D.settings.weekRangeDays)
        });
      });
    });
    // 期限の早い順（期限なしは最後）
    out.sort(function (a, b) {
      if (!a.item.endDate) return 1;
      if (!b.item.endDate) return -1;
      return a.item.endDate < b.item.endDate ? -1 : a.item.endDate > b.item.endDate ? 1 : 0;
    });
    return out;
  }

  /** テンプレートの相対日付を実日付へ展開する（F-1-2） */
  function expandTemplate(template, startDate) {
    return template.items.map(function (t) {
      var s = H.addDays(startDate, t.offsetStartDays);
      var e = H.addDays(s, Math.max(1, t.offsetDurationDays) - 1);
      return Object.assign({}, t, { startDate: s, endDate: e });
    });
  }

  global.UI = {
    esc: esc,
    qs: qs,
    currentUserId: currentUserId,
    setCurrentUser: setCurrentUser,
    toggleTheme: toggleTheme,
    renderShell: renderShell,
    healthBadge: healthBadge,
    statusChip: statusChip,
    slipChip: slipChip,
    effortChip: effortChip,
    refreshBell: function () { U_refreshBell(); },
    days: days,
    progressBar: progressBar,
    progressLegend: progressLegend,
    dueText: dueText,
    periodText: periodText,
    projectTree: projectTree,
    allProjectTrees: allProjectTrees,
    assignedItems: assignedItems,
    expandTemplate: expandTemplate
  };
})(window);
