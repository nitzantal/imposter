/*
 * מצבי משחק. המנוע והמסכים משותפים; ההבדלים מוגדרים כאן:
 *  - actions: אילו כפתורים מופיעים על הקלף ("correct" | "skip" | "buzz")
 *  - showForbidden: להציג רשימת מילים אסורות על הקלף
 *  - bank: מאגר המילים של המצב
 *
 * להוספת טאבו: לטעון קובץ words-taboo-he.js שמגדיר window.TABOO_WORDS
 * (אותו מבנה, עם { w, f } לכל קלף) - המצב יופיע אוטומטית בהגדרות.
 */
WG.banks = {};
WG.banks.alias = WG.createBank("alias", window.ALIAS_WORDS);
if (window.TABOO_WORDS) WG.banks.tabo = WG.createBank("tabo", window.TABOO_WORDS);

WG.MODES = {
  alias: {
    id: "alias",
    title: "אליאס",
    emoji: "🗣️",
    tagline: "מסבירים בלי להגיד את המילה",
    actions: ["correct", "skip"],
    showForbidden: false,
    bank: () => WG.banks.alias,
    available: () => true
  },
  tabo: {
    id: "tabo",
    title: "טאבו",
    emoji: "🚫",
    tagline: "מסבירים בלי המילים האסורות",
    actions: ["correct", "skip", "buzz"],
    showForbidden: true,
    bank: () => WG.banks.tabo,
    available: () => !!WG.banks.tabo
  }
};

WG.availableModes = () => Object.values(WG.MODES).filter((m) => m.available());
