/**
 * ブラウザから google.script.run で呼ぶ関数（簡易版）
 * 要件書 §5.1 の2段階読み込みに対応する。
 *
 *   ① 起動直後   getBootstrap()  … projects + summary_cache + users + settings（軽い）
 *   ② 続けて裏で getItems()      … items 全件（重い。画面はもう出ている）
 *   ③ 保存のたび saveItem() など（変えた行だけ）
 */

// ---------------------------------------------------------------- 読み込み

/** ログイン中の人。users シートのメールと突き合わせる */
function currentUser_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) { email = ''; }
  var users = readAll_('users');
  var me = null;
  if (email) {
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).toLowerCase() === email.toLowerCase()) { me = users[i]; break; }
    }
  }
  // 見つからないときは最初の管理者（初回セットアップ中などのため）
  if (!me) {
    for (var j = 0; j < users.length; j++) if (users[j].role === 'admin') { me = users[j]; break; }
  }
  return me;
}

/**
 * ① 起動直後に呼ぶ。プロジェクト一覧を描くのに要るものだけを返す。
 * タスク1,000行を待たずに最初の画面が出る。
 */
function getBootstrap() {
  var t = today_();
  var projects = readAll_('projects');
  var cache = readAll_('summary_cache');
  var byId = {};
  cache.forEach(function (c) { byId[c.project_id] = c; });

  // 「今日」が変わっていると状態と予定進捗率が古い。その行は印を付けて返す
  var summary = projects.map(function (p) {
    var c = byId[p.project_id];
    var stale = !c || String(c.computed_for_date) !== t;
    return {
      project_id: p.project_id,
      health: c ? c.health : null,
      actual_rate: c ? c.actual_rate : 0,
      planned_rate: c ? c.planned_rate : 0,
      task_total: c ? c.task_total : 0,
      task_done: c ? c.task_done : 0,
      sub_total: c ? c.sub_total : 0,
      sub_done: c ? c.sub_done : 0,
      delayed_count: c ? c.delayed_count : 0,
      stale: stale
    };
  });

  // 人は共通マスタから読む（Common.gs）。読めなければ控え、それも無ければ users シート
  var pp = peopleForUi_();
  var me = currentUser_();
  return {
    today: t,
    me: me ? { user_id: me.user_id, name: me.name, email: me.email, role: me.role } : null,
    users: pp.people.map(function (p) {
      // 画面は user_id / name で扱う。user_id の中身は社員コード（common のとき）
      return { user_id: p.code, name: p.name, email: p.email, dept: p.deptName, position: p.positionName };
    }),
    peopleSource: pp.source,
    peopleNote: pp.note,
    projects: projects.map(strip_),
    summary: summary,
    templates: readAll_('templates').map(strip_),
    settings: readSettings_(),
    unread: countUnread_(me)
  };
}

/** ② 裏で呼ぶ。タスク全件。これが終われば横断検索もマイタスクも動く */
function getItems() {
  return readAll_('items').map(strip_);
}

/** テンプレートの中身（作成画面を開いたときだけ呼ぶ） */
function getTemplateDetail(templateId) {
  return {
    items: readAll_('template_items')
      .filter(function (x) { return x.template_id === templateId; })
      .sort(function (a, b) { return a.sort_order - b.sort_order; }).map(strip_),
    fields: readAll_('template_fields')
      .filter(function (x) { return x.template_id === templateId; })
      .sort(function (a, b) { return a.sort_order - b.sort_order; }).map(strip_)
  };
}

/** 自分宛てのお知らせ */
function getNotifications() {
  var me = currentUser_();
  if (!me) return [];
  return readAll_('notifications')
    .filter(function (n) { return n.user_id === me.user_id; })
    .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; })
    .map(strip_);
}

function countUnread_(me) {
  if (!me) return 0;
  return readAll_('notifications').filter(function (n) {
    return n.user_id === me.user_id && !n.read;
  }).length;
}

/** シート上の行番号はブラウザに渡さない */
function strip_(o) {
  var c = {};
  Object.keys(o).forEach(function (k) { if (k !== '__row') c[k] = o[k]; });
  return c;
}

// ---------------------------------------------------------------- 書き込み

/**
 * タスクを保存する。変えた1行だけを書く。
 * @param patch { item_id, name, description, item_type, assignee_user_id,
 *                status, start_date, end_date, progress_rate, updated_at }
 *   updated_at は読み込んだときの値。ほかの人が先に更新していたら弾く。
 */
function saveItem(patch) {
  return withLock_(function () {
    var cur = findById_('items', patch.item_id);
    if (!cur) throw new Error('タスクが見つかりません');
    if (patch.updated_at && cur.updated_at && patch.updated_at !== cur.updated_at) {
      throw new Error('ほかの人が先に更新しています。画面を再読み込みしてください');
    }
    validateItem_(patch);

    var oldAssignee = cur.assignee_user_id;
    var next = {
      name: patch.name,
      description: patch.description || '',
      item_type: ITEM_TYPES.indexOf(patch.item_type) >= 0 ? patch.item_type : 'work',
      assignee_user_id: patch.assignee_user_id || '',
      status: patch.status,
      start_date: patch.start_date || '',
      end_date: patch.end_date || '',
      updated_at: now_()
    };

    // 子タスクを持つ行は進捗率を持たない（子の平均になるため）
    var hasKids = readAll_('items').some(function (x) { return x.parent_item_id === cur.item_id; });
    if (hasKids) {
      next.progress_rate = '';
    } else {
      next.progress_rate = patch.status === STATUS.DONE ? 100 : clampRate_(patch.progress_rate);
    }

    updateRow_('items', cur.item_id, next);
    if (String(oldAssignee || '') !== String(next.assignee_user_id || '')) {
      notifyAssignChange_(cur, oldAssignee, next.assignee_user_id);
    }
    refreshSummary_(cur.project_id);
    return { ok: true, updated_at: next.updated_at };
  });
}

/**
 * タスクを追加する。parent_item_id を渡すと子タスクになる。
 * @param data { project_id, parent_item_id?, name, item_type, assignee_user_id, status, start_date, end_date, progress_rate }
 */
function addItem(data) {
  return withLock_(function () {
    var project = findById_('projects', data.project_id);
    if (!project) throw new Error('プロジェクトが見つかりません');
    validateItem_(data);

    var parent = data.parent_item_id ? findById_('items', data.parent_item_id) : null;
    if (data.parent_item_id && !parent) throw new Error('親タスクが見つかりません');
    if (parent && Number(parent.level) !== 1) throw new Error('子タスクの下には作れません');

    var level = parent ? 2 : 1;
    var all = readAll_('items').filter(function (x) { return x.project_id === data.project_id; });
    var siblings = all.filter(function (x) {
      return Number(x.level) === level && String(x.parent_item_id || '') === String(data.parent_item_id || '');
    });
    var sort = siblings.length
      ? Math.max.apply(null, siblings.map(function (x) { return Number(x.sort_order) || 0; })) + 100 : 100;

    var seq = Number(project.next_item_seq) || (all.length + 1);
    var item = {
      item_id: uuid_(),
      project_id: data.project_id,
      item_key: project.key + '-' + seq,
      level: level,
      parent_item_id: data.parent_item_id || '',
      sort_order: sort,
      name: data.name,
      description: data.description || '',
      item_type: ITEM_TYPES.indexOf(data.item_type) >= 0 ? data.item_type : 'work',
      assignee_user_id: data.assignee_user_id || '',
      status: data.status || STATUS.NOT_STARTED,
      start_date: data.start_date || '',
      end_date: data.end_date || '',
      progress_rate: data.status === STATUS.DONE ? 100 : clampRate_(data.progress_rate),
      created_at: now_(),
      updated_at: now_()
    };
    insertRow_('items', item);
    updateRow_('projects', project.project_id, { next_item_seq: seq + 1, updated_at: now_() });

    if (item.assignee_user_id) notifyAssignChange_(item, '', item.assignee_user_id);
    refreshSummary_(item.project_id);
    return strip_(item);
  });
}

/** タスクを消す。子を持つ行は、子ごと消すかどうかを呼び出し側が決める */
function deleteItem(itemId, withChildren) {
  return withLock_(function () {
    var cur = findById_('items', itemId);
    if (!cur) throw new Error('タスクが見つかりません');
    var kids = readAll_('items').filter(function (x) { return x.parent_item_id === itemId; });
    if (kids.length && !withChildren) {
      throw new Error('子タスクが ' + kids.length + ' 件あります。まとめて消す場合は確認が要ります');
    }
    kids.forEach(function (k) { deleteRow_('items', k.item_id); });
    deleteRow_('items', itemId);
    refreshSummary_(cur.project_id);
    return { ok: true, deleted: kids.length + 1 };
  });
}

/** プロジェクトの設定を保存する */
function saveProject(patch) {
  return withLock_(function () {
    var cur = findById_('projects', patch.project_id);
    if (!cur) throw new Error('プロジェクトが見つかりません');
    if (patch.updated_at && cur.updated_at && patch.updated_at !== cur.updated_at) {
      throw new Error('ほかの人が先に更新しています。画面を再読み込みしてください');
    }
    if (!String(patch.name || '').trim()) throw new Error('名称は必須です');
    if (patch.start_date && patch.end_date && patch.start_date > patch.end_date) {
      throw new Error('開始日が終了日より後になっています');
    }
    var next = {
      name: patch.name,
      description: patch.description || '',
      key: patch.key || cur.key,
      owner_user_id: patch.owner_user_id || cur.owner_user_id,
      status: patch.status || cur.status,
      start_date: patch.start_date || '',
      end_date: patch.end_date || '',
      custom_fields: patch.custom_fields || {},
      updated_at: now_()
    };
    updateRow_('projects', cur.project_id, next);
    refreshSummary_(cur.project_id);
    return { ok: true, updated_at: next.updated_at };
  });
}

/**
 * テンプレートからプロジェクトを作る（要件 F-1-1, F-1-2）
 * テンプレートの相対日数を実日付に展開する。
 */
function createProject(data) {
  return withLock_(function () {
    if (!String(data.name || '').trim()) throw new Error('プロジェクト名は必須です');
    if (!data.start_date) throw new Error('開始日は必須です');

    var tpl = data.template_id ? findById_('templates', data.template_id) : null;
    var fields = tpl ? readAll_('template_fields').filter(function (f) { return f.template_id === tpl.template_id; }) : [];
    var missing = fields.filter(function (f) {
      if (!f.required) return false;
      var v = (data.custom_fields || {})[f.field_key];
      return v === undefined || v === null || v === '' || v === false;
    });
    if (missing.length) {
      throw new Error('必須の設定項目が空です：' + missing.map(function (f) { return f.label; }).join('、'));
    }

    var tplItems = tpl
      ? readAll_('template_items').filter(function (x) { return x.template_id === tpl.template_id; })
          .sort(function (a, b) { return a.sort_order - b.sort_order; })
      : [];

    // 終了日の決め方
    //  - テンプレートあり … いちばん後ろのタスクから自動で決める（要件 F-1-2）
    //  - テンプレートなし … 並べるタスクが無いので、入力してもらう（F-1-11）
    var endDate;
    if (tplItems.length) {
      endDate = data.start_date;
      tplItems.forEach(function (t) {
        var s = hAddDays_(data.start_date, Number(t.start_offset_days) || 0);
        var e = hAddDays_(s, (Number(t.duration_days) || 1) - 1);
        if (e > endDate) endDate = e;
      });
    } else {
      endDate = data.end_date || '';
      if (!endDate) throw new Error('終了日は必須です（テンプレートを使わない場合は自動で決まりません）');
      if (endDate < data.start_date) throw new Error('開始日が終了日より後になっています');
    }

    var pid = uuid_();
    var project = {
      project_id: pid,
      key: data.key || (tpl ? tpl.key_prefix : 'PJ'),
      name: data.name,
      description: data.description || '',
      template_id: tpl ? tpl.template_id : '',
      template_name: tpl ? tpl.name : '',
      owner_user_id: data.owner_user_id || (currentUser_() || {}).user_id || '',
      status: STATUS.NOT_STARTED,
      start_date: data.start_date,
      end_date: endDate,
      custom_fields: data.custom_fields || {},
      next_item_seq: tplItems.length + 1,
      created_at: now_(),
      updated_at: now_()
    };
    insertRow_('projects', project);

    // タスクを展開する。親を先に作り、id の対応表で子をつなぐ
    var idMap = {};
    var seq = 1;
    tplItems.filter(function (t) { return Number(t.level) === 1; }).forEach(function (t) {
      var id = uuid_();
      idMap[t.template_item_id] = id;
      insertRow_('items', buildItem_(id, project, t, '', seq++, data.start_date));
    });
    tplItems.filter(function (t) { return Number(t.level) === 2; }).forEach(function (t) {
      var parentId = idMap[t.parent_template_item_id] || '';
      insertRow_('items', buildItem_(uuid_(), project, t, parentId, seq++, data.start_date));
    });
    updateRow_('projects', pid, { next_item_seq: seq });

    refreshSummary_(pid);
    return strip_(project);
  });
}

function buildItem_(id, project, t, parentId, seq, startDate) {
  var s = hAddDays_(startDate, Number(t.start_offset_days) || 0);
  var e = hAddDays_(s, (Number(t.duration_days) || 1) - 1);
  return {
    item_id: id,
    project_id: project.project_id,
    item_key: project.key + '-' + seq,
    level: Number(t.level),
    parent_item_id: parentId,
    sort_order: Number(t.sort_order) || seq * 100,
    name: t.name,
    description: '',
    item_type: ITEM_TYPES.indexOf(t.item_type) >= 0 ? t.item_type : 'work',
    assignee_user_id: '',
    status: STATUS.NOT_STARTED,
    start_date: s,
    end_date: e,
    progress_rate: 0,
    created_at: now_(),
    updated_at: now_()
  };
}

/** お知らせを既読にする */
function markNotificationsRead(ids) {
  return withLock_(function () {
    (ids || []).forEach(function (id) { updateRow_('notifications', id, { read: true }); });
    return { ok: true, unread: countUnread_(currentUser_()) };
  });
}

/** 設定を保存する（管理者のみ） */
function saveSettings(patch) {
  return withLock_(function () {
    var me = currentUser_();
    if (!me || me.role !== 'admin') throw new Error('設定を変えられるのは管理者だけです');
    Object.keys(patch).forEach(function (k) {
      if (!SETTING_DEFAULTS.hasOwnProperty(k)) return;
      var cur = findById_('settings', k);
      if (cur) updateRow_('settings', k, { value: String(patch[k]) });
      else insertRow_('settings', { key: k, value: String(patch[k]), description: SETTING_DESC[k] || '' });
    });
    return readSettings_();
  });
}

// ---------------------------------------------------------------- 集計キャッシュ

/**
 * 1プロジェクトぶんの集計を計算し直す（要件 F-5-6）。
 * タスクを保存するたびに、そのプロジェクトの1行だけを更新する。
 */
function refreshSummary_(projectId) {
  var project = findById_('projects', projectId);
  if (!project) return;
  var items = readAll_('items').filter(function (x) { return x.project_id === projectId; });
  var t = today_();
  var r = hEvaluateProject_(project, items, t);

  var row = {
    project_id: projectId,
    health: r.health,
    actual_rate: r.actualRate,
    planned_rate: r.plannedRate,
    task_total: r.taskTotal,
    task_done: r.taskDone,
    sub_total: r.subTotal,
    sub_done: r.subDone,
    delayed_count: r.delayedCount,
    computed_at: now_(),
    computed_for_date: t
  };
  if (findById_('summary_cache', projectId)) updateRow_('summary_cache', projectId, row);
  else insertRow_('summary_cache', row);
}

/** 全プロジェクトを計算し直す（毎朝のトリガーから呼ぶ） */
function refreshAllSummaries() {
  readAll_('projects').forEach(function (p) { refreshSummary_(p.project_id); });
}

// ---------------------------------------------------------------- 入力チェック

function clampRate_(v) {
  var n = Number(v);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function validateItem_(o) {
  if (!String(o.name || '').trim()) throw new Error('タスク名は必須です');
  if (o.start_date && o.end_date && o.start_date > o.end_date) {
    throw new Error('開始日が終了日より後になっています');
  }
  if ((o.start_date && !o.end_date) || (!o.start_date && o.end_date)) {
    throw new Error('開始日と終了日は、両方入れるか両方空にしてください');
  }
  var ok = [STATUS.NOT_STARTED, STATUS.IN_PROGRESS, STATUS.ON_HOLD, STATUS.DONE];
  if (o.status && ok.indexOf(o.status) < 0) throw new Error('ステータスの値が不正です');
}
