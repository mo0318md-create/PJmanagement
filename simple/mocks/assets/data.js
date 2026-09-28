/**
 * モック用のデータ（簡易版）
 * 実装ではスプレッドシートの9シートに入るもの。列名は data-model.md と揃えてある。
 */
(function (global) {
  'use strict';

  var today = '2026-09-28';

  // ---------------- users ----------------
  var users = [
    { userId: 'u1', name: '山田 太郎', email: 'yamada@example.co.jp', role: 'admin', active: true },
    { userId: 'u2', name: '佐藤 花子', email: 'sato@example.co.jp', role: 'member', active: true },
    { userId: 'u3', name: '鈴木 一郎', email: 'suzuki@example.co.jp', role: 'member', active: true },
    { userId: 'u4', name: '田中 美咲', email: 'tanaka@example.co.jp', role: 'admin', active: true },
    { userId: 'u5', name: '高橋 健', email: 'takahashi@example.co.jp', role: 'member', active: true }
  ];
  var meUserId = 'u1';

  // ---------------- templates ----------------
  var templates = [
    { templateId: 'tpl_web', name: 'Webサイト制作', keyPrefix: 'WEB', active: true, sortOrder: 100,
      description: 'コーポレートサイト・採用サイトなどの制作案件' },
    { templateId: 'tpl_event', name: '展示会・イベント出展', keyPrefix: 'EVT', active: true, sortOrder: 200,
      description: '展示会への出展。申込から当日運営まで' },
    { templateId: 'tpl_product', name: '新商品開発', keyPrefix: 'PRD', active: true, sortOrder: 300,
      description: '市場調査から量産準備まで' }
  ];

  var templateItems = [
    // Webサイト制作
    { id: 'ti1', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 100, name: '要件定義', itemType: 'work', startOffsetDays: 0, durationDays: 11 },
    { id: 'ti2', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 200, name: '情報設計', itemType: 'work', startOffsetDays: 8, durationDays: 10 },
    { id: 'ti3', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 300, name: 'デザイン', itemType: 'work', startOffsetDays: 15, durationDays: 28 },
    { id: 'ti3a', templateId: 'tpl_web', level: 2, parent: 'ti3', sortOrder: 100, name: 'ワイヤーフレーム', itemType: 'work', startOffsetDays: 15, durationDays: 7 },
    { id: 'ti3b', templateId: 'tpl_web', level: 2, parent: 'ti3', sortOrder: 200, name: 'トップページデザイン', itemType: 'work', startOffsetDays: 22, durationDays: 13 },
    { id: 'ti3c', templateId: 'tpl_web', level: 2, parent: 'ti3', sortOrder: 300, name: '下層ページデザイン', itemType: 'work', startOffsetDays: 25, durationDays: 18 },
    { id: 'ti4', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 400, name: 'コンテンツ制作', itemType: 'work', startOffsetDays: 23, durationDays: 25 },
    { id: 'ti5', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 500, name: '実装', itemType: 'work', startOffsetDays: 35, durationDays: 17 },
    { id: 'ti5a', templateId: 'tpl_web', level: 2, parent: 'ti5', sortOrder: 100, name: 'フロント実装', itemType: 'work', startOffsetDays: 35, durationDays: 11 },
    { id: 'ti5b', templateId: 'tpl_web', level: 2, parent: 'ti5', sortOrder: 200, name: 'CMS構築', itemType: 'work', startOffsetDays: 42, durationDays: 10 },
    { id: 'ti6', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 600, name: '総合テスト', itemType: 'work', startOffsetDays: 52, durationDays: 5 },
    { id: 'ti7', templateId: 'tpl_web', level: 1, parent: null, sortOrder: 700, name: '本番公開', itemType: 'work', startOffsetDays: 57, durationDays: 4 },
    // 展示会
    { id: 'te1', templateId: 'tpl_event', level: 1, parent: null, sortOrder: 100, name: '出展申込', itemType: 'work', startOffsetDays: 0, durationDays: 6 },
    { id: 'te2', templateId: 'tpl_event', level: 1, parent: null, sortOrder: 200, name: 'ブース設計', itemType: 'work', startOffsetDays: 6, durationDays: 17 },
    { id: 'te3', templateId: 'tpl_event', level: 1, parent: null, sortOrder: 300, name: '制作物準備', itemType: 'work', startOffsetDays: 16, durationDays: 25 },
    { id: 'te3a', templateId: 'tpl_event', level: 2, parent: 'te3', sortOrder: 100, name: 'パネル制作', itemType: 'work', startOffsetDays: 16, durationDays: 15 },
    { id: 'te3b', templateId: 'tpl_event', level: 2, parent: 'te3', sortOrder: 200, name: 'ノベルティ手配', itemType: 'work', startOffsetDays: 23, durationDays: 18 },
    { id: 'te4', templateId: 'tpl_event', level: 1, parent: null, sortOrder: 400, name: '集客・告知', itemType: 'work', startOffsetDays: 24, durationDays: 24 },
    { id: 'te5', templateId: 'tpl_event', level: 1, parent: null, sortOrder: 500, name: '当日運営準備', itemType: 'work', startOffsetDays: 41, durationDays: 10 },
    // 新商品開発
    { id: 'tp1', templateId: 'tpl_product', level: 1, parent: null, sortOrder: 100, name: '市場調査', itemType: 'work', startOffsetDays: 0, durationDays: 28 },
    { id: 'tp2', templateId: 'tpl_product', level: 1, parent: null, sortOrder: 200, name: '仕様策定', itemType: 'work', startOffsetDays: 22, durationDays: 34 },
    { id: 'tp3', templateId: 'tpl_product', level: 1, parent: null, sortOrder: 300, name: '試作', itemType: 'work', startOffsetDays: 50, durationDays: 42 },
    { id: 'tp4', templateId: 'tpl_product', level: 1, parent: null, sortOrder: 400, name: '評価試験', itemType: 'work', startOffsetDays: 85, durationDays: 28 },
    { id: 'tp5', templateId: 'tpl_product', level: 1, parent: null, sortOrder: 500, name: '量産準備', itemType: 'work', startOffsetDays: 105, durationDays: 16 }
  ];

  var templateFields = [
    { fieldId: 'f1', templateId: 'tpl_web', fieldKey: 'client_name', label: 'クライアント名', type: 'text', required: true, options: [], sortOrder: 100 },
    { fieldId: 'f2', templateId: 'tpl_web', fieldKey: 'contract_type', label: '契約区分', type: 'select', required: true, options: ['新規', 'リニューアル', '保守'], sortOrder: 200 },
    { fieldId: 'f3', templateId: 'tpl_web', fieldKey: 'budget', label: '予算（万円）', type: 'number', required: false, options: [], sortOrder: 300 },
    { fieldId: 'f4', templateId: 'tpl_web', fieldKey: 'kickoff_date', label: 'キックオフ日', type: 'date', required: false, options: [], sortOrder: 400 },
    { fieldId: 'f5', templateId: 'tpl_web', fieldKey: 'needs_cms', label: 'CMSを入れる', type: 'checkbox', required: false, options: [], sortOrder: 500 },
    { fieldId: 'f6', templateId: 'tpl_event', fieldKey: 'venue', label: '会場', type: 'text', required: true, options: [], sortOrder: 100 },
    { fieldId: 'f7', templateId: 'tpl_event', fieldKey: 'booth_size', label: 'ブース面積', type: 'text', required: false, options: [], sortOrder: 200 },
    { fieldId: 'f8', templateId: 'tpl_event', fieldKey: 'staff_count', label: '運営スタッフ数', type: 'number', required: false, options: [], sortOrder: 300 },
    { fieldId: 'f9', templateId: 'tpl_product', fieldKey: 'category', label: 'カテゴリ', type: 'select', required: true, options: ['産業機器', '消費財', 'ソフトウェア'], sortOrder: 100 },
    { fieldId: 'f10', templateId: 'tpl_product', fieldKey: 'target_price', label: '目標価格（円）', type: 'number', required: false, options: [], sortOrder: 200 }
  ];

  // ---------------- projects ----------------
  var projects = [
    { projectId: 'p1', key: 'CORP', name: 'コーポレートサイトリニューアル',
      description: '創業30周年に合わせたコーポレートサイトの全面リニューアル。',
      templateId: 'tpl_web', templateName: 'Webサイト制作', ownerUserId: 'u1',
      status: 'in_progress', startDate: '2026-08-18', endDate: '2026-10-17',
      customFields: { client_name: '株式会社ABC', contract_type: 'リニューアル', budget: 480, kickoff_date: '2026-08-18', needs_cms: true } },
    { projectId: 'p2', key: 'EXPO', name: '東京ビジネスEXPO 2026 出展',
      description: '10月の展示会に出展。新商品A-200のプロトタイプを展示する。',
      templateId: 'tpl_event', templateName: '展示会・イベント出展', ownerUserId: 'u4',
      status: 'in_progress', startDate: '2026-08-23', endDate: '2026-10-12',
      customFields: { venue: '東京ビッグサイト 西1ホール', booth_size: '9㎡（3×3）', staff_count: 4 } },
    { projectId: 'p3', key: 'A200', name: '新商品 A-200 開発',
      description: '産業用センサーの新モデル。来春の発売を目指す。',
      templateId: 'tpl_product', templateName: '新商品開発', ownerUserId: 'u5',
      status: 'in_progress', startDate: '2026-07-19', endDate: '2026-11-16',
      customFields: { category: '産業機器', target_price: 68000 } },
    { projectId: 'p4', key: 'HIRE', name: '採用サイト制作',
      description: '新卒採用向けのサイトを新規で立ち上げる。',
      templateId: 'tpl_web', templateName: 'Webサイト制作', ownerUserId: 'u1',
      status: 'in_progress', startDate: '2026-09-02', endDate: '2026-10-27',
      customFields: { client_name: '自社', contract_type: '新規', budget: 220, kickoff_date: '2026-09-02', needs_cms: false } },
    { projectId: 'p5', key: 'POC', name: '基幹システム更改 PoC',
      description: '現行の基幹システムの更改に向けた技術検証。',
      templateId: null, templateName: null, ownerUserId: 'u1',
      status: 'not_started', startDate: '2026-10-05', endDate: '2026-12-16',
      customFields: {} }
  ];

  // ---------------- items ----------------
  // progressRate は「子を持たないタスク」だけが持つ。子を持つ行は null。
  var items = [
    // --- p1 CORP（遅延）---
    it('i101', 'p1', 'CORP-1', 1, null, 100, '要件定義', 'work', 'u1', 'done', '2026-08-18', '2026-08-28', null),
    it('i101a', 'p1', 'CORP-2', 2, 'i101', 100, '現状サイトの整理', 'work', 'u2', 'done', '2026-08-18', '2026-08-21', 100),
    it('i101b', 'p1', 'CORP-3', 2, 'i101', 200, '要件ヒアリング', 'work', 'u1', 'done', '2026-08-22', '2026-08-28', 100),
    it('i102', 'p1', 'CORP-4', 1, null, 200, '情報設計', 'work', 'u2', 'done', '2026-08-26', '2026-09-04', 100),
    it('i103', 'p1', 'CORP-5', 1, null, 300, 'デザイン', 'work', 'u2', 'in_progress', '2026-09-02', '2026-09-29', null),
    it('i103a', 'p1', 'CORP-6', 2, 'i103', 100, 'ワイヤーフレーム', 'work', 'u2', 'done', '2026-09-02', '2026-09-08', 100),
    it('i103b', 'p1', 'CORP-7', 2, 'i103', 200, 'トップページデザイン', 'work', 'u2', 'done', '2026-09-09', '2026-09-21', 100),
    it('i103c', 'p1', 'CORP-8', 2, 'i103', 300, '下層ページデザイン', 'work', 'u2', 'in_progress', '2026-09-12', '2026-09-29', 30),
    it('i104', 'p1', 'CORP-9', 1, null, 400, 'コンテンツ制作', 'work', 'u4', 'in_progress', '2026-09-10', '2026-10-04', 40),
    it('i105', 'p1', 'CORP-10', 1, null, 500, '実装', 'work', 'u3', 'in_progress', '2026-09-22', '2026-10-08', null),
    it('i105a', 'p1', 'CORP-11', 2, 'i105', 100, 'フロント実装', 'work', 'u3', 'in_progress', '2026-09-22', '2026-10-02', 40),
    it('i105b', 'p1', 'CORP-12', 2, 'i105', 200, 'CMS構築', 'work', 'u5', 'not_started', '2026-09-29', '2026-10-08', 0),
    it('i106', 'p1', 'CORP-13', 1, null, 600, 'スマホで表示が崩れる', 'bug', 'u3', 'in_progress', '2026-09-24', '2026-09-25', 50),
    it('i107', 'p1', 'CORP-14', 1, null, 700, 'トップのバナーを差し替えたい', 'req', null, 'not_started', '2026-09-23', '2026-09-27', 0),
    it('i108', 'p1', 'CORP-15', 1, null, 800, '総合テスト', 'work', 'u1', 'not_started', '2026-10-09', '2026-10-13', 0),
    it('i109', 'p1', 'CORP-16', 1, null, 900, '本番公開', 'work', 'u3', 'not_started', '2026-10-14', '2026-10-17', 0),

    // --- p2 EXPO ---
    it('i201', 'p2', 'EXPO-1', 1, null, 100, '出展申込', 'work', 'u4', 'done', '2026-08-23', '2026-08-28', 100),
    it('i202', 'p2', 'EXPO-2', 1, null, 200, 'ブース設計', 'work', 'u2', 'done', '2026-08-29', '2026-09-14', 100),
    it('i203', 'p2', 'EXPO-3', 1, null, 300, '制作物準備', 'work', 'u2', 'in_progress', '2026-09-08', '2026-10-02', null),
    it('i203a', 'p2', 'EXPO-4', 2, 'i203', 100, 'パネル制作', 'work', 'u2', 'done', '2026-09-08', '2026-09-22', 100),
    it('i203b', 'p2', 'EXPO-5', 2, 'i203', 200, 'ノベルティ手配', 'work', 'u4', 'in_progress', '2026-09-15', '2026-10-02', 40),
    it('i204', 'p2', 'EXPO-6', 1, null, 400, '集客・告知', 'work', 'u4', 'in_progress', '2026-09-16', '2026-10-09', 35),
    it('i205', 'p2', 'EXPO-7', 1, null, 500, '会場との調整', 'work', 'u1', 'in_progress', '2026-09-20', '2026-09-26', 60),
    it('i206', 'p2', 'EXPO-8', 1, null, 600, '当日運営準備', 'work', 'u2', 'not_started', '2026-10-03', '2026-10-12', 0),

    // --- p3 A200（対応中）---
    it('i301', 'p3', 'A200-1', 1, null, 100, '市場調査', 'work', 'u5', 'done', '2026-07-19', '2026-08-15', 100),
    it('i302', 'p3', 'A200-2', 1, null, 200, '仕様策定', 'work', 'u5', 'done', '2026-08-10', '2026-09-12', 100),
    it('i303', 'p3', 'A200-3', 1, null, 300, '試作', 'work', 'u5', 'in_progress', '2026-09-07', '2026-10-18', null),
    it('i303a', 'p3', 'A200-4', 2, 'i303', 100, '部品選定', 'work', 'u5', 'done', '2026-09-07', '2026-09-20', 100),
    it('i303b', 'p3', 'A200-5', 2, 'i303', 200, '試作機の組立', 'work', 'u3', 'in_progress', '2026-09-18', '2026-10-18', 35),
    it('i304', 'p3', 'A200-6', 1, null, 400, '評価試験', 'work', 'u3', 'not_started', '2026-10-12', '2026-11-08', 0),
    it('i305', 'p3', 'A200-7', 1, null, 500, '量産準備', 'work', 'u5', 'not_started', '2026-11-01', '2026-11-16', 0),

    // --- p4 HIRE（対応中）---
    it('i401', 'p4', 'HIRE-1', 1, null, 100, '要件定義', 'work', 'u1', 'done', '2026-09-02', '2026-09-12', 100),
    it('i402', 'p4', 'HIRE-2', 1, null, 200, '情報設計', 'work', 'u2', 'done', '2026-09-10', '2026-09-22', 100),
    it('i403', 'p4', 'HIRE-3', 1, null, 300, 'デザイン', 'work', 'u2', 'in_progress', '2026-09-18', '2026-10-09', 45),
    it('i404', 'p4', 'HIRE-4', 1, null, 400, '実装', 'work', 'u3', 'not_started', '2026-10-05', '2026-10-22', 0),
    it('i405', 'p4', 'HIRE-5', 1, null, 500, '公開', 'work', 'u3', 'not_started', '2026-10-23', '2026-10-27', 0),

    // --- p5 POC（開始前）---
    it('i501', 'p5', 'POC-1', 1, null, 100, '現行システムの調査', 'work', 'u5', 'not_started', '2026-10-05', '2026-10-23', 0),
    it('i502', 'p5', 'POC-2', 1, null, 200, 'PoC環境の構築', 'work', 'u3', 'not_started', '2026-10-19', '2026-11-06', 0),
    it('i503', 'p5', 'POC-3', 1, null, 300, '検証', 'work', 'u5', 'not_started', '2026-11-02', '2026-11-27', 0),
    it('i504', 'p5', 'POC-4', 1, null, 400, '報告書作成', 'work', 'u1', 'not_started', '2026-11-30', '2026-12-16', 0)
  ];

  function it(id, pid, key, level, parent, sort, name, type, assignee, status, start, end, rate) {
    return {
      itemId: id, projectId: pid, itemKey: key, level: level, parentItemId: parent,
      sortOrder: sort, name: name, description: '', itemType: type,
      assigneeUserId: assignee, status: status, startDate: start, endDate: end,
      progressRate: rate
    };
  }

  // ---------------- notifications ----------------
  var notifications = [
    { notificationId: 'n1', userId: 'u1', kind: 'delayed', title: '「会場との調整」が遅延になりました', projectId: 'p2', itemId: 'i205', read: false, createdAt: '2026-09-28T07:00' },
    { notificationId: 'n2', userId: 'u1', kind: 'assigned', title: '「報告書作成」の担当になりました', projectId: 'p5', itemId: 'i504', read: false, createdAt: '2026-09-27T14:22' },
    { notificationId: 'n3', userId: 'u1', kind: 'due', title: '「総合テスト」は 10/13(火) が期限です', projectId: 'p1', itemId: 'i108', read: true, createdAt: '2026-09-26T07:00' },
    { notificationId: 'n4', userId: 'u1', kind: 'delayed', title: '「トップのバナーを差し替えたい」が遅延になりました', projectId: 'p1', itemId: 'i107', read: true, createdAt: '2026-09-25T07:00' },
    { notificationId: 'n5', userId: 'u3', kind: 'delayed', title: '「スマホで表示が崩れる」が遅延になりました', projectId: 'p1', itemId: 'i106', read: false, createdAt: '2026-09-26T07:00' }
  ];

  var NOTIFY_KINDS = {
    assigned: { label: '担当になった', icon: '◉' },
    unassigned: { label: '担当から外れた', icon: '○' },
    due: { label: '期限が近い', icon: '◷' },
    delayed: { label: '遅延になった', icon: '!' }
  };

  // ---------------- settings ----------------
  var settings = {
    notifyAssign: true,
    notifyDue: true,
    notifyDelayed: true,
    notifyKeepDays: 90
  };

  // ---------------- 取り出し ----------------

  function ctx() { return { today: today }; }
  function me() { return userById(meUserId); }
  function setMe(id) { meUserId = id; }
  function userById(id) {
    for (var i = 0; i < users.length; i++) if (users[i].userId === id) return users[i];
    return null;
  }
  function userName(id) { var u = userById(id); return u ? u.name : '未アサイン'; }
  function projectById(id) {
    for (var i = 0; i < projects.length; i++) if (projects[i].projectId === id) return projects[i];
    return null;
  }
  function itemById(id) {
    for (var i = 0; i < items.length; i++) if (items[i].itemId === id) return items[i];
    return null;
  }
  function itemsOf(pid) { return items.filter(function (x) { return x.projectId === pid; }); }
  function templateById(id) {
    for (var i = 0; i < templates.length; i++) if (templates[i].templateId === id) return templates[i];
    return null;
  }
  function fieldsOf(tid) {
    return templateFields.filter(function (f) { return f.templateId === tid; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }
  function templateItemsOf(tid) {
    return templateItems.filter(function (t) { return t.templateId === tid; })
      .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
  }
  function notificationsOf(uid) {
    return notifications.filter(function (n) { return n.userId === uid; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function unreadCount(uid) {
    return notificationsOf(uid).filter(function (n) { return !n.read; }).length;
  }

  /** 全プロジェクトの計算済みツリー */
  function allTrees() {
    var c = ctx();
    return projects.map(function (p) { return window.Health.evaluateTree(p, itemsOf(p.projectId), c); });
  }

  global.MockData = {
    get today() { return today; },
    users: users, templates: templates, templateItems: templateItems, templateFields: templateFields,
    projects: projects, items: items, notifications: notifications, settings: settings,
    NOTIFY_KINDS: NOTIFY_KINDS,
    ctx: ctx, me: me, setMe: setMe,
    get meUserId() { return meUserId; },
    userById: userById, userName: userName, projectById: projectById, itemById: itemById,
    itemsOf: itemsOf, templateById: templateById, fieldsOf: fieldsOf, templateItemsOf: templateItemsOf,
    notificationsOf: notificationsOf, unreadCount: unreadCount, allTrees: allTrees
  };
})(window);
