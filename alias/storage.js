/* עטיפה בטוחה ל-localStorage: אם הוא חסום (גלישה פרטית) המשחק ממשיך לעבוד בלי שמירה. */
window.WG = window.WG || {};

WG.store = (() => {
  const memory = new Map();

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return memory.has(key) ? memory.get(key) : fallback;
  }

  function set(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function remove(key) {
    memory.delete(key);
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  return { get, set, remove };
})();

WG.LEVELS = [
  { id: "kids", label: "ילדים", emoji: "🧒" },
  { id: "teens", label: "נוער", emoji: "🧑‍🎤" },
  { id: "adults", label: "מבוגרים", emoji: "🧑‍💼" }
];

WG.shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
