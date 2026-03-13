window.PalavroGame = window.PalavroGame || {};

(function registerStorageModule() {
  const { MODE_ORDER, MODES } = window.PalavroGame.constants;
  const STORAGE_KEY = "palavro-diario-state-v1";

  function createEmptyStats() {
    return MODE_ORDER.reduce((stats, modeKey) => {
      stats[modeKey] = {
        played: 0,
        wins: 0,
        currentStreak: 0,
        bestStreak: 0,
        lastResolvedDayKey: null,
      };
      return stats;
    }, {});
  }

  function createDailyProgress(dayKey) {
    return {
      dayKey,
      modes: MODE_ORDER.reduce((collection, modeKey) => {
        collection[modeKey] = {
          guesses: [],
          resolved: false,
        };
        return collection;
      }, {}),
    };
  }

  function sanitizeGuesses(modeKey, guesses) {
    const limit = MODES[modeKey].maxAttempts;

    if (!Array.isArray(guesses)) {
      return [];
    }

    return guesses
      .filter((guess) => typeof guess === "string" && guess.length === 5)
      .slice(0, limit);
  }

  function loadAppState(dayKey) {
    const defaultState = {
      activeMode: "termo",
      stats: createEmptyStats(),
      progress: createDailyProgress(dayKey),
    };

    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (!saved || typeof saved !== "object") {
        return defaultState;
      }

      const progress =
        saved.progress?.dayKey === dayKey
          ? saved.progress
          : createDailyProgress(dayKey);

      MODE_ORDER.forEach((modeKey) => {
        progress.modes[modeKey] = {
          guesses: sanitizeGuesses(modeKey, progress.modes?.[modeKey]?.guesses),
          resolved: Boolean(progress.modes?.[modeKey]?.resolved),
        };
      });

      const safeStats = createEmptyStats();

      MODE_ORDER.forEach((modeKey) => {
        safeStats[modeKey] = {
          ...safeStats[modeKey],
          ...(saved.stats?.[modeKey] || {}),
        };
      });

      return {
        activeMode: MODE_ORDER.includes(saved.activeMode)
          ? saved.activeMode
          : "termo",
        stats: safeStats,
        progress,
      };
    } catch (error) {
      console.warn("Falha ao restaurar o estado salvo:", error);
      return defaultState;
    }
  }

  function saveAppState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function markModeResolved(state, modeKey, dayKey, isWin) {
    const stats = state.stats[modeKey];

    if (!stats || stats.lastResolvedDayKey === dayKey) {
      return;
    }

    stats.played += 1;
    stats.lastResolvedDayKey = dayKey;

    if (isWin) {
      stats.wins += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }

    state.progress.modes[modeKey].resolved = true;
  }

  window.PalavroGame.storage = {
    createDailyProgress,
    loadAppState,
    saveAppState,
    markModeResolved,
  };
})();
