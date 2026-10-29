/*
 * מאגר מילים: ברירת מחדל מקובץ הנתונים + התאמות המשתמש (הוספה ומחיקה) ב-localStorage.
 * כל מצב משחק (אליאס, בעתיד טאבו) מקבל מאגר נפרד לפי namespace.
 * פריט: { id, word, level, category, forbidden: [], custom }
 */
WG.createBank = (ns, data) => {
  const userKey = ns + ".user.v1";
  const usedKey = ns + ".used.v1";
  const USED_CAP = 3000;

  function parseEntry(entry) {
    if (typeof entry === "string") return { word: entry.trim(), forbidden: [] };
    if (entry && typeof entry === "object") {
      const word = String(entry.w || entry.word || "").trim();
      const f = entry.f || entry.forbidden || [];
      return { word, forbidden: Array.isArray(f) ? f.map((x) => String(x).trim()).filter(Boolean) : [] };
    }
    return { word: "", forbidden: [] };
  }

  const makeId = (level, category, word) => level + "|" + category + "|" + word;

  function defaultItems() {
    const out = [];
    for (const level of Object.keys(data || {})) {
      for (const category of Object.keys(data[level])) {
        let list = data[level][category];
        if (typeof list === "string") list = list.split(",");
        for (const entry of list) {
          const { word, forbidden } = parseEntry(entry);
          if (word) out.push({ id: makeId(level, category, word), word, level, category, forbidden, custom: false });
        }
      }
    }
    return out;
  }

  function readUser() {
    const u = WG.store.get(userKey, null) || {};
    return {
      added: Array.isArray(u.added) ? u.added.filter((x) => x && x.word && x.level && x.category) : [],
      hidden: Array.isArray(u.hidden) ? u.hidden.map(String) : []
    };
  }
  const writeUser = (u) => WG.store.set(userKey, u);

  function items() {
    const user = readUser();
    const hidden = new Set(user.hidden);
    const seen = new Set();
    const out = [];
    const push = (it) => { if (!seen.has(it.id) && !hidden.has(it.id)) { seen.add(it.id); out.push(it); } };
    defaultItems().forEach(push);
    user.added.forEach((a) => {
      const { word, forbidden } = parseEntry({ word: a.word, forbidden: a.forbidden });
      push({ id: makeId(a.level, a.category, word), word, level: a.level, category: a.category, forbidden, custom: true });
    });
    return out;
  }

  function categories() {
    const seen = [];
    for (const it of items()) if (!seen.includes(it.category)) seen.push(it.category);
    for (const level of Object.keys(data || {})) {
      for (const c of Object.keys(data[level])) if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }

  /* שורה אחת: "מילה" או "מילה | אסורה1, אסורה2" (האסורות לשימוש עתידי בטאבו) */
  function parseLine(line) {
    const [wordPart, forbPart] = line.split("|");
    return parseEntry({ word: wordPart, forbidden: forbPart ? forbPart.split(",") : [] });
  }

  function add(level, category, lines) {
    const user = readUser();
    const existing = new Set(items().map((i) => i.id));
    const hidden = new Set(user.hidden);
    let count = 0;
    for (const line of lines) {
      const { word, forbidden } = parseLine(line);
      if (!word) continue;
      const id = makeId(level, category, word);
      if (hidden.has(id)) { hidden.delete(id); count++; continue; }
      if (existing.has(id)) continue;
      existing.add(id);
      user.added.push({ word, level, category, forbidden });
      count++;
    }
    user.hidden = [...hidden];
    writeUser(user);
    return count;
  }

  function remove(item) {
    const user = readUser();
    if (item.custom) {
      user.added = user.added.filter((a) => makeId(a.level, a.category, a.word) !== item.id);
    } else if (!user.hidden.includes(item.id)) {
      user.hidden.push(item.id);
    }
    writeUser(user);
  }

  const resetToDefaults = () => writeUser({ added: [], hidden: [] });
  const userSummary = () => { const u = readUser(); return { added: u.added.length, hidden: u.hidden.length }; };
  const exportJson = () => JSON.stringify({ version: 1, ns, ...readUser() }, null, 2);

  function importJson(text) {
    const parsed = JSON.parse(text);
    const src = parsed && typeof parsed === "object" ? parsed : {};
    const user = readUser();
    const known = new Set(user.added.map((a) => makeId(a.level, a.category, a.word)));
    let count = 0;
    for (const a of Array.isArray(src.added) ? src.added : []) {
      if (!a || !a.word || !a.level || !a.category) continue;
      const entry = { word: String(a.word).trim(), level: String(a.level), category: String(a.category), forbidden: Array.isArray(a.forbidden) ? a.forbidden.map(String) : [] };
      const id = makeId(entry.level, entry.category, entry.word);
      if (known.has(id) || !entry.word) continue;
      known.add(id);
      user.added.push(entry);
      count++;
    }
    for (const h of Array.isArray(src.hidden) ? src.hidden : []) {
      if (typeof h === "string" && !user.hidden.includes(h)) user.hidden.push(h);
    }
    writeUser(user);
    return count;
  }

  /*
   * חבילת קלפים: מגרילים בלי חזרות. מילים שכבר הופיעו נשמרות בין משחקים
   * ומתאפסות רק כשכל המילים הזמינות נוצלו.
   */
  function deck(list) {
    const byWord = new Map();
    for (const it of list) if (!byWord.has(it.word)) byWord.set(it.word, it);
    const all = [...byWord.values()];
    let used = new Set(WG.store.get(usedKey, []));
    let queue = WG.shuffle(all.filter((it) => !used.has(it.word)));

    const persist = () => WG.store.set(usedKey, [...used].slice(-USED_CAP));

    return {
      size: all.length,
      draw() {
        if (!all.length) return null;
        if (!queue.length) {
          for (const it of all) used.delete(it.word);
          queue = WG.shuffle(all);
        }
        const item = queue.pop();
        used.add(item.word);
        persist();
        return item;
      }
    };
  }

  return { items, categories, add, remove, resetToDefaults, userSummary, exportJson, importJson, deck };
};
