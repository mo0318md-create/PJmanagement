/**
 * 画面の共通部品（簡易版）
 * ヘッダー・サイドナビ・バッジ・進捗バー・プロジェクト内のタブ。
 */
(function (global) {
  'use strict';

  var H = global.Health, D = global.MockData;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------- ナビ ----------------

  var NAV = [
    { group: 'プロジェクト単位' },
    { key: 'projects', href: 'projects.html', ico: '▤', label: 'プロジェクト一覧', m: '一覧' },
    { key: 'search', href: 'search.html', ico: '⌕', label: '横断検索', m: '検索' },
    { key: 'new', href: 'project-new.html', ico: '＋', label: 'プロジェクト作成' },
    { group: '担当者単位' },
    { key: 'people', href: 'people.html', ico: '▥', label: '担当者一覧', m: '担当者' },
    { key: 'my-tasks', href: 'my-tasks.html', ico: '☑', label: 'マイタスク', m: 'マイタスク' },
    { group: '管理' },
    { key: 'templates', href: 'templates.html', ico: '⧉', label: 'テンプレート' },
    { key: 'settings', href: 'settings.html', ico: '⚙', label: '設定', m: '設定' },
    { key: 'rules', href: 'rules.html', ico: '?', label: '判定ルール' },
    { group: 'モック' },
    { key: 'index', href: 'index.html', ico: '☰', label: '画面一覧' }
  ];

  /**
   * ヘッダーとサイドナビを描く。
   * @param opt { active: navのkey, view: 'project' | 'people' }
   */
  function renderShell(opt) {
    opt = opt || {};
    var me = D.me();
    var unread = D.unreadCount(D.meUserId);

    var top = document.getElementById('topbar');
    if (top) {
      top.innerHTML =
        '<a class="brand" href="projects.html"><span class="logo">P</span>PJ管理<span class="tag">簡易版</span></a>' +
        '<div class="view-switch" role="tablist" aria-label="見る軸">' +
          '<a href="projects.html"' + (opt.view !== 'people' ? ' class="active"' : '') + '>プロジェクト単位</a>' +
          '<a href="people.html"' + (opt.view === 'people' ? ' class="active"' : '') + '>担当者単位</a>' +
        '</div>' +
        '<span class="spacer"></span>' +
        '<a class="bell-wrap icon-btn" href="notifications.html" aria-label="お知らせ（未読' + unread + '件）" title="お知らせ">' +
          '<span aria-hidden="true">🔔</span>' +
          (unread ? '<span class="bell-count">' + unread + '</span>' : '') +
        '</a>' +
        '<span class="today">今日 ' + H.formatDateY(D.today) + '</span>' +
        '<select class="inline" id="ui-user" aria-label="ログインユーザー（モック用の切替）">' +
          D.users.map(function (u) {
            return '<option value="' + u.userId + '"' + (u.userId === D.meUserId ? ' selected' : '') + '>' +
              esc(u.name) + (u.role === 'admin' ? '（管理者）' : '') + '</option>';
          }).join('') +
        '</select>' +
        '<button class="icon-btn" id="ui-theme" aria-label="表示テーマを切り替え" title="表示テーマ">◐</button>';

      document.getElementById('ui-user').addEventListener('change', function () {
        D.setMe(this.value);
        location.reload();
      });
      document.getElementById('ui-theme').addEventListener('click', function () {
        var r = document.documentElement;
        r.setAttribute('data-theme', r.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
    }

    var side = document.getElementById('sidebar');
    if (side) {
      side.innerHTML = NAV.map(function (n) {
        if (n.group) return '<div class="group">' + esc(n.group) + '</div>';
        var cls = (n.key === opt.active ? 'active' : '') + (n.m ? ' m-tab' : '');
        return '<a href="' + esc(n.href) + '"' + (cls.trim() ? ' class="' + cls.trim() + '"' : '') + '>' +
          '<span class="ico" aria-hidden="true">' + n.ico + '</span>' +
          '<span class="lbl-full">' + esc(n.label) + '</span>' +
          (n.m ? '<span class="lbl-short">' + esc(n.m) + '</span>' : '') + '</a>';
      }).join('');
    }
  }

  // ---------------- 表示部品 ----------------

  function healthBadge(h) {
    return '<span class="badge ' + h + '"><span class="ico" aria-hidden="true">' +
      H.HEALTH_ICON[h] + '</span>' + H.HEALTH_LABEL[h] + '</span>';
  }

  function statusChip(status) {
    return '<span class="chip s-' + status + '">' + H.STATUS_LABEL[status] + '</span>';
  }

  function typeChip(type) {
    return '<span class="type-chip t-' + type + '" title="種別">' +
      '<span aria-hidden="true">' + H.TYPE_ICON[type] + '</span>' + H.TYPE_LABEL[type] + '</span>';
  }

  /** 進捗バー。予定進捗の位置に縦線のマーカーを重ねる（要件 F-2-7） */
  function progressBar(calc) {
    var a = Math.round((calc.actualRate || 0) * 100);
    var marker = calc.plannedRate === null ? '' :
      '<span class="planned" style="left:' + (calc.plannedRate * 100).toFixed(1) + '%" title="予定進捗 ' +
      H.pct(calc.plannedRate) + '"></span>';
    return '<div class="prog-wrap"><div class="prog ' + calc.health + '" role="img" aria-label="進捗 ' + a + '%">' +
      '<div class="fill" style="width:' + a + '%"></div>' + marker +
      '</div><span class="pct num">' + a + '%</span></div>';
  }

  /** 遅延なら「超過+N日」、そうでなければ残り日数 */
  function dueText(calc) {
    // 完了したものに「あと −31 日」と出さない
    if (calc.health === 'done') return '<span class="faint">済み</span>';
    if (calc.remainingDays === null) return '<span class="faint">—</span>';
    if (calc.overDays > 0) return '<span class="delay-note">超過+' + calc.overDays + '日</span>';
    if (calc.remainingDays === 0) return '<span class="delay-note">今日期限</span>';
    if (calc.remainingDays < 0) return '<span class="faint">—</span>';
    return '<span class="num faint">あと ' + calc.remainingDays + ' 日</span>';
  }

  /** 担当者の氏名。未アサインはうす字 */
  function assignee(userId) {
    return userId
      ? '<span class="who">' + esc(D.userName(userId)) + '</span>'
      : '<span class="who none">未アサイン</span>';
  }

  /** 期間。どの画面でも「8/18(火) 〜 8/28(金) 11日」の形にそろえる */
  function periodText(s, e) {
    if (!s || !e) return '<span class="faint">期間未設定</span>';
    return '<span class="num">' + H.formatDate(s) + ' 〜 ' + H.formatDate(e) + '</span>' +
      ' <span class="faint">' + H.durationDays(s, e) + '日</span>';
  }

  /**
   * タスク名のセル。どの画面でも「種別チップ＋名前」＋補足の2段にそろえる。
   * @param opt { project: プロジェクト名を補足に出す, parent: 親タスク名を出す }
   */
  function taskCell(node, opt) {
    opt = opt || {};
    var sub = [esc(node.itemKey)];
    if (opt.project) {
      var p = D.projectById(node.projectId);
      if (p) sub.push(esc(p.key) + ' ' + esc(p.name));
    }
    if (opt.parent && node.parentItemId) {
      var pa = D.itemById(node.parentItemId);
      if (pa) sub.push('└ ' + esc(pa.name));
    }
    return '<div class="name-cell">' + typeChip(node.itemType) +
      ' <a class="row-link" href="task-edit.html?id=' + esc(node.itemId) + '">' + esc(node.name) + '</a>' +
      '<div class="small muted">' + sub.join(' ・ ') + '</div></div>';
  }

  /** 進捗の見せ方。編集できない場所はどこでもこの形（バー＋%） */
  function progressCell(calc) { return progressBar(calc); }

  function avatar(userId) {
    var name = D.userName(userId);
    return '<span class="avatar' + (userId ? '' : ' none') + '" title="' + esc(name) + '">' +
      esc(name.charAt(0)) + '</span>';
  }

  /** プロジェクト内のタブ */
  function projectTabs(project, active) {
    var id = project.projectId;
    var tabs = [
      { k: 'overview', label: '概要', href: 'project.html?id=' + id },
      { k: 'board', label: 'ボード', href: 'board.html?id=' + id },
      { k: 'list', label: 'リスト', href: 'list.html?id=' + id },
      { k: 'gantt', label: 'ガント', href: 'gantt.html?id=' + id },
      { k: 'settings', label: '設定', href: 'project-settings.html?id=' + id }
    ];
    var el = document.getElementById('pj-tabs');
    if (el) {
      el.innerHTML = tabs.map(function (t) {
        return '<a href="' + t.href + '"' + (t.k === active ? ' class="active" aria-current="page"' : '') +
          '>' + t.label + '</a>';
      }).join('');
    }
    var crumb = document.getElementById('crumb');
    if (crumb) {
      crumb.innerHTML = '<a href="projects.html">プロジェクト一覧</a> ／ ' +
        (active === 'overview' ? esc(project.name)
          : '<a href="project.html?id=' + id + '">' + esc(project.name) + '</a> ／ ' +
            (tabs.filter(function (t) { return t.k === active; })[0] || {}).label);
    }
  }

  /** URL の ?id= を読む。無ければ最初のプロジェクト */
  function currentProject() {
    var id = new URLSearchParams(location.search).get('id');
    return (id && D.projectById(id)) || D.projects[0];
  }

  /** 期限の区分（マイタスク・個人ページ・検索で共通） */
  function dueGroup(node, calc) {
    if (node.status === H.STATUS.DONE) return 'done';
    if (!node.endDate) return 'later';
    var d = H.diffDays(D.today, node.endDate);
    if (d < 0) return 'delayed';
    if (d === 0) return 'today';
    if (d <= 7) return 'week';
    return 'later';
  }
  var DUE_LABEL = { delayed: '遅延', today: '今日期限', week: '今週', later: '以降', done: '完了済み' };

  global.UI = {
    esc: esc, renderShell: renderShell, healthBadge: healthBadge, statusChip: statusChip,
    typeChip: typeChip, progressBar: progressBar, dueText: dueText, periodText: periodText,
    assignee: assignee, taskCell: taskCell, progressCell: progressCell,
    avatar: avatar, projectTabs: projectTabs, currentProject: currentProject,
    dueGroup: dueGroup, DUE_LABEL: DUE_LABEL
  };
})(window);
