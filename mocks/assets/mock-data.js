/**
 * mock-data.js ─ モック用のダミーデータ
 *
 * DBのカラム名(snake_case)に対して、JS側はcamelCaseで持つ。
 *   user_id -> userId / start_date -> startDate / custom_fields -> customFields
 *
 * 日付はすべて「今日からの相対日数」で生成するため、いつ開いても
 * 遅延1件・注意1件・順調2件・開始前1件・完了1件 の状態が再現される。
 */
(function (global) {
  'use strict';

  var H = global.Health;
  var TODAY = H.todayISO();

  /** 今日から n 日後の 'YYYY-MM-DD' */
  function d(n) { return H.addDays(TODAY, n); }

  // ==================================================================
  // users
  // ==================================================================
  var users = [
    // weeklyCapacityDays：その人が1週間（5営業日）でこのシステムの仕事に使える人日
    { userId: 'u1', name: '山田 太郎', email: 'yamada@example.com', role: 'admin', active: true, weeklyCapacityDays: 3, capacityNote: 'PM・営業と兼務' },
    { userId: 'u2', name: '佐藤 花子', email: 'sato@example.com', role: 'member', active: true, weeklyCapacityDays: 5 },
    { userId: 'u3', name: '鈴木 一郎', email: 'suzuki@example.com', role: 'member', active: true, weeklyCapacityDays: 5 },
    { userId: 'u4', name: '田中 美咲', email: 'tanaka@example.com', role: 'admin', active: true, weeklyCapacityDays: 4, capacityNote: '時短勤務' },
    { userId: 'u5', name: '高橋 健', email: 'takahashi@example.com', role: 'member', active: true, weeklyCapacityDays: 5 }
  ];

  // ==================================================================
  // templates / template_fields / template_items
  // ==================================================================
  function tf(id, key, label, type, required, options, help) {
    return {
      templateFieldId: id, fieldKey: key, label: label, type: type,
      required: !!required, options: options || null, helpText: help || ''
    };
  }
  function ti(id, level, parentId, name, offsetStart, duration, role) {
    return {
      templateItemId: id, level: level, parentTemplateItemId: parentId || null,
      name: name, offsetStartDays: offsetStart, offsetDurationDays: duration,
      defaultRole: role || ''
    };
  }

  var templates = [
    {
      templateId: 'tpl_web',
      name: 'Webサイト制作',
      description: 'コーポレートサイト・採用サイトなどの新規制作／リニューアル案件の標準フロー。',
      category: '制作',
      defaultDurationDays: 61,
      active: true,
      fields: [
        tf('tf_w1', 'client_name', 'クライアント名', 'text', true, null, '請求書に記載する正式名称'),
        tf('tf_w2', 'contract_type', '契約区分', 'select', true, ['新規', 'リニューアル', '保守']),
        tf('tf_w3', 'contract_amount', '契約金額(円)', 'number', false, null, '税抜'),
        tf('tf_w4', 'has_cms', 'CMS導入あり', 'checkbox', false),
        tf('tf_w5', 'site_url', '公開URL', 'text', false)
      ],
      items: [
        ti('tw1', 1, null, '要件定義', 0, 16, 'ディレクター'),
        ti('tw1a', 2, 'tw1', '現状調査', 0, 5, 'ディレクター'),
        ti('tw1b', 2, 'tw1', '要件ヒアリング', 5, 5, 'ディレクター'),
        ti('tw1c', 2, 'tw1', '要件定義書作成', 10, 6, 'ディレクター'),
        ti('tw2', 1, null, 'デザイン', 16, 20, 'デザイナー'),
        ti('tw2a', 2, 'tw2', 'ワイヤーフレーム', 16, 7, 'デザイナー'),
        ti('tw2b', 2, 'tw2', 'トップページデザイン', 23, 13, 'デザイナー'),
        ti('tw2c', 2, 'tw2', '下層ページデザイン', 30, 6, 'デザイナー'),
        ti('tw3', 1, null, '実装', 36, 17, 'エンジニア'),
        ti('tw3a', 2, 'tw3', '環境構築', 36, 4, 'エンジニア'),
        ti('tw3b', 2, 'tw3', 'コーディング', 40, 9, 'エンジニア'),
        ti('tw3c', 2, 'tw3', 'CMS組込', 46, 7, 'エンジニア'),
        ti('tw4', 1, null, 'テスト・公開', 53, 8, 'ディレクター'),
        ti('tw4a', 2, 'tw4', '総合テスト', 53, 5, 'エンジニア'),
        ti('tw4b', 2, 'tw4', '本番公開', 58, 3, 'エンジニア')
      ]
    },
    {
      templateId: 'tpl_event',
      name: '展示会・イベント出展',
      description: '展示会への出展。申込からブース設営、事後フォローまで。',
      category: '販促',
      defaultDurationDays: 41,
      active: true,
      fields: [
        tf('tf_e1', 'venue', '会場名', 'text', true),
        tf('tf_e2', 'exhibit_date', '開催日', 'date', true),
        tf('tf_e3', 'booth_size', 'ブース規模', 'select', false, ['1小間', '2小間', '3小間以上']),
        tf('tf_e4', 'budget', '予算(円)', 'number', false),
        tf('tf_e5', 'needs_shipping', '搬入出の手配あり', 'checkbox', false)
      ],
      items: [
        ti('te1', 1, null, '出展企画', 0, 11, '企画'),
        ti('te1a', 2, 'te1', '出展目的の整理', 0, 5, '企画'),
        ti('te1b', 2, 'te1', '予算申請', 5, 6, '企画'),
        ti('te2', 1, null, '出展申込・ブース確保', 11, 10, '企画'),
        ti('te2a', 2, 'te2', '申込書提出', 11, 5, '企画'),
        ti('te2b', 2, 'te2', 'ブース位置確定', 16, 5, '企画'),
        ti('te3', 1, null, '制作物準備', 21, 13, 'デザイナー'),
        ti('te3a', 2, 'te3', 'パネルデザイン', 21, 4, 'デザイナー'),
        ti('te3b', 2, 'te3', 'ノベルティ発注', 25, 3, '企画'),
        ti('te3c', 2, 'te3', '配布資料作成', 28, 8, '企画'),
        ti('te4', 1, null, '当日運営準備', 34, 6, '企画'),
        ti('te4a', 2, 'te4', 'シフト表作成', 34, 3, '企画'),
        ti('te4b', 2, 'te4', '事前説明会', 37, 3, '企画'),
        ti('te5', 1, null, '事後フォロー', 40, 1, '営業')
      ]
    },
    {
      templateId: 'tpl_product',
      name: '新商品開発',
      description: '市場調査から量産・販売開始までの商品開発プロセス。',
      category: '開発',
      defaultDurationDays: 121,
      active: true,
      fields: [
        tf('tf_p1', 'product_code', '商品コード', 'text', true),
        tf('tf_p2', 'launch_date', '発売予定日', 'date', true),
        tf('tf_p3', 'target_price', '想定売価(円)', 'number', false),
        tf('tf_p4', 'needs_certification', '認証取得が必要', 'checkbox', false, null, 'PSE / 食品衛生法など')
      ],
      items: [
        ti('tp1', 1, null, '市場調査', 0, 26, '企画'),
        ti('tp2', 1, null, '商品企画', 26, 25, '企画'),
        ti('tp3', 1, null, '試作', 51, 30, '開発'),
        ti('tp3a', 2, 'tp3', '試作品1号製作', 51, 12, '開発'),
        ti('tp3b', 2, 'tp3', '社内評価', 63, 10, '企画'),
        ti('tp3c', 2, 'tp3', '改良試作', 73, 8, '開発'),
        ti('tp4', 1, null, '量産準備', 81, 30, '生産'),
        ti('tp5', 1, null, '販売開始準備', 111, 10, '営業')
      ]
    }
  ];

  // ==================================================================
  // projects
  // ==================================================================
  var projects = [
    {
      projectId: 'p1',
      name: 'コーポレートサイトリニューアル',
      description: '創業30周年に合わせたコーポレートサイトの全面リニューアル。',
      templateId: 'tpl_web', templateName: 'Webサイト制作',
      ownerUserId: 'u1', status: 'in_progress',
      startDate: d(-40), endDate: d(20),
      progressMode: 'auto', archived: false,
      customFields: {
        client_name: '株式会社アオゾラ商事', contract_type: 'リニューアル',
        contract_amount: 4800000, has_cms: true, site_url: 'https://example.com/'
      }
    },
    {
      projectId: 'p2',
      name: '東京ビジネスEXPO 2026 出展',
      description: '自社ブースを2小間出展。新商品A-200のお披露目を兼ねる。',
      templateId: 'tpl_event', templateName: '展示会・イベント出展',
      ownerUserId: 'u4', status: 'in_progress',
      startDate: d(-25), endDate: d(15),
      progressMode: 'auto', archived: false,
      customFields: {
        venue: '東京ビッグサイト 西1ホール', exhibit_date: d(12),
        booth_size: '2小間', budget: 1500000, needs_shipping: true
      }
    },
    {
      projectId: 'p3',
      name: '採用サイト制作',
      description: '2027年度新卒採用に向けた採用特設サイトの新規制作。',
      templateId: 'tpl_web', templateName: 'Webサイト制作',
      ownerUserId: 'u1', status: 'in_progress',
      startDate: d(-15), endDate: d(30),
      progressMode: 'auto', archived: false,
      customFields: {
        client_name: '自社（人事部）', contract_type: '新規',
        contract_amount: 0, has_cms: false, site_url: ''
      }
    },
    {
      projectId: 'p4',
      name: '新商品 A-200 開発',
      description: '主力ラインの後継モデル。展示会でのお披露目を目標に開発中。',
      templateId: 'tpl_product', templateName: '新商品開発',
      ownerUserId: 'u5', status: 'in_progress',
      startDate: d(-60), endDate: d(60),
      progressMode: 'manual', archived: false,
      customFields: {
        product_code: 'A-200', launch_date: d(75),
        target_price: 29800, needs_certification: true
      }
    },
    {
      projectId: 'p5',
      name: '基幹システム更改 PoC',
      description: '現行基幹システムの刷新に向けた検証。テンプレートを使わず手動で構成。',
      templateId: null, templateName: '（テンプレートなし）',
      ownerUserId: 'u1', status: 'not_started',
      startDate: d(10), endDate: d(90),
      progressMode: null, archived: false,
      customFields: {}
    },
    {
      projectId: 'p6',
      name: '夏季キャンペーンLP制作',
      description: '夏季セール用のランディングページ制作。公開・効果測定まで完了。',
      templateId: 'tpl_web', templateName: 'Webサイト制作',
      ownerUserId: 'u2', status: 'done',
      startDate: d(-70), endDate: d(-10),
      progressMode: 'auto', archived: false,
      customFields: {
        client_name: '自社（マーケティング部）', contract_type: '新規',
        contract_amount: 0, has_cms: false, site_url: 'https://example.com/summer/'
      }
    },
    {
      projectId: 'p7',
      name: '旧サイト保守（2025年度）',
      description: '前年度の保守契約。契約満了につきアーカイブ済み。',
      templateId: 'tpl_web', templateName: 'Webサイト制作',
      ownerUserId: 'u1', status: 'done',
      startDate: d(-300), endDate: d(-120),
      progressMode: 'auto', archived: true,
      customFields: { client_name: '株式会社アオゾラ商事', contract_type: '保守', contract_amount: 600000, has_cms: true, site_url: 'https://example.com/' }
    }
  ];

  // ==================================================================
  // items （タスク = level 1 / 子タスク = level 2）
  // ==================================================================
  var _order = {};
  function nextOrder(key) {
    _order[key] = (_order[key] || 0) + 100;
    return _order[key];
  }

  /** タスク（level 1） */
  function task(id, pid, name, assignee, status, s, e, rate, desc) {
    return {
      itemId: id, projectId: pid, level: 1, parentItemId: null,
      sortOrder: nextOrder(pid), name: name, description: desc || '',
      assigneeUserId: assignee, status: status,
      startDate: s, endDate: e,
      progressRate: typeof rate === 'number' ? rate : undefined
    };
  }
  /** 子タスク（level 2） */
  function sub(id, pid, parentId, name, assignee, status, s, e, rate, desc) {
    return {
      itemId: id, projectId: pid, level: 2, parentItemId: parentId,
      sortOrder: nextOrder(parentId), name: name, description: desc || '',
      assigneeUserId: assignee, status: status,
      startDate: s, endDate: e,
      progressRate: typeof rate === 'number' ? rate : undefined
    };
  }

  var items = [
    // --- p1 コーポレートサイトリニューアル（遅延） ---
    task('i101', 'p1', '要件定義', 'u2', 'done', d(-40), d(-25)),
    sub('i101a', 'p1', 'i101', '現状調査', 'u3', 'done', d(-40), d(-36)),
    sub('i101b', 'p1', 'i101', '要件ヒアリング', 'u2', 'done', d(-35), d(-31)),
    sub('i101c', 'p1', 'i101', '要件定義書作成', 'u2', 'done', d(-30), d(-25)),

    task('i102', 'p1', 'デザイン', 'u2', 'in_progress', d(-24), d(-5),
      undefined, 'クライアント側のレビューが2度差し戻しとなり停滞中。'),
    sub('i102a', 'p1', 'i102', 'ワイヤーフレーム', 'u2', 'done', d(-24), d(-18)),
    sub('i102b', 'p1', 'i102', 'トップページデザイン', 'u2', 'in_progress', d(-17), d(-5)),
    sub('i102c', 'p1', 'i102', '下層ページデザイン', 'u4', 'not_started', d(-17), d(-5)),

    task('i103', 'p1', '実装', 'u3', 'not_started', d(-4), d(12)),
    sub('i103a', 'p1', 'i103', '環境構築', 'u3', 'not_started', d(-4), d(-1)),
    sub('i103b', 'p1', 'i103', 'コーディング', 'u3', 'not_started', d(0), d(8)),
    sub('i103c', 'p1', 'i103', 'CMS組込', 'u5', 'not_started', d(6), d(12)),

    task('i104', 'p1', 'テスト・公開', 'u1', 'not_started', d(13), d(20)),
    sub('i104a', 'p1', 'i104', '総合テスト', 'u4', 'not_started', d(13), d(17)),
    sub('i104b', 'p1', 'i104', '本番公開', 'u3', 'not_started', d(18), d(20)),

    // --- p2 東京ビジネスEXPO 2026 出展（注意） ---
    task('i201', 'p2', '出展企画', 'u4', 'in_progress', d(-25), d(-15)),
    sub('i201a', 'p2', 'i201', '出展目的の整理', 'u4', 'done', d(-25), d(-21)),
    sub('i201b', 'p2', 'i201', '予算申請', 'u1', 'in_progress', d(-20), d(-15), undefined, '経理の承認待ちで止まっている。'),

    task('i202', 'p2', '出展申込・ブース確保', 'u4', 'in_progress', d(-14), d(-5)),
    sub('i202a', 'p2', 'i202', '申込書提出', 'u4', 'done', d(-14), d(-10)),
    sub('i202b', 'p2', 'i202', 'ブース位置確定', 'u4', 'in_progress', d(-9), d(-5), undefined, '予算承認が下りるまで確定できない。'),

    task('i203', 'p2', '制作物準備', 'u2', 'in_progress', d(-4), d(8)),
    sub('i203a', 'p2', 'i203', 'パネルデザイン', 'u2', 'done', d(-4), d(-1)),
    sub('i203b', 'p2', 'i203', 'ノベルティ発注', 'u2', 'in_progress', d(-2), d(0),
      undefined, '今日期限。発注書を今日中に送付する。'),
    sub('i203c', 'p2', 'i203', '配布資料作成', 'u5', 'not_started', d(1), d(8)),

    task('i204', 'p2', '当日運営準備', 'u4', 'not_started', d(9), d(14)),
    sub('i204a', 'p2', 'i204', 'シフト表作成', 'u4', 'not_started', d(9), d(11)),
    sub('i204b', 'p2', 'i204', '事前説明会', 'u1', 'not_started', d(12), d(14)),

    task('i205', 'p2', '事後フォロー', 'u4', 'not_started', d(15), d(15)),

    // --- p3 採用サイト制作（順調） ---
    task('i301', 'p3', '要件定義', 'u5', 'done', d(-15), d(-6)),
    sub('i301a', 'p3', 'i301', '採用担当ヒアリング', 'u5', 'done', d(-15), d(-11)),
    sub('i301b', 'p3', 'i301', '要件整理', 'u5', 'done', d(-10), d(-6)),

    task('i302', 'p3', 'デザイン', 'u2', 'in_progress', d(-5), d(8)),
    sub('i302a', 'p3', 'i302', 'ワイヤーフレーム', 'u2', 'done', d(-5), d(-1)),
    sub('i302b', 'p3', 'i302', 'デザイン制作', 'u2', 'in_progress', d(0), d(3)),
    sub('i302c', 'p3', 'i302', '社内レビュー', 'u1', 'not_started', d(4), d(8)),

    task('i303', 'p3', '実装', 'u3', 'not_started', d(9), d(24)),
    sub('i303a', 'p3', 'i303', 'コーディング', 'u3', 'not_started', d(9), d(18)),
    sub('i303b', 'p3', 'i303', '応募フォーム実装', 'u3', 'not_started', d(19), d(24)),

    task('i304', 'p3', '公開', 'u3', 'not_started', d(25), d(30)),

    // --- p4 新商品 A-200 開発（順調 / 進捗率手入力モード） ---
    task('i401', 'p4', '市場調査', 'u5', 'done', d(-60), d(-35), 100),
    task('i402', 'p4', '商品企画', 'u5', 'done', d(-34), d(-10), 100),

    task('i403', 'p4', '試作', 'u3', 'in_progress', d(-9), d(20), 60),
    sub('i403a', 'p4', 'i403', '試作品1号製作', 'u3', 'done', d(-9), d(2), 100),
    sub('i403b', 'p4', 'i403', '社内評価', 'u2', 'in_progress', d(3), d(12), 50),
    sub('i403c', 'p4', 'i403', '改良試作', 'u3', 'not_started', d(13), d(20), 0),

    task('i404', 'p4', '量産準備', 'u3', 'not_started', d(21), d(50), 0),
    task('i405', 'p4', '販売開始準備', 'u1', 'not_started', d(51), d(60), 0),

    // --- p5 基幹システム更改 PoC（開始前） ---
    task('i501', 'p5', '現行システム調査', 'u3', 'not_started', d(10), d(30)),
    sub('i501a', 'p5', 'i501', '現行機能の棚卸し', 'u3', 'not_started', d(10), d(20)),
    sub('i501b', 'p5', 'i501', 'データ量・性能調査', 'u5', 'not_started', d(21), d(30)),

    task('i502', 'p5', 'PoC設計', 'u1', 'not_started', d(31), d(55)),
    task('i503', 'p5', 'PoC実施', 'u3', 'not_started', d(56), d(80)),
    task('i504', 'p5', '評価・報告', 'u1', 'not_started', d(81), d(90)),

    // --- p6 夏季キャンペーンLP制作（完了） ---
    task('i601', 'p6', '企画', 'u2', 'done', d(-70), d(-58)),
    task('i602', 'p6', 'デザイン', 'u2', 'done', d(-57), d(-40)),
    sub('i602a', 'p6', 'i602', 'ワイヤーフレーム', 'u2', 'done', d(-57), d(-50)),
    sub('i602b', 'p6', 'i602', 'ビジュアル制作', 'u4', 'done', d(-49), d(-40)),
    task('i603', 'p6', '実装', 'u3', 'done', d(-39), d(-20)),
    task('i604', 'p6', '公開・効果測定', 'u1', 'done', d(-19), d(-10))
  ];

  // ==================================================================
  // ステータス列（テンプレートごと）
  // 判定ロジックが見るのは各ステータスの category（not_started / in_progress / on_hold / done）だけ
  // ==================================================================
  function st(key, label, category, color, order) {
    return { key: key, label: label, category: category, color: color, order: order };
  }
  var TEMPLATE_STATUSES = {
    tpl_web: [
      st('todo', '未対応', 'not_started', 'gray', 100),
      st('design', 'デザイン中', 'in_progress', 'purple', 200),
      st('build', '実装中', 'in_progress', 'blue', 300),
      st('review', 'レビュー待ち', 'in_progress', 'amber', 400),
      st('done', '完了', 'done', 'green', 500)
    ],
    tpl_event: [
      st('todo', '未対応', 'not_started', 'gray', 100),
      st('prep', '準備中', 'in_progress', 'purple', 200),
      st('arranged', '手配済み', 'in_progress', 'blue', 300),
      st('hold', '保留', 'on_hold', 'amber', 400),
      st('done', '完了', 'done', 'green', 500)
    ],
    tpl_product: [
      st('todo', '未対応', 'not_started', 'gray', 100),
      st('design', '設計中', 'in_progress', 'purple', 200),
      st('proto', '試作中', 'in_progress', 'blue', 300),
      st('eval', '評価中', 'in_progress', 'amber', 400),
      st('done', '完了', 'done', 'green', 500)
    ]
  };
  templates.forEach(function (t) { t.statuses = TEMPLATE_STATUSES[t.templateId] || null; });

  // ダミーデータは分類（旧来の固定4種）で書いてあるので、テンプレートのステータスキーへ読み替える
  var STATUS_MAP = {
    tpl_web: { not_started: 'todo', in_progress: 'design', on_hold: 'review', done: 'done' },
    tpl_event: { not_started: 'todo', in_progress: 'prep', on_hold: 'hold', done: 'done' },
    tpl_product: { not_started: 'todo', in_progress: 'proto', on_hold: 'eval', done: 'done' }
  };
  // 工程名を個別に合わせたいタスク
  var STATUS_OVERRIDES = { i102: 'review', i403b: 'eval' };

  // ==================================================================
  // ベースライン（当初計画）
  // 作成時の日付を保持する。以下は「後ろ倒しされた」ことを見せるための当初日付
  // ==================================================================
  var BASELINE_OVERRIDES = {
    p1: { end: d(8) },                    // コーポレートサイト：当初 d(8) → 現在 d(20)（+12日）
    i102: { end: d(-12) },                // デザイン：+7日
    i103: { start: d(-11), end: d(5) },   // 実装：+7日
    i104: { start: d(1), end: d(8) },     // テスト・公開：+12日
    p3: { end: d(22) },                   // 採用サイト：当初 d(22) → 現在 d(30)（+8日）
    i304: { start: d(17), end: d(22) }    // 公開：+8日
  };

  // ==================================================================
  // 作業の重さ
  // サイズ未入力のタスクは期間から自動推定される（health.js）。
  // 以下は「期間からの推定と実感がずれる」ものを手で直した例
  // ==================================================================
  var SIZE_OVERRIDES = {
    i103b: "XL",   // コーディング：期間9日だが中身は2週間分
    i103c: "L",    // CMS組込
    i104a: "S",    // 総合テスト：期間は5日だが実作業は半日
    i203c: "S"     // 配布資料作成
  };
  // 時間で入れたい人向け（サイズより優先。8h = 1人日）
  var HOURS_OVERRIDES = {
    i102c: 24,     // 下層ページデザイン：3人日
    i302b: 12      // デザイン制作：1.5人日
  };

  // ==================================================================
  // 実績の開始日・終了日（予実）
  // 実装ではステータス変更時に自動で記録する：
  //   分類が初めて「進行中／保留／完了」になった日 → actual_start_date
  //   分類が「完了」になった日                     → actual_end_date
  // 以下は予定からのずれ（日）。＋が遅れ、－が前倒し
  // ==================================================================
  var ACTUAL_OFFSETS = {
    i101a: { e: 1 }, i101b: { s: 1, e: 2 }, i101c: { s: 2, e: 3 },
    i102a: { e: 2 }, i102b: { s: 3 },
    i201a: { e: 2 }, i202a: { s: 1, e: 3 },
    i203a: { s: 1, e: 1 }, i203b: { s: 1 },
    i301a: { e: -1 }, i301b: { s: -1, e: -2 },
    i302b: { s: 1 }
  };

  function applyActual(obj, id) {
    if (!obj.startDate) return;
    var o = ACTUAL_OFFSETS[id] || {};
    var clamp = function (iso) { return iso > TODAY ? TODAY : iso; };
    if (obj.status === "done") {
      obj.actualStartDate = clamp(H.addDays(obj.startDate, o.s || 0));
      obj.actualEndDate = clamp(H.addDays(obj.endDate, o.e || 0));
    } else if (obj.status === "in_progress" || obj.status === "on_hold") {
      obj.actualStartDate = clamp(H.addDays(obj.startDate, o.s || 0));
    }
  }

  function applyStatusAndBaseline(obj, id, templateId, statuses) {
    var map = templateId ? STATUS_MAP[templateId] : null;
    obj.statusKey = STATUS_OVERRIDES[id] || (map ? (map[obj.status] || obj.status) : obj.status);
    var b = BASELINE_OVERRIDES[id] || {};
    obj.baselineStartDate = b.start || obj.startDate;
    obj.baselineEndDate = b.end || obj.endDate;
    if (SIZE_OVERRIDES[id]) obj.sizeKey = SIZE_OVERRIDES[id];
    if (HOURS_OVERRIDES[id]) obj.estimateHours = HOURS_OVERRIDES[id];
    if (obj.itemId) applyActual(obj, id);
  }

  projects.forEach(function (p) {
    var tpl = null;
    for (var i = 0; i < templates.length; i++) if (templates[i].templateId === p.templateId) tpl = templates[i];
    p.statuses = tpl && tpl.statuses ? tpl.statuses.slice() : null;   // 作成時にコピー（遡及しない）
    applyStatusAndBaseline(p, p.projectId, p.templateId);
  });
  items.forEach(function (it) {
    var p = null;
    for (var i = 0; i < projects.length; i++) if (projects[i].projectId === it.projectId) p = projects[i];
    applyStatusAndBaseline(it, it.itemId, p ? p.templateId : null);
  });

  // ==================================================================
  // 計画の確定と当初計画の版（ベースライン）
  //   計画中   … 当初計画はまだ無い。日付を何度直しても当初比は出ない
  //   確定済み … 確定した時点の日付を「第1版」として保存。以後の日付変更は当初比に出る
  //   引き直し … 管理者が理由を付けて新しい版を保存（全体 or 選んだタスクだけ）
  // ==================================================================
  var PLAN_STATUS = {
    p1: { status: 'fixed', at: d(-39), by: 'u1', reason: 'キックオフで計画を確定' },
    p2: { status: 'fixed', at: d(-24), by: 'u4', reason: '出展申込の前に計画を確定' },
    p3: { status: 'fixed', at: d(-14), by: 'u1', reason: '要件定義の完了時に確定' },
    p4: { status: 'fixed', at: d(-20), by: 'u1', reason: '開発キックオフで確定' },
    p5: { status: 'planning' },
    p6: { status: 'fixed', at: d(-60), by: 'u2', reason: '制作開始時に確定' },
    p7: { status: 'fixed', at: d(-290), by: 'u1', reason: '契約開始時に確定' }
  };
  // 確定後に追加したタスク（当初計画は追加した時点の日付。遅れではなく「追加」として扱う）
  var ADDED_AFTER_FIX = { i205: d(-5) };
  // 第1版で入力ミスをしていたタスク（第2版で訂正）
  var MISTYPED_V1 = { i104a: { start: d(6), end: d(10) } };

  var baselines = [];
  function snapshotOf(pid) {
    var p = projectById(pid);
    var snap = { project: { start: p.baselineStartDate, end: p.baselineEndDate }, items: {} };
    items.forEach(function (it) {
      if (it.projectId !== pid) return;
      snap.items[it.itemId] = { start: it.baselineStartDate, end: it.baselineEndDate };
    });
    return snap;
  }
  projects.forEach(function (p) {
    var ps = PLAN_STATUS[p.projectId] || { status: 'planning' };
    p.planStatus = ps.status;
    if (ps.status !== 'fixed') {
      // 計画中：当初計画は持たない
      p.baselineStartDate = null; p.baselineEndDate = null;
      items.forEach(function (it) { if (it.projectId === p.projectId) { it.baselineStartDate = null; it.baselineEndDate = null; } });
      return;
    }
    p.planFixedAt = ps.at;
    p.planFixedBy = ps.by;
    items.forEach(function (it) {
      if (it.projectId === p.projectId && ADDED_AFTER_FIX[it.itemId]) it.addedAfterFix = ADDED_AFTER_FIX[it.itemId];
    });
    var v1 = snapshotOf(p.projectId);
    Object.keys(MISTYPED_V1).forEach(function (id) { if (v1.items[id]) v1.items[id] = MISTYPED_V1[id]; });
    baselines.push({ projectId: p.projectId, version: 1, setAt: ps.at, setBy: ps.by, kind: 'fix', scope: 'all', itemIds: [], reason: ps.reason, snapshot: v1 });
  });
  // p1：第1版の入力ミスを、第2版で「選んだタスクだけ」引き直して訂正
  baselines.push({
    projectId: 'p1', version: 2, setAt: d(-9), setBy: 'u1', kind: 'rebase', scope: 'items', itemIds: ['i104a'],
    reason: '入力ミスの訂正：総合テストの日付を1週間早く入れていた', snapshot: snapshotOf('p1')
  });

  /** 計画を確定：いまの日付を第1版として保存する */
  function fixPlan(pid, by, reason) {
    var p = projectById(pid);
    p.planStatus = "fixed"; p.planFixedAt = TODAY; p.planFixedBy = by;
    p.baselineStartDate = p.startDate; p.baselineEndDate = p.endDate;
    items.forEach(function (it) {
      if (it.projectId !== pid) return;
      it.baselineStartDate = it.startDate; it.baselineEndDate = it.endDate;
    });
    var b = { projectId: pid, version: 1, setAt: TODAY, setBy: by, kind: "fix", scope: "all", itemIds: [], reason: reason || "計画を確定", snapshot: snapshotOf(pid) };
    baselines.push(b);
    return b;
  }
  /** 引き直し：全体、または選んだタスクだけ、いまの日付で新しい版を作る */
  function rebase(pid, by, reason, itemIds) {
    var list = baselinesOf(pid);
    var prev = list[list.length - 1];
    var p = projectById(pid);
    var scopeAll = !itemIds || !itemIds.length;
    if (scopeAll) { p.baselineStartDate = p.startDate; p.baselineEndDate = p.endDate; }
    items.forEach(function (it) {
      if (it.projectId !== pid) return;
      if (scopeAll || itemIds.indexOf(it.itemId) >= 0) { it.baselineStartDate = it.startDate; it.baselineEndDate = it.endDate; }
      else if (prev && prev.snapshot.items[it.itemId]) {
        it.baselineStartDate = prev.snapshot.items[it.itemId].start; it.baselineEndDate = prev.snapshot.items[it.itemId].end;
      }
    });
    var b = { projectId: pid, version: (prev ? prev.version : 0) + 1, setAt: TODAY, setBy: by, kind: "rebase",
      scope: scopeAll ? "all" : "items", itemIds: scopeAll ? [] : itemIds.slice(), reason: reason, snapshot: snapshotOf(pid) };
    baselines.push(b);
    return b;
  }

  function baselinesOf(pid) {
    return baselines.filter(function (b) { return b.projectId === pid; })
      .sort(function (a, b) { return a.version - b.version; });
  }
  /** 指定した版の当初計画を当てはめたプロジェクトとタスクの写しを返す（比較する版を選ぶため） */
  function withBaseline(project, version) {
    var list = baselinesOf(project.projectId);
    var b = null;
    list.forEach(function (x) { if (x.version === version) b = x; });
    var p2 = Object.assign({}, project);
    var its = itemsOfProject(project.projectId).map(function (it) { return Object.assign({}, it); });
    if (!b) return { project: p2, items: its };
    p2.baselineStartDate = b.snapshot.project.start;
    p2.baselineEndDate = b.snapshot.project.end;
    its.forEach(function (it) {
      var s = b.snapshot.items[it.itemId];
      if (s) { it.baselineStartDate = s.start; it.baselineEndDate = s.end; }
      else { it.baselineStartDate = it.startDate; it.baselineEndDate = it.endDate; }   // 版より後に追加したタスク
    });
    return { project: p2, items: its };
  }

  // ==================================================================
  // settings
  // ==================================================================
  var settings = {
    defaultProgressMode: 'auto',
    thresholdAtRisk: -0.10,
    thresholdDelayed: -0.25,
    weekRangeDays: 7,
    overloadThreshold: 4,   // 担当者別の負荷：同時進行がこの件数以上で「多い」
    rollupWeight: "duration",  // 親への積み上げの重み: duration=期間日数 / effort=重さ
    sizeDays: { S: 0.5, M: 2, L: 5, XL: 10 },  // サイズ→人日
    hoursPerDay: 8,            // 予定工数(h)→人日 の換算
    weeklyCapacityDays: 5,     // 1人の週あたり稼働（負荷率の分母）
    timezone: 'Asia/Tokyo'
  };

  // ==================================================================
  // 参照ヘルパ
  // ==================================================================
  function userById(id) {
    for (var i = 0; i < users.length; i++) if (users[i].userId === id) return users[i];
    return null;
  }
  function userName(id) {
    var u = userById(id);
    return u ? u.name : '未アサイン';
  }
  function projectById(id) {
    for (var i = 0; i < projects.length; i++) if (projects[i].projectId === id) return projects[i];
    return null;
  }
  function templateById(id) {
    for (var i = 0; i < templates.length; i++) if (templates[i].templateId === id) return templates[i];
    return null;
  }
  function itemById(id) {
    for (var i = 0; i < items.length; i++) if (items[i].itemId === id) return items[i];
    return null;
  }
  function itemsOfProject(pid) {
    return items.filter(function (it) { return it.projectId === pid; });
  }
  /** プロジェクトの判定モード（未設定ならシステム既定値を継承） */
  function modeOf(project) {
    // モック：プロジェクト設定（⑧）で保存した判定モードを、同じタブの他の画面にも反映する
    try {
      var saved = sessionStorage.getItem('pj-mode:' + project.projectId);
      if (saved !== null) return saved || settings.defaultProgressMode;
    } catch (e) { /* 使えない環境では元の値 */ }
    return project.progressMode || settings.defaultProgressMode;
  }
  function thresholds() {
    return { atRisk: settings.thresholdAtRisk, delayed: settings.thresholdDelayed };
  }
  /** 重さ（人日）の計算設定 */
  function effortSettings() {
    return {
      sizeDays: settings.sizeDays,
      hoursPerDay: settings.hoursPerDay,
      weeklyCapacityDays: settings.weeklyCapacityDays
    };
  }

  // ==================================================================
  // 稼働カレンダー：祝日・会社休日（全員）と、個人の休み
  // ==================================================================
  var HOLIDAYS = [
    { date: '2026-09-21', name: '敬老の日', kind: '祝日' },
    { date: '2026-09-22', name: '国民の休日', kind: '祝日' },
    { date: '2026-09-23', name: '秋分の日', kind: '祝日' },
    { date: '2026-10-12', name: 'スポーツの日', kind: '祝日' },
    { date: '2026-11-03', name: '文化の日', kind: '祝日' },
    { date: '2026-11-23', name: '勤労感謝の日', kind: '祝日' },
    { date: '2026-12-29', name: '年末休暇', kind: '会社休日' },
    { date: '2026-12-30', name: '年末休暇', kind: '会社休日' },
    { date: '2026-12-31', name: '年末休暇', kind: '会社休日' },
    { date: '2027-01-01', name: '元日', kind: '祝日' },
    { date: '2027-01-11', name: '成人の日', kind: '祝日' }
  ];
  var leaves = [
    { leaveId: 'lv1', userId: 'u2', start: d(15), end: d(19), reason: '休暇' },
    { leaveId: 'lv2', userId: 'u3', start: d(8), end: d(8), reason: '研修' }
  ];

  // ==================================================================
  // マイルストーン（プロジェクトごと）
  // ==================================================================
  var milestones = [
    { milestoneId: 'm1', projectId: 'p1', name: 'M1 デザインFIX', date: d(-5), note: 'クライアント最終承認' },
    { milestoneId: 'm2', projectId: 'p1', name: 'M2 本番公開', date: d(20), note: '' },
    { milestoneId: 'm3', projectId: 'p2', name: '出展当日', date: d(12), note: '東京ビッグサイト' },
    { milestoneId: 'm4', projectId: 'p3', name: '採用サイト公開', date: d(30), note: '' }
  ];
  var MILESTONE_OF = { i102: 'm1', i103: 'm2', i104: 'm2', i203: 'm3', i204: 'm3' };

  // ==================================================================
  // ラベル（全プロジェクト共通）
  // ==================================================================
  var labels = [
    { labelId: 'l1', name: 'デザイン', color: '#E8E2F4' },
    { labelId: 'l2', name: 'フロント', color: '#DDEAF7' },
    { labelId: 'l3', name: '要確認', color: '#F8E3D8' },
    { labelId: 'l4', name: '外部依頼', color: '#E2EFE6' }
  ];
  var LABELS_OF = { i102: ['l1', 'l3'], i102b: ['l1'], i103: ['l2'], i103b: ['l2'], i203b: ['l4'] };

  items.forEach(function (it) {
    it.milestoneId = MILESTONE_OF[it.itemId] || null;
    it.labelIds = LABELS_OF[it.itemId] || [];
  });

  // ==================================================================
  // 画面内のお知らせ（メール・チャットへの送信はスコープ外）
  // ==================================================================
  var notifications = [
    { id: 'n1', userId: 'u2', at: d(-1), kind: 'reassign', text: '「パネルデザイン」の担当があなたになりました（山田 太郎）', href: 'task-edit.html?id=i203a', read: false },
    { id: 'n2', userId: 'u2', at: d(0), kind: 'due', text: '「ノベルティ発注」は今日が期限です', href: 'task-edit.html?id=i203b', read: false },
    { id: 'n3', userId: 'u2', at: d(-3), kind: 'delay', text: '「トップページデザイン」が遅延になりました', href: 'task-edit.html?id=i102b', read: true },
    { id: 'n4', userId: 'u1', at: d(-9), kind: 'baseline', text: '「コーポレートサイトリニューアル」の当初計画が第2版になりました', href: 'project-detail.html?id=p1', read: true },
    { id: 'n5', userId: 'u1', at: d(0), kind: 'overload', text: '鈴木 一郎 さんが来週、稼働を超えそうです', href: 'member.html?user=u3', read: false },
    { id: 'n6', userId: 'u3', at: d(0), kind: 'delay', text: '「環境構築」が遅延になりました', href: 'task-edit.html?id=i103a', read: false }
  ];
  var NOTIFY_KINDS = [
    { kind: 'reassign', label: '担当になった・担当が外れた', def: true },
    { kind: 'due', label: '期限の前日・当日', def: true },
    { kind: 'delay', label: '担当のタスクが遅延になった', def: true },
    { kind: 'overload', label: '担当者が稼働超過になりそう（管理者のみ）', def: true },
    { kind: 'baseline', label: '計画の確定・当初計画の引き直し', def: true }
  ];
  var notifySettings = {};
  NOTIFY_KINDS.forEach(function (k) { notifySettings[k.kind] = k.def; });
  function notificationsOf(uid) {
    return notifications.filter(function (n) { return n.userId === uid && notifySettings[n.kind] !== false; })
      .sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function notify(uid, kind, text, href) {
    notifications.push({ id: 'n' + (notifications.length + 1), userId: uid, at: TODAY, kind: kind, text: text, href: href || '#', read: false });
  }

  // ==================================================================
  // 保存フィルタ（個人用／共有）
  // ==================================================================
  var savedFilters = [
    { id: "sf1", ownerUserId: "u2", name: "自分の遅延", shared: false, cond: { assignee: "@me", health: "delayed" } },
    { id: "sf2", ownerUserId: "u2", name: "今週が期限のもの", shared: false, cond: { assignee: "@me", due: "week" } },
    { id: "sf3", ownerUserId: "u1", name: "全社の遅延タスク", shared: true, cond: { health: "delayed" } },
    { id: "sf4", ownerUserId: "u1", name: "未アサインのタスク", shared: true, cond: { assignee: "@none" } },
    { id: "sf5", ownerUserId: "u4", name: "外部依頼ラベル", shared: true, cond: { label: "l4" } }
  ];

  global.MockData = {
    today: TODAY,
    d: d,
    users: users,
    templates: templates,
    projects: projects,
    items: items,
    settings: settings,
    holidays: HOLIDAYS,
    leaves: leaves,
    milestones: milestones,
    savedFilters: savedFilters,
    labels: labels,
    notifications: notifications,
    notifyKinds: NOTIFY_KINDS,
    notifySettings: notifySettings,
    notificationsOf: notificationsOf,
    notify: notify,
    milestonesOf: function (pid) { return milestones.filter(function (m) { return m.projectId === pid; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); },
    labelById: function (id) { for (var i = 0; i < labels.length; i++) if (labels[i].labelId === id) return labels[i]; return null; },
    userById: userById,
    userName: userName,
    projectById: projectById,
    templateById: templateById,
    itemById: itemById,
    itemsOfProject: itemsOfProject,
    modeOf: modeOf,
    thresholds: thresholds,
    baselines: baselines,
    baselinesOf: baselinesOf,
    withBaseline: withBaseline,
    fixPlan: fixPlan,
    rebase: rebase,
    effortSettings: effortSettings
  };
})(window);
