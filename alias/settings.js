/* הגדרות המשחק: נשמרות אוטומטית בכל שינוי, ואפשר לאפס לברירות המחדל. */
WG.settings = (() => {
  const KEY = "wordgame.settings.v1";

  const TEAM_NAMES = ["הנמרים", "הכרישים", "הנשרים", "הדובים", "הזאבים", "האריות", "הפנדות", "הדולפינים"];
  const TEAM_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#64748b"];
  const TEAM_EMOJIS = ["🐯", "🦈", "🦅", "🐻", "🐺", "🦁", "🐼", "🐬"];
  const LIMITS = {
    teams: [2, 8], turnSeconds: [15, 180], goalPoints: [5, 200], goalRounds: [1, 20],
    skipPenalty: [0, 5], buzzPenalty: [0, 5], warnSeconds: [0, 60]
  };

  function defaultTeam(i) {
    return { name: TEAM_NAMES[i % TEAM_NAMES.length], color: TEAM_COLORS[i % TEAM_COLORS.length], emoji: TEAM_EMOJIS[i % TEAM_EMOJIS.length] };
  }

  function defaults() {
    return {
      mode: "alias",
      teams: [defaultTeam(0), defaultTeam(1)],
      turnSeconds: 60,
      goalType: "points",
      goalPoints: 30,
      goalRounds: 3,
      skipPenalty: 1,
      buzzPenalty: 1,
      lastWord: "count",
      fairRound: true,
      levels: ["teens", "adults"],
      disabledCategories: [],
      sound: true,
      vibrate: true,
      warnSeconds: 30,
      keepAwake: true
    };
  }

  const clamp = (v, [min, max], fb) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
  };

  function sanitize(raw) {
    const d = defaults();
    const s = Object.assign(d, raw && typeof raw === "object" ? raw : {});
    for (const k of Object.keys(LIMITS)) {
      if (k !== "teams") s[k] = clamp(s[k], LIMITS[k], d[k]);
    }
    s.goalType = s.goalType === "rounds" ? "rounds" : "points";
    s.lastWord = s.lastWord === "ignore" ? "ignore" : "count";
    for (const k of ["fairRound", "sound", "vibrate", "keepAwake"]) s[k] = !!s[k];
    const levelIds = WG.LEVELS.map((l) => l.id);
    s.levels = Array.isArray(s.levels) ? s.levels.filter((l) => levelIds.includes(l)) : [];
    if (!s.levels.length) s.levels = d.levels;
    s.disabledCategories = Array.isArray(s.disabledCategories) ? s.disabledCategories.map(String) : [];
    const teams = Array.isArray(s.teams) ? s.teams.slice(0, LIMITS.teams[1]) : [];
    while (teams.length < LIMITS.teams[0]) teams.push(defaultTeam(teams.length));
    s.teams = teams.map((t, i) => {
      const base = defaultTeam(i);
      return {
        name: String((t && t.name) || base.name).slice(0, 20),
        color: TEAM_COLORS.includes(t && t.color) ? t.color : base.color,
        emoji: TEAM_EMOJIS.includes(t && t.emoji) ? t.emoji : base.emoji
      };
    });
    if (typeof s.mode !== "string") s.mode = d.mode;
    return s;
  }

  let current = sanitize(WG.store.get(KEY, null));

  return {
    LIMITS, TEAM_COLORS, TEAM_EMOJIS, defaultTeam,
    get: () => current,
    save: () => WG.store.set(KEY, current),
    reset: () => { current = sanitize(null); WG.store.set(KEY, current); return current; },
    sanitize
  };
})();
