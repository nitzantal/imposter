/* לוגיקת משחק טהורה (בלי DOM ובלי אחסון): תורות, ניקוד ותנאי סיום. משותפת לאליאס ולטאבו. */
WG.Engine = (() => {
  const STATUSES = { correct: "נכון", skip: "דילוג", buzz: "אסור!", none: "לא נספר" };

  function create(settings, mode, deck) {
    return {
      settings: JSON.parse(JSON.stringify(settings)),
      mode,
      deck,
      teams: settings.teams.map((t) => ({ ...t, score: 0 })),
      turn: 0,
      overtime: false
    };
  }

  const teamIndex = (g) => g.turn % g.teams.length;
  const round = (g) => Math.floor(g.turn / g.teams.length) + 1;

  function pointsFor(status, s) {
    if (status === "correct") return 1;
    if (status === "skip") return -s.skipPenalty;
    if (status === "buzz") return -s.buzzPenalty;
    return 0;
  }

  const scoreOf = (entries, s) => entries.reduce((sum, e) => sum + pointsFor(e.status, s), 0);

  function checkEnd(g) {
    const s = g.settings;
    const n = g.teams.length;
    const roundDone = g.turn % n === 0;
    const top = Math.max(...g.teams.map((t) => t.score));
    if (s.goalType === "rounds") {
      if (!roundDone || g.turn / n < s.goalRounds) return null;
    } else {
      if (top < s.goalPoints) return null;
      if (s.fairRound && !roundDone) return null;
    }
    const winners = g.teams.map((t, i) => (t.score === top ? i : -1)).filter((i) => i >= 0);
    return winners.length === 1 ? winners[0] : null;
  }

  /* מסיים תור: מוסיף ניקוד, מקדם לקבוצה הבאה ובודק אם המשחק נגמר */
  function finishTurn(g, entries) {
    g.teams[teamIndex(g)].score += scoreOf(entries, g.settings);
    g.turn += 1;
    const winner = checkEnd(g);
    const reachedLimit = g.settings.goalType === "rounds"
      ? g.turn % g.teams.length === 0 && g.turn / g.teams.length >= g.settings.goalRounds
      : Math.max(...g.teams.map((t) => t.score)) >= g.settings.goalPoints && (!g.settings.fairRound || g.turn % g.teams.length === 0);
    g.overtime = winner === null && reachedLimit;
    return { over: winner !== null, winner };
  }

  const ranking = (g) => g.teams.map((t, i) => ({ ...t, index: i })).sort((a, b) => b.score - a.score);

  return { STATUSES, create, teamIndex, round, pointsFor, scoreOf, finishTurn, ranking };
})();
