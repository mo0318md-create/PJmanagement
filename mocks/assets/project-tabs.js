/**
 * プロジェクト内のタブ（概要・ボード・リスト・ガント・当初計画・設定）
 * キャンバスの ③〜⑧ と同じ並び。#pj-tabs / #crumb / #title があれば埋める。
 */
(function (global) {
  'use strict';
  var U = global.UI;

  function projectTabs(project, active) {
    var id = project.projectId;
    var tabs = [
      { k: 'overview', label: '概要', href: 'project-detail.html?id=' + id },
      { k: 'board', label: 'ボード', href: 'board.html?id=' + id },
      { k: 'list', label: 'リスト', href: 'list.html?id=' + id },
      { k: 'gantt', label: 'ガント', href: 'project-detail.html?id=' + id + '#gantt' },
      { k: 'baseline', label: '当初計画', href: 'project-detail.html?id=' + id + '#bl-card' },
      { k: 'settings', label: '設定', href: 'project-settings.html?id=' + id }
    ];
    var el = document.getElementById('pj-tabs');
    if (el) {
      el.innerHTML = tabs.map(function (t) {
        return '<a href="' + t.href + '"' + (t.k === active ? ' class="active" aria-current="page"' : '') + '>' + t.label + '</a>';
      }).join('');
    }
    var crumb = document.getElementById('crumb');
    if (crumb && active !== 'overview') {
      crumb.innerHTML = '<a href="dashboard-manager.html">プロジェクト一覧</a> ／ <a href="project-detail.html?id=' + id + '">' +
        U.esc(project.name) + '</a> ／ ' + (tabs.filter(function (t) { return t.k === active; })[0] || {}).label;
    }
    var title = document.getElementById('title');
    if (title && (active === 'board' || active === 'list')) title.textContent = project.name;
  }

  U.projectTabs = projectTabs;
})(window);
