(() => {
  "use strict";

  const { settings: Settings, Engine, LEVELS } = WG;
  const $ = (id) => document.getElementById(id);
  const SCREENS = ["setup", "ready", "play", "summary", "end", "words"];

  /* ---------- עזרים ---------- */
  const SVG_TAGS = new Set(["svg", "circle"]);

  /* replaceChildren שמדלג על false/null (תוצאה של תנאים) */
  const fill = (el, ...children) => el.replaceChildren(...children.flat().filter((c) => c != null && c !== false));

  function h(tag, attrs, ...children) {
    const el = SVG_TAGS.has(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function show(name) {
    for (const s of SCREENS) $(s + "Screen").classList.toggle("hidden", s !== name);
    window.scrollTo(0, 0);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  const mode = () => {
    const m = WG.MODES[Settings.get().mode];
    return m && m.available() ? m : WG.MODES.alias;
  };

  /* ---------- צליל, רטט ומסך דלוק ---------- */
  const Sound = (() => {
    let ctx = null;
    function init() {
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
      } catch (e) { ctx = null; }
    }
    function tone(freq, start, dur, vol) {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t0 = ctx.currentTime + start;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    const on = () => Settings.get().sound;
    return {
      init,
      tick: () => on() && tone(900, 0, 0.08, 0.15),
      correct: () => on() && (tone(660, 0, 0.1, 0.2), tone(880, 0.09, 0.14, 0.2)),
      skip: () => on() && tone(240, 0, 0.14, 0.2),
      buzz: () => on() && (tone(160, 0, 0.18, 0.25), tone(130, 0.16, 0.22, 0.25)),
      end: () => on() && [0, 0.25, 0.5].forEach((d) => tone(520, d, 0.2, 0.25)),
      win: () => on() && [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.25, 0.22))
    };
  })();

  const vibrate = (pattern) => {
    if (Settings.get().vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignore */ } }
  };

  let wakeLock = null;
  async function keepAwake(on) {
    try {
      if (on && Settings.get().keepAwake && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
      else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }

  /* ---------- קומפוננטות הגדרה ---------- */
  function stepper(key, label, { min, max, step = 1, suffix = "", format } = {}, rerender) {
    const s = Settings.get();
    const value = h("span", { class: "stepper-value" }, format ? format(s[key]) : s[key] + suffix);
    const set = (delta) => {
      s[key] = Math.min(max, Math.max(min, s[key] + delta));
      Settings.save();
      value.textContent = format ? format(s[key]) : s[key] + suffix;
      if (rerender) rerender();
    };
    return h("div", { class: "row" },
      h("span", { class: "row-label" }, label),
      h("div", { class: "stepper" },
        h("button", { type: "button", "aria-label": "הפחת", onclick: () => set(-step) }, "−"),
        value,
        h("button", { type: "button", "aria-label": "הוסף", onclick: () => set(step) }, "+")));
  }

  function segmented(key, label, options, rerender) {
    const s = Settings.get();
    const wrap = h("div", { class: "segmented" });
    const paint = () => [...wrap.children].forEach((b) => b.classList.toggle("on", b.dataset.value === String(s[key])));
    for (const [value, text] of options) {
      wrap.append(h("button", {
        type: "button", "data-value": String(value),
        onclick: () => { s[key] = value; Settings.save(); paint(); if (rerender) rerender(); }
      }, text));
    }
    paint();
    return h("div", { class: "row stack" }, h("span", { class: "row-label" }, label), wrap);
  }

  function toggle(key, label, hint) {
    const s = Settings.get();
    const input = h("input", { type: "checkbox", onchange: () => { s[key] = input.checked; Settings.save(); } });
    input.checked = !!s[key];
    return h("label", { class: "row switch" },
      h("span", { class: "row-label" }, label, hint && h("small", {}, hint)),
      input, h("span", { class: "slider", "aria-hidden": "true" }));
  }

  function chip(text, on, onclick, extra) {
    return h("button", { type: "button", class: "chip" + (on ? " on" : ""), onclick }, extra, text);
  }

  /* ---------- מסך הגדרות ---------- */
  function renderSetup() {
    const root = $("setupScreen");
    fill(root, );
    const secs = {
      head: h("div"), teams: h("div", { class: "card" }), rules: h("div", { class: "card" }),
      words: h("div", { class: "card" }), extras: h("div", { class: "card" })
    };

    function drawHead() {
      const m = mode();
      fill(secs.head, 
        h("div", { class: "hero" },
          h("div", { class: "logo", "aria-hidden": "true" }, m.emoji),
          h("h1", {}, m.title),
          h("p", {}, m.tagline)),
        WG.availableModes().length > 1 && h("div", { class: "segmented mode-switch" },
          WG.availableModes().map((md) => h("button", {
            type: "button", class: md.id === m.id ? "on" : "",
            onclick: () => { Settings.get().mode = md.id; Settings.save(); document.title = md.title; renderSetup(); }
          }, md.emoji + " " + md.title))));
    }

    function drawTeams() {
      const s = Settings.get();
      const list = h("div", { class: "team-list" });
      s.teams.forEach((t, i) => {
        const dot = h("button", {
          type: "button", class: "team-dot", style: `background:${t.color}`, "aria-label": "החלף צבע",
          onclick: () => {
            const colors = Settings.TEAM_COLORS;
            t.color = colors[(colors.indexOf(t.color) + 1) % colors.length];
            Settings.save(); dot.style.background = t.color;
          }
        });
        const emoji = h("button", {
          type: "button", class: "team-emoji", "aria-label": "החלף אימוג׳י",
          onclick: () => {
            const e = Settings.TEAM_EMOJIS;
            t.emoji = e[(e.indexOf(t.emoji) + 1) % e.length];
            Settings.save(); emoji.textContent = t.emoji;
          }
        }, t.emoji);
        const input = h("input", {
          type: "text", maxlength: "20", value: t.name, "aria-label": `שם קבוצה ${i + 1}`,
          oninput: () => { t.name = input.value; Settings.save(); },
          onblur: () => { if (!input.value.trim()) { t.name = Settings.defaultTeam(i).name; input.value = t.name; Settings.save(); } }
        });
        list.append(h("div", { class: "team-row" }, dot, emoji, input));
      });
      fill(secs.teams, 
        h("h2", {}, "קבוצות"),
        stepper("teams", "מספר קבוצות", { min: 2, max: 8 }, null),
        list,
        h("p", { class: "hint" }, "לחצו על העיגול או על האימוג׳י כדי להחליף צבע ודמות."));
      // מספר הקבוצות הוא אורך המערך, לכן הכפתורים מטופלים בנפרד
      const row = secs.teams.querySelector(".stepper");
      const valueEl = row.querySelector(".stepper-value");
      valueEl.textContent = String(s.teams.length);
      const [minus, , plus] = row.children;
      minus.onclick = () => resizeTeams(-1);
      plus.onclick = () => resizeTeams(1);
    }

    function resizeTeams(delta) {
      const s = Settings.get();
      const [min, max] = Settings.LIMITS.teams;
      const n = Math.min(max, Math.max(min, s.teams.length + delta));
      while (s.teams.length < n) s.teams.push(Settings.defaultTeam(s.teams.length));
      s.teams.length = n;
      Settings.save();
      drawTeams();
    }

    function drawRules() {
      const s = Settings.get();
      const m = mode();
      fill(secs.rules, 
        h("h2", {}, "חוקי המשחק"),
        stepper("turnSeconds", "זמן לתור", { min: 15, max: 180, step: 5, suffix: " שנ׳" }),
        segmented("goalType", "המשחק נגמר ב…", [["points", "הגעה ליעד נקודות"], ["rounds", "מספר סיבובים"]], drawRules),
        s.goalType === "points"
          ? stepper("goalPoints", "יעד נקודות", { min: 5, max: 200, step: 5 })
          : stepper("goalRounds", "מספר סיבובים", { min: 1, max: 20 }),
        stepper("skipPenalty", "קנס על דילוג", { min: 0, max: 5, format: (v) => (v ? "−" + v : "ללא") }),
        m.actions.includes("buzz") && stepper("buzzPenalty", "קנס על מילה אסורה", { min: 0, max: 5, format: (v) => (v ? "−" + v : "ללא") }),
        segmented("lastWord", "מילה שהוצגה כשהזמן נגמר", [["count", "נספרת כנכונה"], ["ignore", "לא נספרת"]]),
        toggle("fairRound", "סיבוב הוגן", "המשחק מסתיים רק אחרי שכל הקבוצות שיחקו מספר תורות שווה"));
    }

    function drawWords() {
      const s = Settings.get();
      const bank = mode().bank();
      const items = bank.items();
      const cats = bank.categories();
      const available = items.filter((it) => s.levels.includes(it.level) && !s.disabledCategories.includes(it.category));
      const count = new Set(available.map((it) => it.word)).size;
      fill(secs.words, 
        h("h2", {}, "מילים"),
        h("div", { class: "row stack" },
          h("span", { class: "row-label" }, "רמה (אפשר לבחור כמה)"),
          h("div", { class: "chips" }, LEVELS.map((l) => chip(l.label, s.levels.includes(l.id), () => {
            const i = s.levels.indexOf(l.id);
            if (i >= 0 && s.levels.length > 1) s.levels.splice(i, 1);
            else if (i < 0) s.levels.push(l.id);
            Settings.save(); drawWords();
          }, l.emoji + " ")))),
        h("div", { class: "row stack" },
          h("span", { class: "row-label" }, "קטגוריות"),
          h("div", { class: "chips" }, cats.map((c) => chip(c, !s.disabledCategories.includes(c), () => {
            const i = s.disabledCategories.indexOf(c);
            if (i >= 0) s.disabledCategories.splice(i, 1);
            else if (cats.length - s.disabledCategories.length > 1) s.disabledCategories.push(c);
            Settings.save(); drawWords();
          })))),
        h("p", { class: count < 30 ? "hint warn" : "hint" }, `${count} מילים זמינות לפי הבחירה`),
        h("button", { type: "button", class: "secondary", onclick: openWordsEditor }, "✏️ עריכת מאגר המילים"));
    }

    function drawExtras() {
      fill(secs.extras, 
        h("h2", {}, "חוויה"),
        toggle("sound", "צלילים"),
        toggle("vibrate", "רטט"),
        toggle("keepAwake", "השאר את המסך דלוק בזמן תור"),
        stepper("warnSeconds", "אזהרת זמן בשניות האחרונות", { min: 0, max: 60, step: 5, format: (v) => (v ? v + " שנ׳" : "כבויה") }));
    }

    drawHead(); drawTeams(); drawRules(); drawWords(); drawExtras();
    root.append(
      secs.head, secs.teams, secs.rules, secs.words, secs.extras,
      h("div", { class: "actions" },
        h("button", { type: "button", class: "primary big", onclick: startGame }, "התחל משחק ▶"),
        h("button", { type: "button", class: "ghost", onclick: () => {
          if (confirm("לאפס את כל ההגדרות לברירות המחדל? (מאגר המילים לא יושפע)")) { Settings.reset(); renderSetup(); toast("ההגדרות אופסו"); }
        } }, "איפוס להגדרות ברירת מחדל")),
      h("p", { class: "hint center" }, "ההגדרות נשמרות אוטומטית במכשיר הזה."));
    document.title = mode().title;
  }

  /* ---------- משחק ---------- */
  let game = null;
  let turn = null;

  function startGame() {
    const s = Settings.get();
    const m = mode();
    const pool = m.bank().items().filter((it) => s.levels.includes(it.level) && !s.disabledCategories.includes(it.category));
    if (pool.length < 10) { toast("יש פחות מדי מילים - בחרו עוד רמות או קטגוריות"); return; }
    s.teams.forEach((t, i) => { if (!t.name.trim()) t.name = Settings.defaultTeam(i).name; });
    Settings.save();
    Sound.init();
    game = Engine.create(s, m, m.bank().deck(pool));
    renderReady();
  }

  function scoreboard(g, highlight) {
    const max = Math.max(1, ...g.teams.map((t) => t.score));
    return h("div", { class: "scoreboard" }, g.teams.map((t, i) => h("div", {
      class: "score-row" + (i === highlight ? " active" : ""), style: `--team:${t.color}`
    },
      h("span", { class: "score-name" }, t.emoji + " " + t.name),
      h("span", { class: "score-bar" }, h("i", { style: `width:${Math.max(0, t.score) / max * 100}%` })),
      h("b", { class: "score-num" }, t.score))));
  }

  function goalText(g) {
    const s = g.settings;
    return s.goalType === "points" ? `יעד: ${s.goalPoints} נקודות` : `סיבוב ${Math.min(Engine.round(g), s.goalRounds)} מתוך ${s.goalRounds}`;
  }

  function renderReady() {
    const g = game;
    const idx = Engine.teamIndex(g);
    const t = g.teams[idx];
    fill($("readyScreen"), 
      h("div", { class: "ready-card", style: `--team:${t.color}` },
        h("div", { class: "ready-emoji" }, t.emoji),
        h("div", { class: "eyebrow" }, `סיבוב ${Engine.round(g)}`),
        h("h2", {}, `תור של ${t.name}`),
        h("p", {}, "מי מסביר? העבירו אליו את הטלפון, והשאר מנחשים."),
        g.overtime && h("div", { class: "badge" }, "תיקו! ממשיכים לסיבוב נוסף")),
      h("button", { type: "button", class: "primary big", onclick: () => { Sound.init(); startTurn(); } }, "התחל תור ▶"),
      h("div", { class: "card" }, h("h2", {}, "ניקוד"), scoreboard(g, idx), h("p", { class: "hint center" }, goalText(g))),
      h("button", { type: "button", class: "ghost", onclick: quitGame }, "יציאה מהמשחק"));
    show("ready");
  }

  function quitGame() {
    if (confirm("לצאת מהמשחק? ההתקדמות תאבד.")) { stopTimer(); keepAwake(false); game = null; renderSetup(); show("setup"); }
  }

  /* ---------- תור ---------- */
  let timer = null;
  const RING = 2 * Math.PI * 54;

  function stopTimer() { clearInterval(timer); timer = null; }

  function startTurn() {
    const g = game;
    const total = g.settings.turnSeconds;
    turn = { entries: [], word: g.deck.draw(), total, endAt: Date.now() + total * 1000, pausedLeft: null, lastTick: null, fresh: true };
    keepAwake(true);
    renderPlay();
    show("play");
    timer = setInterval(tickTimer, 100);
  }

  const timeLeft = () => (turn.pausedLeft != null ? turn.pausedLeft : Math.max(0, turn.endAt - Date.now()));

  function tickTimer() {
    if (!turn || turn.pausedLeft != null) return;
    const left = timeLeft();
    paintTimer(left);
    const secs = Math.ceil(left / 1000);
    const warn = Math.min(game.settings.warnSeconds, game.settings.turnSeconds - 1);
    if (secs !== turn.lastTick) {
      turn.lastTick = secs;
      if (warn && secs <= 5 && secs > 0) { Sound.tick(); vibrate(30); }
    }
    if (left <= 0) timeUp();
  }

  function paintTimer(left) {
    const secs = Math.ceil(left / 1000);
    const warn = Math.min(game.settings.warnSeconds, game.settings.turnSeconds - 1);
    const num = $("timerNum");
    if (!num) return;
    num.textContent = secs;
    $("timerArc").style.strokeDashoffset = String(RING * (1 - left / (turn.total * 1000)));
    const box = $("timerBox");
    box.classList.toggle("warn", warn > 0 && secs <= warn && secs > 10);
    box.classList.toggle("danger", warn > 0 && secs <= Math.min(10, warn));
  }

  function renderPlay() {
    const g = game;
    const m = g.mode;
    const t = g.teams[Engine.teamIndex(g)];
    const root = $("playScreen");
    const turnScore = Engine.scoreOf(turn.entries, g.settings);
    const word = turn.word;
    fill(root, 
      h("div", { class: "play-top", style: `--team:${t.color}` },
        h("span", { class: "team-pill" }, t.emoji + " " + t.name),
        h("span", { class: "turn-score", id: "turnScore" }, `${turnScore} נק׳`),
        h("button", { type: "button", class: "icon-btn", "aria-label": "השהיה", onclick: pauseTurn }, "⏸")),
      h("div", { class: "timer", id: "timerBox" },
        h("svg", { viewBox: "0 0 120 120", "aria-hidden": "true" },
          h("circle", { cx: "60", cy: "60", r: "54", class: "ring-bg" }),
          h("circle", { cx: "60", cy: "60", r: "54", class: "ring-arc", id: "timerArc", "stroke-dasharray": String(RING) })),
        h("span", { id: "timerNum" }, Math.ceil(turn.total))),
      h("div", { class: "word-card" + (turn.fresh ? " flip" : ""), id: "wordCard" },
        h("div", { class: "word-text" }, word ? word.word : "—"),
        m.showForbidden && word && word.forbidden.length > 0 && h("ul", { class: "forbidden" }, word.forbidden.map((f) => h("li", {}, f)))),
      h("div", { class: "play-actions" },
        m.actions.includes("skip") && h("button", { type: "button", class: "act skip", onclick: () => answer("skip") }, "דלג", g.settings.skipPenalty ? h("small", {}, `−${g.settings.skipPenalty}`) : null),
        m.actions.includes("buzz") && h("button", { type: "button", class: "act buzz", onclick: () => answer("buzz") }, "אסור!", g.settings.buzzPenalty ? h("small", {}, `−${g.settings.buzzPenalty}`) : null),
        m.actions.includes("correct") && h("button", { type: "button", class: "act ok", onclick: () => answer("correct") }, "נכון ✓", h("small", {}, "+1"))));
    paintTimer(timeLeft());
    turn.fresh = false;
  }

  function answer(status) {
    if (!turn || turn.pausedLeft != null) return;
    turn.entries.push({ item: turn.word, status });
    Sound[status] && Sound[status]();
    vibrate(status === "correct" ? 20 : [30, 40, 30]);
    turn.word = game.deck.draw();
    turn.fresh = true;
    renderPlay();
  }

  function pauseTurn() {
    turn.pausedLeft = timeLeft();
    const overlay = h("div", { class: "overlay", id: "pauseOverlay" },
      h("div", { class: "overlay-card" },
        h("h2", {}, "⏸ מושהה"),
        h("button", { type: "button", class: "primary", onclick: resumeTurn }, "המשך"),
        h("button", { type: "button", class: "secondary", onclick: () => { closePause(); finishPlay(false); } }, "סיים את התור עכשיו"),
        h("button", { type: "button", class: "ghost", onclick: () => { closePause(); quitGame(); } }, "יציאה מהמשחק")));
    $("playScreen").append(overlay);
  }

  function closePause() { const o = $("pauseOverlay"); if (o) o.remove(); }

  function resumeTurn() {
    turn.endAt = Date.now() + turn.pausedLeft;
    turn.pausedLeft = null;
    closePause();
  }

  function timeUp() {
    stopTimer();
    Sound.end();
    vibrate([200, 100, 200]);
    finishPlay(true);
  }

  /* מעבר מהמשחק לסיכום; במקרה של תום זמן המילה האחרונה נכנסת לפי ההגדרה */
  function finishPlay(timedOut) {
    stopTimer();
    keepAwake(false);
    if (turn.word) {
      const counts = game.settings.lastWord === "count" && timedOut;
      turn.entries.push({ item: turn.word, status: counts ? "correct" : "none", last: true });
      turn.word = null;
    }
    renderSummary();
    show("summary");
  }

  /* ---------- סיכום תור ---------- */
  function renderSummary() {
    const g = game;
    const t = g.teams[Engine.teamIndex(g)];
    const allowed = [...g.mode.actions, "none"];
    const total = h("b", { id: "sumTotal" });
    const paintTotal = () => { total.textContent = Engine.scoreOf(turn.entries, g.settings); };
    const list = h("div", { class: "summary-list" });
    if (!turn.entries.length) list.append(h("p", { class: "hint center" }, "לא הוצגו מילים בתור הזה."));
    turn.entries.forEach((e) => {
      const btn = h("button", {
        type: "button", class: "status s-" + e.status,
        onclick: () => {
          e.status = allowed[(allowed.indexOf(e.status) + 1) % allowed.length];
          btn.className = "status s-" + e.status;
          btn.textContent = Engine.STATUSES[e.status];
          paintTotal();
        }
      }, Engine.STATUSES[e.status]);
      list.append(h("div", { class: "summary-row" },
        h("span", { class: "summary-word" }, e.item.word, e.last && h("small", {}, " (המילה האחרונה)")), btn));
    });
    paintTotal();
    fill($("summaryScreen"), 
      h("div", { class: "hero compact", style: `--team:${t.color}` },
        h("div", { class: "logo" }, t.emoji),
        h("h2", {}, `סיכום התור של ${t.name}`),
        h("p", {}, "אפשר ללחוץ על סטטוס כדי לתקן אותו.")),
      h("div", { class: "card" }, list),
      h("div", { class: "total-bar" }, "סה״כ לתור: ", total, " נק׳"),
      h("button", { type: "button", class: "primary big", onclick: confirmTurn }, "אישור והמשך"));
  }

  function confirmTurn() {
    const result = Engine.finishTurn(game, turn.entries);
    turn = null;
    if (result.over) renderEnd(result.winner);
    else renderReady();
  }

  /* ---------- סיום ---------- */
  function confetti(parent) {
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899"];
    const box = h("div", { class: "confetti", "aria-hidden": "true" });
    for (let i = 0; i < 70; i++) {
      box.append(h("i", { style: `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 1.5}s;animation-duration:${2.5 + Math.random() * 2}s` }));
    }
    parent.append(box);
  }

  function renderEnd(winnerIdx) {
    const g = game;
    const w = g.teams[winnerIdx];
    const root = $("endScreen");
    fill(root, 
      h("div", { class: "winner-card", style: `--team:${w.color}` },
        h("div", { class: "trophy" }, "🏆"),
        h("div", { class: "ready-emoji" }, w.emoji),
        h("h2", {}, `${w.name} ניצחו!`),
        h("p", {}, `${w.score} נקודות`)),
      h("div", { class: "card" }, h("h2", {}, "תוצאות סופיות"),
        h("div", { class: "scoreboard" }, Engine.ranking(g).map((t, i) => h("div", { class: "score-row", style: `--team:${t.color}` },
          h("span", { class: "score-name" }, (["🥇", "🥈", "🥉"][i] || "") + " " + t.emoji + " " + t.name),
          h("b", { class: "score-num" }, t.score))))),
      h("div", { class: "actions" },
        h("button", { type: "button", class: "primary big", onclick: () => {
          const s = Settings.get(); const m = g.mode;
          const pool = m.bank().items().filter((it) => s.levels.includes(it.level) && !s.disabledCategories.includes(it.category));
          game = Engine.create(s, m, m.bank().deck(pool));
          renderReady();
        } }, "שחקו שוב"),
        h("button", { type: "button", class: "secondary", onclick: () => { game = null; renderSetup(); show("setup"); } }, "חזרה להגדרות")));
    show("end");
    confetti(root);
    Sound.win();
    vibrate([100, 60, 100, 60, 200]);
  }

  /* ---------- עריכת מאגר מילים ---------- */
  const editor = { level: "kids", category: null, search: "" };

  function openWordsEditor() {
    const cats = mode().bank().categories();
    if (!editor.category || !cats.includes(editor.category)) editor.category = cats[0];
    renderWordsEditor();
    show("words");
  }

  function renderWordsEditor() {
    const m = mode();
    const bank = m.bank();
    const cats = bank.categories();
    const all = bank.items();
    const root = $("wordsScreen");

    const listBox = h("div", { class: "word-list" });
    const drawList = () => {
      const q = editor.search.trim();
      const shown = all.filter((it) => it.level === editor.level && (q ? it.word.includes(q) : it.category === editor.category));
      fill(listBox, 
        shown.length === 0 && h("p", { class: "hint center" }, "אין מילים להצגה."),
        shown.map((it) => h("div", { class: "word-item" },
          h("span", {}, it.word, it.forbidden.length > 0 && h("small", {}, " ‏🚫 " + it.forbidden.join(", ")), it.custom && h("em", {}, "שלי")),
          h("button", { type: "button", class: "icon-btn danger", "aria-label": "מחק " + it.word, onclick: () => {
            bank.remove(it); renderWordsEditor(); toast("נמחקה: " + it.word);
          } }, "✕"))));
    };

    const area = h("textarea", {
      rows: "4", placeholder: m.showForbidden ? "מילה אחת בכל שורה (או מופרדות בפסיק)\nבפורמט: מילה | אסורה1, אסורה2" : "מילה אחת בכל שורה (או מופרדות בפסיק)"
    });
    const search = h("input", { type: "search", placeholder: "חיפוש ברמה הנוכחית…", value: editor.search, oninput: () => { editor.search = search.value; drawList(); } });
    const fileInput = h("input", { type: "file", accept: "application/json,.json", class: "hidden", onchange: async () => {
      const f = fileInput.files[0];
      if (!f) return;
      try { const n = bank.importJson(await f.text()); toast(`יובאו ${n} מילים`); renderWordsEditor(); }
      catch (e) { toast("הקובץ לא תקין"); }
    } });

    const addWords = () => {
      // בטאבו הפסיק מפריד בין מילים אסורות, לכן שם מפצלים רק לפי שורות
      const raw = area.value.split("\n").flatMap((l) => (m.showForbidden ? [l] : l.split(","))).map((l) => l.trim()).filter(Boolean);
      if (!raw.length) return;
      const n = bank.add(editor.level, editor.category, raw);
      area.value = "";
      toast(n ? `נוספו ${n} מילים` : "המילים כבר קיימות");
      renderWordsEditor();
    };

    const user = bank.userSummary();
    fill(root, 
      h("div", { class: "topbar" },
        h("button", { type: "button", class: "ghost", onclick: () => { renderSetup(); show("setup"); } }, "→ חזרה"),
        h("h2", {}, "מאגר המילים — " + m.title)),
      h("div", { class: "card" },
        h("div", { class: "segmented" }, LEVELS.map((l) => h("button", {
          type: "button", class: l.id === editor.level ? "on" : "", onclick: () => { editor.level = l.id; renderWordsEditor(); }
        }, l.emoji + " " + l.label))),
        h("div", { class: "chips" }, cats.map((c) => chip(c, c === editor.category && !editor.search, () => { editor.category = c; editor.search = ""; renderWordsEditor(); }))),
        search, listBox),
      h("div", { class: "card" },
        h("h2", {}, `הוספה ל״${editor.category}״ (${LEVELS.find((l) => l.id === editor.level).label})`),
        area,
        h("button", { type: "button", class: "primary", onclick: addWords }, "הוסף מילים"),
        h("div", { class: "row stack" }, h("span", { class: "row-label" }, "קטגוריה חדשה"),
          (() => {
            const inp = h("input", { type: "text", maxlength: "24", placeholder: "שם קטגוריה" });
            return h("div", { class: "inline" }, inp, h("button", { type: "button", class: "secondary", onclick: () => {
              const name = inp.value.trim();
              if (!name) return;
              editor.category = name;
              // קטגוריה נוצרת בפועל עם המילה הראשונה שנוספת אליה
              renderWordsEditor();
              toast("כתבו מילים והוסיפו כדי ליצור את הקטגוריה");
            } }, "בחר"));
          })())),
      h("div", { class: "card" },
        h("h2", {}, "גיבוי ושחזור"),
        h("p", { class: "hint" }, `שינויים שלך: ${user.added} מילים שנוספו, ${user.hidden} מילים שהוסתרו. הם נשמרים במכשיר הזה בלבד.`),
        h("div", { class: "inline wrap" },
          h("button", { type: "button", class: "secondary", onclick: () => downloadJson(bank.exportJson(), m.id + "-words.json") }, "⬇ ייצוא"),
          h("button", { type: "button", class: "secondary", onclick: () => fileInput.click() }, "⬆ ייבוא"),
          h("button", { type: "button", class: "ghost danger", onclick: () => {
            if (confirm("למחוק את כל השינויים שלך ולחזור למאגר המקורי?")) { bank.resetToDefaults(); renderWordsEditor(); toast("המאגר שוחזר"); }
          } }, "שחזור מאגר מקורי")),
        fileInput));
    drawList();
  }

  function downloadJson(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = h("a", { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && turn && game && !$("playScreen").classList.contains("hidden")) keepAwake(true);
  });

  renderSetup();
})();
