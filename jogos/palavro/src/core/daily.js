window.PalavroGame = window.PalavroGame || {};

(function registerDailyModule() {
  const { padNumber } = window.PalavroGame.utils;

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao carregar ${url}`);
    }

    return response.json();
  }

  window.PalavroGame.daily = {
    formatCountdown(msRemaining) {
      const totalSeconds = Math.max(0, Math.floor(msRemaining / 1000));
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(seconds)}`;
    },

    fetchDailyChallenge() {
      return fetchJson("/api/daily-challenge");
    },

    fetchAnswerDisplayMap() {
      return fetchJson("./data/answer-display.json");
    },

    validateWord(guess) {
      const query = new URLSearchParams({ guess }).toString();
      return fetchJson(`/api/validate-word?${query}`);
    },
  };
})();
