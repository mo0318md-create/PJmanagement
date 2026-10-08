/**
 * ブラウザから google.script.run で呼ぶ関数（簡易版）
 * 要件書 §5.1 の2段階読み込みに対応する。
 *
 *   ① 起動直後   getBootstrap()  … projects + summary_cache + users + settings（軽い）
 *   ② 続けて裏で getItems()      … items 全件（重い。画面はもう出ている）
 *   ③ 保存のたび saveItem() など（変えた行だけ）
 */

// ---------------------------------------------------------------- 読み込み

/**
 * ログイン中の人。担当者一覧（peopleForUi_、Common.gs）と**同じID空間**で返す。
 * 実体は resolveMe_（Common.gs）。ここでは pp を省略して呼ぶだけの薄いラッパー。
 */
function currentUser_() {
  var key = meCacheKey_();
  if (key) {
    try { var hit = CacheService.getScriptCache().get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  }
  return rememberMe_(resolveMe_(peopleForUi_()));
}

function meCacheKey_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) {}
  return email ? 'me:' + email.toLowerCase() : '';
}
function rememberMe_(me) {
  var key = meCacheKey_();
  if (key && me) { try { CacheService.getScriptCache().put(key, JSON.stringify(me), 600); } catch (e) {} }
  return me;
}

/* ---- 誰がいつ登録・更新したか（① 最終更新日時 ② 登録者・更新者）----
 * 人は ID（社員コード）と、その時点の氏名の両方を持つ。退職などで一覧から消えても、記録の名前は残る。 */
function stampNew_(o, me) {
  var t = now_();
  o.created_at = t; o.updated_at = t;
  o.created_by = me ? me.user_id : ''; o.created_by_name = me ? me.name : '';
  o.updated_by = o.created_by; o.updated_by_name = o.created_by_name;
  return o;
}
function stampEdit_(o, me) {
  o.updated_at = now_();
  o.updated_by = me ? me.user_id : ''; o.updated_by_name = me ? me.name : '';
  return o;
}

/**
 * ① 起動直後に呼ぶ。プロジェクト一覧を描くのに要るものだけを返す。
 * タスク1,000行を待たずに最初の画面が出る。
 */
function getBootstrap() {
  var t = today_();
  var projects = readAll_('projects');
  var tplFieldsAll = readAll_('template_fields');
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
  // ログイン中の人も、担当者一覧と同じID空間で解決する（pp を渡して二重取得を避ける）
  var me = rememberMe_(resolveMe_(pp));
  var note = pp.note;
  var peopleOut = pp.people.slice();
  if (me && me.notInPeopleList) {
    var extra = '担当者一覧に自分（' + me.email + '）が見当たりません。担当者候補に加えて動かします';
    note = note ? note + ' ／ ' + extra : extra;
    // 選択肢に自分が出ないと、オーナーやマイタスクが成立しない。先頭に加えておく
    peopleOut.unshift({ code: me.user_id, name: me.name, email: me.email, deptName: '', positionName: '' });
  }
  return {
    today: t,
    me: me ? { user_id: me.user_id, name: me.name, email: me.email, role: me.role,
               notInPeopleList: !!me.notInPeopleList } : null,
    users: peopleOut.map(function (p) {
      // 画面は user_id / name で扱う。user_id の中身は社員コード（common のとき）
      return { user_id: p.code, name: p.name, email: p.email, dept: p.deptName, deptCode: p.deptCode || '', position: p.positionName };
    }),
    // 部署で絞り込むための部署の一覧。common から読めたときだけ（控え・ローカルでは出さない）
    depts: (function () {
      if (pp.source !== 'common') return [];
      try { return deptsForUi_(); } catch (e) { return []; }
    })(),
    driveReady: hasDriveRoot_(),
    peopleSource: pp.source,
    peopleNote: note,
    projects: projects.map(function (p) {
      var o = strip_(p);
      o.field_defs = fieldDefsOf_(p, tplFieldsAll);
      return o;
    }),
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
 *                status, start_date, end_date, progress_rate, depends_on?, updated_at }
 *   depends_on は渡したときだけ書き換える（ガントやボードからの保存では渡さない）
 *   complete_children: true で完了にすると、完了していない子タスクもまとめて完了にする（Backlog の「すべて完了にする」）
 *   complete_parent: true で子タスクを完了にすると、兄弟がすべて完了していれば親タスクも完了にする
 *   complete_project: true なら、プロジェクトのタスクがすべて完了になったとき、プロジェクトも完了にする
 *   updated_at は読み込んだときの値。ほかの人が先に更新していたら弾く。
 */
function saveItem(patch) {
  var me = currentUser_();
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
      end_date: patch.end_date || ''
    };
    if (Array.isArray(patch.depends_on)) {
      next.depends_on = cleanDeps_(cur.item_id, cur.project_id, cur.parent_item_id, patch.depends_on);
    }
    stampEdit_(next, me);

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
    // 親を完了にするとき、選ばれていれば子タスクもまとめて完了にする（親だけ完了も選べる）
    var children = [];
    if (patch.complete_children === true && next.status === STATUS.DONE) {
      readAll_('items').forEach(function (k) {
        if (k.parent_item_id !== cur.item_id || k.status === STATUS.DONE) return;
        var kn = { status: STATUS.DONE, progress_rate: 100 };
        stampEdit_(kn, me);
        updateRow_('items', k.item_id, kn);
        var ks = strip_(k);
        Object.keys(kn).forEach(function (key) { ks[key] = kn[key]; });
        children.push(ks);
      });
    }
    // 画面は、この戻り値だけで表示を合わせる（全件の読み直しや起動データの取り直しをしない）
    var saved = strip_(cur);
    Object.keys(next).forEach(function (k) { saved[k] = next[k]; });
    // 最後の子タスクを完了にするとき、選ばれていれば親タスクも完了にする
    var parentSaved = null;
    if (patch.complete_parent === true && next.status === STATUS.DONE && cur.parent_item_id) {
      var par = findById_('items', cur.parent_item_id);
      var allDone = readAll_('items').every(function (k) {
        return k.parent_item_id !== cur.parent_item_id || k.item_id === cur.item_id || k.status === STATUS.DONE;
      });
      if (par && par.status !== STATUS.DONE && allDone) {
        var pn = { status: STATUS.DONE, progress_rate: '' };   // 子を持つので進捗率は子の平均（行には持たない）
        stampEdit_(pn, me);
        updateRow_('items', par.item_id, pn);
        parentSaved = strip_(par);
        Object.keys(pn).forEach(function (key) { parentSaved[key] = pn[key]; });
      }
    }
    // 最後のタスクを完了にするとき、選ばれていればプロジェクトも完了にする（全件が完了のときだけ）
    var projectSaved = null;
    if (patch.complete_project === true && next.status === STATUS.DONE) {
      var pj = findById_('projects', cur.project_id);
      var left = readAll_('items').some(function (k) { return k.project_id === cur.project_id && k.status !== STATUS.DONE; });
      if (pj && pj.status !== STATUS.DONE && !left) {
        var pjn = { status: STATUS.DONE };
        stampEdit_(pjn, me);
        updateRow_('projects', pj.project_id, pjn);
        projectSaved = strip_(pj);
        Object.keys(pjn).forEach(function (key) { projectSaved[key] = pjn[key]; });
      }
    }
    return { ok: true, updated_at: next.updated_at, item: saved, children: children, parent: parentSaved, project: projectSaved, summary: refreshSummary_(cur.project_id) };
  });
}

/**
 * タスクを追加する。parent_item_id を渡すと子タスクになる。
 * @param data { project_id, parent_item_id?, name, item_type, assignee_user_id, status, start_date, end_date, progress_rate }
 */
function addItem(data) {
  var me = currentUser_();
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
      depends_on: []
    };
    if (Array.isArray(data.depends_on)) item.depends_on = cleanDeps_(item.item_id, item.project_id, item.parent_item_id, data.depends_on);
    stampNew_(item, me);
    insertRow_('items', item);
    // 連番だけを進める。プロジェクトの更新日時は変えない
    // （変えると、設定画面を開いている人が「ほかの人が先に更新しています」で保存できなくなる）
    updateRow_('projects', project.project_id, { next_item_seq: seq + 1 });

    if (item.assignee_user_id) notifyAssignChange_(item, '', item.assignee_user_id);
    return { item: strip_(item), summary: refreshSummary_(item.project_id) };
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
    // 消したタスクを「前のタスク」にしていた行から外す。更新日時は変えない（開いている人の保存を弾かないように）
    var gone = [itemId].concat(kids.map(function (k) { return k.item_id; }));
    readAll_('items').forEach(function (x) {
      if (x.project_id !== cur.project_id || !Array.isArray(x.depends_on) || !x.depends_on.length) return;
      var left = x.depends_on.filter(function (d) { return gone.indexOf(d) < 0; });
      if (left.length !== x.depends_on.length) updateRow_('items', x.item_id, { depends_on: left });
    });
    return {
      ok: true, deleted: kids.length + 1,
      ids: [itemId].concat(kids.map(function (k) { return k.item_id; })),
      summary: refreshSummary_(cur.project_id)
    };
  });
}

/* ============ プロジェクトの設定項目 ============
 *
 * 1項目 = { key, label, type, options, required, source }
 *   source 'template' … テンプレートからコピーした項目。名前・型・必須は画面から変えられない
 *   source 'project'  … そのプロジェクトで足した項目。名前・型・選択肢を自由に決められる
 * 値は projects.custom_fields に { key: 値 } で持つ。
 */

/** テンプレートの項目定義を、プロジェクトに持たせる形にする */
function templateFieldDefs_(templateId, allFields) {
  return allFields
    .filter(function (f) { return f.template_id === templateId; })
    .sort(function (a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); })
    .map(function (f) {
      return {
        key: f.field_key, label: f.label,
        type: FIELD_TYPES.indexOf(f.type) >= 0 ? f.type : 'text',
        options: f.options || [], required: !!f.required, source: 'template'
      };
    });
}

/**
 * プロジェクトの項目定義を返す。
 * field_defs 列が空欄の古い行は、テンプレートの定義と値のキーから組み立てる（保存した時点で列に入る）。
 */
function fieldDefsOf_(p, allTplFields) {
  if (Array.isArray(p.field_defs)) return p.field_defs;
  var defs = p.template_id ? templateFieldDefs_(p.template_id, allTplFields || readAll_('template_fields')) : [];
  var seen = {};
  defs.forEach(function (d) { seen[d.key] = true; });
  Object.keys(p.custom_fields || {}).forEach(function (k) {
    if (!seen[k]) defs.push({ key: k, label: k, type: 'text', options: [], required: false, source: 'project' });
  });
  return defs;
}

/** 画面から来た「そのプロジェクトで足した項目」の定義を確かめる */
function cleanProjectDefs_(list, templateDefs) {
  var labels = {}, keys = {};
  templateDefs.forEach(function (d) { labels[String(d.label).toLowerCase()] = true; keys[d.key] = true; });
  var out = [];
  (list || []).forEach(function (d) {
    var label = String(d.label || '').trim();
    if (!label) return;                                  // 名前の無い行は捨てる
    if (label.length > 40) throw new Error('項目名は40文字までにしてください：' + label);
    if (labels[label.toLowerCase()]) throw new Error('項目名「' + label + '」が2つあります。別の名前にしてください');
    labels[label.toLowerCase()] = true;

    var type = FIELD_TYPES.indexOf(d.type) >= 0 ? d.type : 'text';
    var options = [];
    if (type === 'select') {
      (Array.isArray(d.options) ? d.options : String(d.options || '').split(/[,、]/)).forEach(function (o) {
        o = String(o).trim();
        if (o && options.indexOf(o) < 0) options.push(o);
      });
      if (!options.length) throw new Error('「' + label + '」は選択肢の型です。選択肢を1つ以上入れてください');
    }
    var key = String(d.key || '').trim().slice(0, 64);
    if (!key || keys[key]) key = 'f_' + uuid_().replace(/-/g, '').slice(0, 12);
    keys[key] = true;
    out.push({ key: key, label: label, type: type, options: options, required: false, source: 'project' });
  });
  return out;
}

/** 値を型に合わせて直す。定義に無いキーは持たない */
function cleanFieldValues_(defs, values) {
  values = values || {};
  var out = {};
  defs.forEach(function (d) {
    var v = values[d.key];
    if (d.type === 'checkbox') { out[d.key] = v === true || v === 'true'; return; }
    if (v === undefined || v === null || String(v).trim() === '') { out[d.key] = ''; return; }
    var s = String(v).trim();
    if (d.type === 'number') {
      var n = Number(s.replace(/,/g, ''));
      if (isNaN(n)) throw new Error('「' + d.label + '」は数値で入れてください');
      out[d.key] = n;
    } else if (d.type === 'date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('「' + d.label + '」は日付で入れてください');
      out[d.key] = s;
    } else if (d.type === 'select') {
      if ((d.options || []).indexOf(s) < 0) throw new Error('「' + d.label + '」の値が選択肢にありません：' + s);
      out[d.key] = s;
    } else {
      out[d.key] = s;
    }
  });
  var missing = defs.filter(function (d) { return d.required && (out[d.key] === '' || out[d.key] === false); });
  if (missing.length) {
    throw new Error('必須の設定項目が空です：' + missing.map(function (d) { return d.label; }).join('、'));
  }
  return out;
}

/** プロジェクトの設定を保存する */
function saveProject(patch) {
  var me = currentUser_();
  return withLock_(function () {
    var cur = findById_('projects', patch.project_id);
    if (!cur) throw new Error('プロジェクトが見つかりません');
    if (patch.updated_at && cur.updated_at && patch.updated_at !== cur.updated_at) {
      throw new Error('ほかの人が先に更新しています。画面を再読み込みしてください');
    }
    if (!String(patch.name || '').trim()) throw new Error('名称は必須です');
    if (patch.key !== undefined) {
      var k = String(patch.key || '').trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9]{1,9}$/.test(k)) {
        throw new Error('キーは英大文字で始まる2〜10文字の英数字にしてください（例：CORP）');
      }
      if (readAll_('projects').some(function (p) {
        return p.project_id !== cur.project_id && String(p.key).toUpperCase() === k;
      })) throw new Error('キー「' + k + '」はすでに別のプロジェクトで使われています');
      patch.key = k;
    }
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
      end_date: patch.end_date || ''
    };
    // 資料フォルダ（URL でも ID でもよい。空にすると外れる）
    if (patch.drive_folder !== undefined) {
      var ds = String(patch.drive_folder || '').trim();
      if (ds && !folderIdFromUrl_(ds)) {
        throw new Error('資料フォルダのURLが読み取れません。Drive でフォルダを開いて「リンクをコピー」した文字列を貼ってください。');
      }
      next.drive_folder_url = ds;   // 貼られた URL をそのまま持つ
    }
    stampEdit_(next, me);
    // テンプレート由来の項目は画面から変えさせない（名前・型・必須はプロジェクトが持つ控えのまま）
    var curDefs = fieldDefsOf_(cur);
    var tDefs = curDefs.filter(function (d) { return d.source === 'template'; });
    var pDefs = patch.field_defs
      ? cleanProjectDefs_(patch.field_defs.filter(function (d) { return d.source !== 'template'; }), tDefs)
      : curDefs.filter(function (d) { return d.source !== 'template'; });
    next.field_defs = tDefs.concat(pDefs);
    next.custom_fields = cleanFieldValues_(next.field_defs, patch.custom_fields);
    updateRow_('projects', cur.project_id, next);
    // プロジェクトを完了にするとき、選ばれていれば完了していないタスクもまとめて完了にする
    var items = [];
    if (patch.complete_items === true && next.status === STATUS.DONE) {
      var all = readAll_('items').filter(function (k) { return k.project_id === cur.project_id; });
      all.forEach(function (k) {
        if (k.status === STATUS.DONE) return;
        var hasKids = all.some(function (x) { return x.parent_item_id === k.item_id; });
        var kn = { status: STATUS.DONE, progress_rate: hasKids ? '' : 100 };
        stampEdit_(kn, me);
        updateRow_('items', k.item_id, kn);
        var ks = strip_(k);
        Object.keys(kn).forEach(function (key) { ks[key] = kn[key]; });
        items.push(ks);
      });
    }
    var saved = strip_(cur);
    Object.keys(next).forEach(function (k) { saved[k] = next[k]; });
    return {
      ok: true, updated_at: next.updated_at, updated_by: next.updated_by, updated_by_name: next.updated_by_name,
      field_defs: next.field_defs, custom_fields: next.custom_fields,
      project: saved, items: items, summary: refreshSummary_(cur.project_id)
    };
  });
}

/**
 * テンプレートからプロジェクトを作る（要件 F-1-1, F-1-2）
 * テンプレートの相対日数を実日付に展開する。
 */
function createProject(data) {
  var me = currentUser_();
  return withLock_(function () {
    if (!String(data.name || '').trim()) throw new Error('プロジェクト名は必須です');
    if (!data.start_date) throw new Error('開始日は必須です');

    var tpl = data.template_id ? findById_('templates', data.template_id) : null;
    if (data.template_id && !tpl) throw new Error('選んだテンプレートが見つかりません。画面を再読み込みしてください');

    // 設定項目の定義はテンプレートからコピーしてプロジェクトに持たせる（あとでテンプレートを変えても遡及しない F-1-9）
    var tDefs = tpl ? templateFieldDefs_(tpl.template_id, readAll_('template_fields')) : [];
    var pDefs = cleanProjectDefs_((data.field_defs || []).filter(function (d) { return d.source !== 'template'; }), tDefs);
    var fieldDefs = tDefs.concat(pDefs);
    var fieldValues = cleanFieldValues_(fieldDefs, data.custom_fields);

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

    // キーはタスクのキー（CORP-1）の頭になる。**プロジェクトごとに違う値**でないと、
    // 別のプロジェクトのタスクと同じキーができてしまう。
    var key = String(data.key || (tpl ? tpl.key_prefix : '')).trim().toUpperCase();
    if (!key) throw new Error('キーは必須です（タスクのキーの頭になります。例：CORP）');
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
      throw new Error('キーは英大文字で始まる2〜10文字の英数字にしてください（例：CORP、A200）');
    }
    if (readAll_('projects').some(function (p) { return String(p.key).toUpperCase() === key; })) {
      throw new Error('キー「' + key + '」はすでに使われています。別のキーにしてください');
    }

    var pid = uuid_();
    var project = {
      project_id: pid,
      key: key,
      name: data.name,
      description: data.description || '',
      template_id: tpl ? tpl.template_id : '',
      template_name: tpl ? tpl.name : '',
      owner_user_id: data.owner_user_id || (me || {}).user_id || '',
      status: STATUS.NOT_STARTED,
      start_date: data.start_date,
      end_date: endDate,
      custom_fields: fieldValues,
      field_defs: fieldDefs,
      next_item_seq: tplItems.length + 1
    };
    stampNew_(project, me);
    insertRow_('projects', project);

    // タスクを展開する。親を先に作り、id の対応表で子をつなぐ
    var idMap = {}, created = [];
    var seq = 1;
    tplItems.filter(function (t) { return Number(t.level) === 1; }).forEach(function (t) {
      var id = uuid_();
      idMap[t.template_item_id] = id;
      var row1 = stampNew_(buildItem_(id, project, t, '', seq++, data.start_date), me);
      insertRow_('items', row1); created.push(strip_(row1));
    });
    tplItems.filter(function (t) { return Number(t.level) === 2; }).forEach(function (t) {
      var parentId = idMap[t.parent_template_item_id] || '';
      var row2 = stampNew_(buildItem_(uuid_(), project, t, parentId, seq++, data.start_date), me);
      insertRow_('items', row2); created.push(strip_(row2));
    });
    updateRow_('projects', pid, { next_item_seq: seq });

    var out = strip_(project);
    out.next_item_seq = seq;
    out.summary = refreshSummary_(pid);
    out.items = created;
    return out;
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

// ---------------------------------------------------------------- 権限（admin/member）
//
// 【役職と身元の分離】人の身元（誰であるか）は共通マスタから読む（Common.gs、社員コード）。
// 役職（admin/member）は共通マスタに無い、このアプリだけの概念なので、
// ローカルの users シートに email をキーとして持つ。書き込むのは users シートだけで、
// 共通マスタには一切書き込まない（Common.gs 冒頭のコメントの境界を守る）。

/** 管理者一覧の元データ。ローカル users シートに登録がある人だけ role を上書きできる */
function getRoles() {
  return readAll_('users').map(function (u) {
    return { email: u.email, name: u.name, role: u.role };
  });
}

/** 役職を保存する（管理者のみ）。ローカルの users シートに email で upsert する */
function saveRole(data) {
  return withLock_(function () {
    var me = currentUser_();
    if (!me || me.role !== 'admin') throw new Error('権限を変えられるのは管理者だけです');
    var email = String(data.email || '').trim();
    if (!email) throw new Error('メールアドレスは必須です');
    var role = data.role === 'admin' ? 'admin' : 'member';

    var users = readAll_('users');
    var existing = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).toLowerCase() === email.toLowerCase()) { existing = users[i]; break; }
    }
    if (existing) {
      updateRow_('users', existing.user_id, { role: role, name: data.name || existing.name });
    } else {
      // 最後の管理者を member に落とすと、誰も設定を触れなくなる。ここで止める
      insertRow_('users', {
        user_id: uuid_(), name: data.name || email, email: email, role: role, active: true, created_at: now_()
      });
    }
    // 最後の管理者を member に落とす操作を防ぐ
    var after = readAll_('users');
    var admins = after.filter(function (u) { return u.role === 'admin'; });
    if (!admins.length) {
      throw new Error('管理者が0人になってしまいます。誰か1人は管理者のままにしてください');
    }
    try { CacheService.getScriptCache().remove('me:' + email.toLowerCase()); } catch (e) {}
    return getRoles();
  });
}

// ---------------------------------------------------------------- ⑯ テンプレート編集（管理者のみ）
//
// テンプレートは「よく使う項目・タスク構成を最初から並べておく」ための入力短縮の型。
// 変更は既存プロジェクトに遡及しない（作成時にコピーされるだけ。F-1-9）ので、
// ここでの編集は「次にこのテンプレートで作るプロジェクトから」効く。

function assertAdmin_() {
  var me = currentUser_();
  if (!me || me.role !== 'admin') throw new Error('テンプレートを変えられるのは管理者だけです');
  return me;
}

/** テンプレート一覧＋各テンプレートのタスク数・項目数（一覧表示用） */
function getTemplates() {
  var items = readAll_('template_items'), fields = readAll_('template_fields');
  return readAll_('templates').sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(function (t) {
      var o = strip_(t);
      o.item_count = items.filter(function (x) { return x.template_id === t.template_id; }).length;
      o.field_count = fields.filter(function (x) { return x.template_id === t.template_id; }).length;
      return o;
    });
}

/** テンプレートの中身（タスク構成・設定項目）を変えたとき、テンプレート自体の更新日時・更新者も進める */
function touchTemplate_(templateId, me) {
  if (templateId && findById_('templates', templateId)) updateRow_('templates', templateId, stampEdit_({}, me));
}

function createTemplate(data) {
  return withLock_(function () {
    var me = assertAdmin_();
    if (!String(data.name || '').trim()) throw new Error('テンプレート名は必須です');
    var prefix = String(data.key_prefix || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)) {
      throw new Error('キーの接頭辞は英大文字で始まる2〜10文字の英数字にしてください（例：WEB）');
    }
    var tpl = {
      template_id: uuid_(), name: data.name, description: data.description || '',
      key_prefix: prefix, active: true,
      sort_order: (readAll_('templates').length + 1) * 100
    };
    stampNew_(tpl, me);
    insertRow_('templates', tpl);
    return strip_(tpl);
  });
}

function updateTemplate(data) {
  return withLock_(function () {
    var me = assertAdmin_();
    var cur = findById_('templates', data.template_id);
    if (!cur) throw new Error('テンプレートが見つかりません');
    if (!String(data.name || '').trim()) throw new Error('テンプレート名は必須です');
    var prefix = String(data.key_prefix || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(prefix)) {
      throw new Error('キーの接頭辞は英大文字で始まる2〜10文字の英数字にしてください（例：WEB）');
    }
    updateRow_('templates', cur.template_id, stampEdit_({
      name: data.name, description: data.description || '', key_prefix: prefix,
      active: data.active !== false
    }, me));
    return { ok: true };
  });
}

/** テンプレートを消す。すでにこのテンプレートで作ったプロジェクトには影響しない（コピー済みのため） */
function deleteTemplate(templateId) {
  return withLock_(function () {
    assertAdmin_();
    readAll_('template_items').filter(function (x) { return x.template_id === templateId; })
      .forEach(function (x) { deleteRow_('template_items', x.template_item_id); });
    readAll_('template_fields').filter(function (x) { return x.template_id === templateId; })
      .forEach(function (x) { deleteRow_('template_fields', x.field_id); });
    deleteRow_('templates', templateId);
    return { ok: true };
  });
}

/** タスク構成の1行を足す／直す／消す。data.template_item_id が有れば更新、無ければ追加 */
function saveTemplateItem(data) {
  return withLock_(function () {
    var me = assertAdmin_();
    touchTemplate_(data.template_id, me);
    if (!String(data.name || '').trim()) throw new Error('タスク名は必須です');
    var level = data.parent_template_item_id ? 2 : 1;
    var row = {
      template_id: data.template_id, level: level,
      parent_template_item_id: data.parent_template_item_id || '',
      name: data.name, item_type: ITEM_TYPES.indexOf(data.item_type) >= 0 ? data.item_type : 'work',
      start_offset_days: Number(data.start_offset_days) || 0,
      duration_days: Math.max(1, Number(data.duration_days) || 1)
    };
    if (data.template_item_id) {
      if (!findById_('template_items', data.template_item_id)) throw new Error('タスクが見つかりません');
      updateRow_('template_items', data.template_item_id, row);
      return { ok: true, template_item_id: data.template_item_id };
    }
    row.template_item_id = uuid_();
    var siblings = readAll_('template_items').filter(function (x) {
      return x.template_id === data.template_id && Number(x.level) === level &&
        String(x.parent_template_item_id || '') === String(row.parent_template_item_id);
    });
    row.sort_order = siblings.length ? Math.max.apply(null, siblings.map(function (x) { return Number(x.sort_order) || 0; })) + 100 : 100;
    insertRow_('template_items', row);
    return { ok: true, template_item_id: row.template_item_id };
  });
}

function deleteTemplateItem(templateItemId) {
  return withLock_(function () {
    var me = assertAdmin_();
    var ti = findById_('template_items', templateItemId);
    if (ti) touchTemplate_(ti.template_id, me);
    // 親を消すときは、配下の子タスク定義も一緒に消す
    readAll_('template_items').filter(function (x) { return x.parent_template_item_id === templateItemId; })
      .forEach(function (x) { deleteRow_('template_items', x.template_item_id); });
    deleteRow_('template_items', templateItemId);
    return { ok: true };
  });
}

/** 設定項目の定義を足す／直す／消す */
function saveTemplateField(data) {
  return withLock_(function () {
    var me = assertAdmin_();
    touchTemplate_(data.template_id, me);
    var key = String(data.field_key || '').trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      throw new Error('項目キーは英字で始まる英数字とアンダースコアにしてください（例：client_name）');
    }
    if (!String(data.label || '').trim()) throw new Error('表示名は必須です');
    var dup = readAll_('template_fields').filter(function (x) {
      return x.template_id === data.template_id && x.field_key === key && x.field_id !== data.field_id;
    });
    if (dup.length) throw new Error('この項目キーはこのテンプレートですでに使われています');

    var row = {
      template_id: data.template_id, field_key: key, label: data.label,
      type: FIELD_TYPES.indexOf(data.type) >= 0 ? data.type : 'text',
      required: !!data.required,
      options: data.type === 'select' ? String(data.options || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean) : []
    };
    if (data.field_id) {
      if (!findById_('template_fields', data.field_id)) throw new Error('設定項目が見つかりません');
      updateRow_('template_fields', data.field_id, row);
      return { ok: true, field_id: data.field_id };
    }
    row.field_id = uuid_();
    var siblings = readAll_('template_fields').filter(function (x) { return x.template_id === data.template_id; });
    row.sort_order = siblings.length ? Math.max.apply(null, siblings.map(function (x) { return Number(x.sort_order) || 0; })) + 100 : 100;
    insertRow_('template_fields', row);
    return { ok: true, field_id: row.field_id };
  });
}

function deleteTemplateField(fieldId) {
  return withLock_(function () {
    var me = assertAdmin_();
    var f = findById_('template_fields', fieldId);
    if (f) touchTemplate_(f.template_id, me);
    deleteRow_('template_fields', fieldId);
    return { ok: true };
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
  row.stale = false;
  return row;
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

/**
 * 「前のタスク」を確かめて整える。同じプロジェクトの、自分・自分の親・自分の子以外のタスクだけ。
 * たどって自分に戻る（ぐるぐる回る）つなぎ方は受け付けない。
 */
function cleanDeps_(selfId, projectId, parentId, list) {
  var all = readAll_('items').filter(function (x) { return x.project_id === projectId; });
  var byId = {};
  all.forEach(function (x) { byId[x.item_id] = x; });
  var out = [];
  list.forEach(function (id) {
    id = String(id || '');
    var x = byId[id];
    if (!x || id === selfId || out.indexOf(id) >= 0) return;
    if (id === parentId) throw new Error('親タスク「' + x.name + '」は前のタスクにできません');
    if (x.parent_item_id && x.parent_item_id === selfId) throw new Error('子タスク「' + x.name + '」は前のタスクにできません');
    out.push(id);
  });
  if (out.length > 20) throw new Error('前のタスクは20件までです');
  // 自分から後ろへたどって、選んだタスクに行き着くなら輪になる
  out.forEach(function (id) {
    var seen = {}, stack = [id];
    while (stack.length) {
      var cur = stack.pop();
      if (cur === selfId) throw new Error('「' + byId[id].name + '」は、このタスクの完了を待つ側にあるため、前のタスクにできません');
      if (seen[cur]) continue;
      seen[cur] = true;
      var deps = cur === selfId ? out : ((byId[cur] && byId[cur].depends_on) || []);
      deps.forEach(function (d) { stack.push(d); });
    }
  });
  return out;
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
