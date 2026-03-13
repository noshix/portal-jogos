window.PalavroGame = window.PalavroGame || {};

(function registerUiModule() {
  const { KEYBOARD_ROWS, MODES, MODE_ORDER, WORD_LENGTH } = window.PalavroGame.constants;
  const { formatCountdown, fetchDailyChallenge, fetchAnswerDisplayMap, validateWord } = window.PalavroGame.daily;
  const { buildModeResult } = window.PalavroGame.engine;
  const { loadAppState, markModeResolved, saveAppState } = window.PalavroGame.storage;
  const { normalizeWord } = window.PalavroGame.utils;

  const REVEAL_STEP_MS = 240;
  const REVEAL_TOTAL_MS = REVEAL_STEP_MS * WORD_LENGTH + 220;

  function createApp(root) {
    if (!root) {
      throw new Error("Elemento raiz da aplicacao nao encontrado.");
    }

    let currentDayKey = null;
    let challenge = { termo: [], dueto: [], quarteto: [] };
    let challengeDisplay = { termo: [], dueto: [], quarteto: [] };
    let answerDisplayMap = {};
    let appState = null;
    let currentGuessLetters = Array.from({ length: WORD_LENGTH }, () => "");
    let cursorIndex = 0;
    let toast = "";
    let toastTimeoutId = null;
    let isInstructionsOpen = true;
    let resultModal = null;
    let revealState = null;
    let revealTimeoutId = null;
    let isLoading = true;
    let loadError = "";
    let isCheckingGuess = false;
    let clockOffsetMs = 0;
    let nextChangeEpochMs = null;
    let isRefreshingChallenge = false;
    const validationCache = new Map();

    function resetCurrentGuess() {
      currentGuessLetters = Array.from({ length: WORD_LENGTH }, () => "");
      cursorIndex = 0;
    }

    function getCurrentGuess() {
      return currentGuessLetters.join("");
    }

    function getDisplayWord(word) {
      return answerDisplayMap[word] || word;
    }

    function getOfficialNowMs() {
      return Date.now() + clockOffsetMs;
    }

    function getCountdownMs() {
      if (!nextChangeEpochMs) {
        return 0;
      }

      return Math.max(0, nextChangeEpochMs - getOfficialNowMs());
    }

    function getModeState(modeKey) {
      const mode = MODES[modeKey];
      const guesses = appState.progress.modes[modeKey].guesses;

      return buildModeResult({
        targets: challenge[modeKey],
        guesses,
        maxAttempts: mode.maxAttempts,
      });
    }

    function getActiveModeState() {
      return getModeState(appState.activeMode);
    }

    function isInputLocked() {
      return (
        isLoading ||
        isCheckingGuess ||
        Boolean(revealState) ||
        isInstructionsOpen ||
        Boolean(resultModal)
      );
    }

    function clearRevealTimer() {
      window.clearTimeout(revealTimeoutId);
      revealTimeoutId = null;
      revealState = null;
    }

    function setToast(message) {
      toast = message;
      render();

      window.clearTimeout(toastTimeoutId);
      toastTimeoutId = window.setTimeout(() => {
        toast = "";
        render();
      }, 2400);
    }

    function resolveModeIfNeeded(modeKey) {
      const result = getModeState(modeKey);
      const modeProgress = appState.progress.modes[modeKey];

      if (result.isComplete && !modeProgress.resolved) {
        markModeResolved(appState, modeKey, currentDayKey, result.isWin);
        saveAppState(appState);
      }
    }

    async function loadChallenge({ showLoading = false, announceNewDay = false } = {}) {
      if (showLoading) {
        isLoading = true;
        loadError = "";
        render();
      }

      const previousDayKey = currentDayKey;

      try {
        const payload = await fetchDailyChallenge();
        if (!Object.keys(answerDisplayMap).length) {
          try {
            answerDisplayMap = await fetchAnswerDisplayMap();
          } catch (mapError) {
            console.warn("Falha ao carregar o mapa acentuado das respostas:", mapError);
            answerDisplayMap = {};
          }
        }

        clockOffsetMs = payload.serverNowEpochMs - Date.now();
        nextChangeEpochMs = payload.nextChangeEpochMs;
        currentDayKey = payload.dayKey;
        challenge = {
          termo: payload.termo,
          dueto: payload.dueto,
          quarteto: payload.quarteto,
        };
        challengeDisplay = {
          termo: payload.termo.map((word) => getDisplayWord(word)),
          dueto: payload.dueto.map((word) => getDisplayWord(word)),
          quarteto: payload.quarteto.map((word) => getDisplayWord(word)),
        };

        if (!appState || previousDayKey !== currentDayKey) {
          appState = loadAppState(currentDayKey);
          resetCurrentGuess();
          resultModal = null;
          clearRevealTimer();

          if (previousDayKey && announceNewDay && previousDayKey !== currentDayKey) {
            setToast("Novo desafio do dia liberado.");
          }
        }

        if (appState) {
          MODE_ORDER.forEach((modeKey) => resolveModeIfNeeded(modeKey));
        }

        isLoading = false;
        loadError = "";
        render();
      } catch (error) {
        console.error(error);
        isLoading = false;
        loadError = window.location.protocol === "file:"
          ? "Abra o projeto pelo servidor local. No Windows, execute iniciar-servidor.bat e depois acesse http://localhost:8080."
          : "Nao foi possivel carregar o desafio oficial. Verifique o backend e tente novamente.";
        render();
      }
    }

    async function syncDayIfNeeded() {
      if (isRefreshingChallenge || !nextChangeEpochMs) {
        return;
      }

      if (getOfficialNowMs() < nextChangeEpochMs) {
        return;
      }

      isRefreshingChallenge = true;

      try {
        await loadChallenge({ announceNewDay: true });
      } finally {
        isRefreshingChallenge = false;
      }
    }

    function switchMode(modeKey) {
      if (!appState || revealState) {
        return;
      }

      appState.activeMode = modeKey;
      resetCurrentGuess();
      resultModal = null;
      saveAppState(appState);
      render();
    }

    function openInstructions() {
      isInstructionsOpen = true;
      render();
    }

    function closeInstructions() {
      isInstructionsOpen = false;
      render();
    }

    function openResultModal(modeKey, modeState) {
      const attemptsUsed = modeState.guessCount;
      const solvedBoards = modeState.boards.filter((board) => board.isSolved);
      const bestSolvedAttempt = solvedBoards.length
        ? Math.max(...solvedBoards.map((board) => board.solvedAt || 0))
        : null;

      resultModal = {
        modeKey,
        isWin: modeState.isWin,
        answers: challengeDisplay[modeKey],
        attemptsUsed,
        bestSolvedAttempt,
        title: modeState.isWin
          ? `${MODES[modeKey].label} concluido`
          : `${MODES[modeKey].label} encerrado`,
        message: modeState.isWin
          ? `Voce resolveu em ${attemptsUsed} tentativa(s).`
          : `Derrota ${String.fromCharCode(0x1F480)} em ${attemptsUsed} tentativa(s).`,
        options: MODE_ORDER.filter((key) => key !== modeKey),
      };
      render();
    }

    function closeResultModal() {
      resultModal = null;
      render();
    }

    function switchModeFromResult(modeKey) {
      resultModal = null;
      switchMode(modeKey);
    }

    function appendLetter(letter) {
      const modeState = getActiveModeState();

      if (modeState.isComplete || isInputLocked()) {
        return;
      }

      currentGuessLetters[cursorIndex] = letter;

      if (cursorIndex < WORD_LENGTH - 1) {
        cursorIndex += 1;
      }

      render();
    }

    function removeLetter() {
      const modeState = getActiveModeState();

      if (modeState.isComplete || isInputLocked()) {
        return;
      }

      if (currentGuessLetters[cursorIndex]) {
        currentGuessLetters[cursorIndex] = "";
      } else {
        const previousIndex = Math.max(0, cursorIndex - 1);
        currentGuessLetters[previousIndex] = "";
        cursorIndex = previousIndex;
      }

      render();
    }

    function clearCurrentCell() {
      const modeState = getActiveModeState();

      if (modeState.isComplete || isInputLocked()) {
        return;
      }

      currentGuessLetters[cursorIndex] = "";
      render();
    }

    function moveCursor(direction) {
      const modeState = getActiveModeState();

      if (modeState.isComplete || isInputLocked()) {
        return;
      }

      cursorIndex = Math.max(0, Math.min(WORD_LENGTH - 1, cursorIndex + direction));
      render();
    }

    function setCursor(nextIndex) {
      const modeState = getActiveModeState();

      if (modeState.isComplete || isInputLocked()) {
        return;
      }

      cursorIndex = Math.max(0, Math.min(WORD_LENGTH - 1, nextIndex));
      render();
    }

    async function checkWordWithBackend(guess) {
      if (validationCache.has(guess)) {
        return validationCache.get(guess);
      }

      const payload = await validateWord(guess);
      const isValid = Boolean(payload.valid);
      validationCache.set(guess, isValid);
      return isValid;
    }

    async function submitGuess() {
      const modeKey = appState.activeMode;
      const modeState = getActiveModeState();

      if (modeState.isComplete) {
        setToast("Esse modo de hoje ja foi resolvido.");
        return;
      }

      if (isInputLocked()) {
        return;
      }

      const currentGuess = getCurrentGuess();

      if (currentGuess.length !== WORD_LENGTH || currentGuessLetters.includes("")) {
        setToast("Digite uma palavra de 5 letras.");
        return;
      }

      const guess = normalizeWord(currentGuess);

      isCheckingGuess = true;
      render();

      try {
        const isValid = await checkWordWithBackend(guess);

        isCheckingGuess = false;

        if (!isValid) {
          render();
          setToast("Palavra nao encontrada no dicionario.");
          return;
        }
      } catch (error) {
        console.error(error);
        isCheckingGuess = false;
        render();
        setToast("Nao foi possivel validar a palavra agora.");
        return;
      }

      const submittedRowIndex = modeState.guessCount;
      appState.progress.modes[modeKey].guesses.push(guess);
      resetCurrentGuess();
      resultModal = null;
      clearRevealTimer();
      revealState = {
        modeKey,
        rowIndex: submittedRowIndex,
      };
      saveAppState(appState);
      render();

      revealTimeoutId = window.setTimeout(() => {
        revealState = null;
        resolveModeIfNeeded(modeKey);

        const nextState = getModeState(modeKey);

        if (nextState.isComplete) {
          if (nextState.isWin) {
            setToast(`Boa! Voce concluiu ${MODES[modeKey].label}.`);
          } else {
            setToast(`Fim de jogo. Respostas: ${challengeDisplay[modeKey].join(", ")}.`);
          }

          openResultModal(modeKey, nextState);
        } else {
          render();
        }

        saveAppState(appState);
      }, REVEAL_TOTAL_MS);
    }

    function handleKeyInput(key) {
      if (isLoading || !appState || isInstructionsOpen || resultModal) {
        return;
      }

      const normalized = normalizeWord(key);

      if (key === "Enter") {
        submitGuess();
        return;
      }

      if (key === "Backspace") {
        removeLetter();
        return;
      }

      if (key === "Delete") {
        clearCurrentCell();
        return;
      }

      if (key === "ArrowLeft") {
        moveCursor(-1);
        return;
      }

      if (key === "ArrowRight") {
        moveCursor(1);
        return;
      }

      if (normalized.length === 1) {
        appendLetter(normalized);
      }
    }

    function renderBoardRows(modeState, boardIndex) {
      const board = modeState.boards[boardIndex];
      const rows = [];

      for (let rowIndex = 0; rowIndex < modeState.maxAttempts; rowIndex += 1) {
        const row = board.rows[rowIndex];
        const isCurrentRow =
          rowIndex === modeState.guessCount &&
          !modeState.isComplete &&
          !revealState &&
          !board.isSolved;
        const letters = row
          ? row.guess.split("")
          : isCurrentRow
            ? currentGuessLetters.map((letter) => letter || " ")
            : Array.from({ length: WORD_LENGTH }, () => " ");
        const statuses = row
          ? row.status
          : Array.from(
              { length: WORD_LENGTH },
              () => (isCurrentRow ? "typing" : ""),
            );
        const isRevealRow =
          Boolean(revealState) &&
          revealState.modeKey === appState.activeMode &&
          revealState.rowIndex === rowIndex &&
          Boolean(row);

        rows.push(`
          <div class="board-row ${isCurrentRow ? "is-editing" : ""}">
            ${letters
              .map(
                (letter, index) => `
                  <button
                    type="button"
                    class="cell ${statuses[index] || ""} ${isCurrentRow && index === cursorIndex ? "active" : ""} ${isRevealRow ? "reveal" : ""}"
                    style="${isRevealRow ? `animation-delay:${index * REVEAL_STEP_MS}ms;` : ""}"
                    ${isCurrentRow ? `data-cursor-index="${index}"` : "disabled"}
                  >
                    ${letter.trim()}
                  </button>
                `,
              )
              .join("")}
          </div>
        `);
      }

      const shouldRevealAnswer = board.isSolved || modeState.isComplete;
      const answerFooter = shouldRevealAnswer
        ? `<div class="board-answer">Resposta: <strong>${getDisplayWord(board.target)}</strong></div>`
        : "";

      return `
        <section class="board-card ${board.isSolved ? "solved" : ""}">
          <div class="board-head">
            <strong>Palavra ${boardIndex + 1}</strong>
            <span>${board.isSolved ? `Travada em ${board.solvedAt}` : "Em aberto"}</span>
          </div>
          <div class="board-grid">
            ${rows.join("")}
          </div>
          ${answerFooter}
        </section>
      `;
    }

    function renderKeyboard(modeState) {
      return KEYBOARD_ROWS.map(
        (row) => `
          <div class="keyboard-row">
            ${row
              .map((key) => {
                const display =
                  key === "BACKSPACE" ? "Apagar" : key === "ENTER" ? "Enter" : key;
                const status =
                  key.length === 1 ? modeState.keyboard[key] || "" : "action";

                return `
                  <button class="key ${status}" data-key="${key}" type="button">
                    ${display}
                  </button>
                `;
              })
              .join("")}
          </div>
        `,
      ).join("");
    }

    function renderInstructionsModal() {
      if (!isInstructionsOpen) {
        return "";
      }

      return `
        <div class="modal-backdrop" data-close-modal="true">
          <section class="modal" role="dialog" aria-modal="true" aria-labelledby="instructions-title">
            <div class="modal-head">
              <div>
                <p class="modal-kicker">Como jogar</p>
                <h2 id="instructions-title">Regras do desafio oficial</h2>
              </div>
              <button type="button" class="icon-button" data-close-button="true" aria-label="Fechar">
                X
              </button>
            </div>
            <div class="modal-body">
              <p>Descubra palavras brasileiras de 5 letras.</p>
              <p>No Palavro voce tem 6 tentativas. No Duplo, 7. No Quadruplo, 9.</p>
              <p>No Duplo e no Quadruplo, o mesmo palpite vale para todos os quadros.</p>
              <p>Use as setas do teclado ou clique nos quadradinhos para mover o cursor entre as letras.</p>
              <p>As palavras do dia e o horario de troca sao definidos pelo servidor no horario oficial de Brasilia.</p>
              <p>Verde indica letra certa no lugar certo. Amarelo indica letra presente em outra posicao. Cinza indica letra ausente.</p>
            </div>
            <div class="modal-actions">
              <button type="button" class="primary-button" data-close-button="true">Comecar</button>
            </div>
          </section>
        </div>
      `;
    }

    function renderResultModal() {
      if (!resultModal) {
        return "";
      }

      return `
        <div class="modal-backdrop" data-close-result-modal="true">
          <section class="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div class="modal-head">
              <div>
                <p class="modal-kicker">${resultModal.isWin ? "Modo concluido" : "Fim do modo"}</p>
                <h2 id="result-title">${resultModal.title}</h2>
              </div>
              <button type="button" class="icon-button" data-close-result-button="true" aria-label="Fechar">
                X
              </button>
            </div>
            <div class="modal-body">
              <div class="result-summary ${resultModal.isWin ? "win" : "loss"}">
                <strong>${resultModal.isWin ? "Vitoria" : `Derrota ${String.fromCharCode(0x1F480)}`}</strong>
                <span>${resultModal.message}</span>
              </div>
              <div class="answer-list">
                ${resultModal.answers
                  .map(
                    (answer, index) => `
                      <div class="answer-chip">
                        <span>Palavra ${index + 1}</span>
                        <strong>${answer}</strong>
                      </div>
                    `,
                  )
                  .join("")}
              </div>
            </div>
            <div class="modal-actions result-actions">
              ${resultModal.options
                .map(
                  (modeKey) => `
                    <button type="button" class="ghost-button" data-result-mode="${modeKey}">
                      Ir para ${MODES[modeKey].label}
                    </button>
                  `,
                )
                .join("")}
              <button type="button" class="primary-button" data-close-result-button="true">Fechar</button>
            </div>
          </section>
        </div>
      `;
    }

    function renderLoading() {
      root.innerHTML = `
        <main class="shell">
          <section class="play-area loading-state">
            <h1>Carregando desafio oficial...</h1>
            <p>Aguarde enquanto o servidor entrega a palavra do dia no horario de Brasilia.</p>
          </section>
        </main>
      `;
    }

    function renderError() {
      root.innerHTML = `
        <main class="shell">
          <section class="play-area error-state">
            <h1>Backend indisponivel</h1>
            <p>${loadError}</p>
            <button type="button" class="primary-button" data-retry-load="true">Tentar novamente</button>
          </section>
        </main>
      `;

      const retryButton = root.querySelector("[data-retry-load]");

      if (retryButton) {
        retryButton.addEventListener("click", () => {
          loadChallenge({ showLoading: true });
        });
      }
    }

    function render() {
      if (loadError) {
        renderError();
        return;
      }

      if (isLoading || !appState) {
        renderLoading();
        return;
      }

      const modeKey = appState.activeMode;
      const mode = MODES[modeKey];
      const modeState = getModeState(modeKey);
      const statusText = isCheckingGuess
        ? "Validando..."
        : modeState.isComplete
          ? modeState.isWin
            ? "Desafio concluido."
            : "Tentativas esgotadas."
          : `${modeState.remainingAttempts} chance(s) restante(s).`;

      root.innerHTML = `
        <main class="shell">
          <section class="mode-switcher">
            ${MODE_ORDER.map(
              (key) => `
                <button
                  type="button"
                  class="mode-tab ${key === modeKey ? "active" : ""}"
                  data-mode="${key}"
                  ${revealState ? "disabled" : ""}
                >
                  <strong>${MODES[key].label}</strong>
                  <span>${MODES[key].maxAttempts} tentativas</span>
                </button>
              `,
            ).join("")}
          </section>

          <section class="play-area">
            <div class="mode-summary">
              <div class="mode-heading">
                <p class="mode-kicker">${mode.label}</p>
                <button type="button" class="inline-help-button" data-open-help="true" aria-label="Abrir instrucoes">
                  ?
                </button>
              </div>
              <div class="summary-badges">
                <span class="chip">Tentativas: ${modeState.guessCount}/${mode.maxAttempts}</span>
                <span class="chip">${statusText}</span>
              </div>
            </div>

            <div class="boards boards-${mode.boardCount}">
              ${challenge[modeKey]
                .map((_, index) => renderBoardRows(modeState, index))
                .join("")}
            </div>

            <section class="keyboard-panel">
              <div class="keyboard">
                ${renderKeyboard(modeState)}
              </div>
            </section>
          </section>

          <div class="toast ${toast ? "visible" : ""}">
            ${toast}
          </div>

          ${renderInstructionsModal()}
          ${renderResultModal()}
        </main>
      `;

      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => switchMode(button.dataset.mode));
      });

      root.querySelectorAll("[data-open-help]").forEach((button) => {
        button.addEventListener("click", openInstructions);
      });

      root.querySelectorAll("[data-close-button]").forEach((button) => {
        button.addEventListener("click", closeInstructions);
      });

      root.querySelectorAll("[data-close-modal]").forEach((element) => {
        element.addEventListener("click", (event) => {
          if (event.target === element) {
            closeInstructions();
          }
        });
      });

      root.querySelectorAll("[data-close-result-button]").forEach((button) => {
        button.addEventListener("click", closeResultModal);
      });

      root.querySelectorAll("[data-close-result-modal]").forEach((element) => {
        element.addEventListener("click", (event) => {
          if (event.target === element) {
            closeResultModal();
          }
        });
      });

      root.querySelectorAll("[data-result-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          switchModeFromResult(button.dataset.resultMode);
        });
      });

      root.querySelectorAll("[data-key]").forEach((button) => {
        button.addEventListener("click", () => {
          if (isInputLocked()) {
            return;
          }

          const key = button.dataset.key;

          if (key === "ENTER") {
            submitGuess();
            return;
          }

          if (key === "BACKSPACE") {
            removeLetter();
            return;
          }

          appendLetter(key);
        });
      });

      root.querySelectorAll("[data-cursor-index]").forEach((button) => {
        button.addEventListener("click", () => {
          setCursor(Number(button.dataset.cursorIndex));
        });
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isInstructionsOpen) {
        closeInstructions();
        return;
      }

      if (event.key === "Escape" && resultModal) {
        closeResultModal();
        return;
      }

      const isLetter = /^[a-zA-Z]$/.test(event.key);
      const isControl =
        event.key === "Enter" ||
        event.key === "Backspace" ||
        event.key === "Delete" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight";

      if (!isLetter && !isControl) {
        return;
      }

      event.preventDefault();
      handleKeyInput(event.key);
    });

    window.setInterval(() => {
      syncDayIfNeeded();

      if (!revealState && !isLoading && !loadError) {
        render();
      }
    }, 1000);

    loadChallenge({ showLoading: true });
  }

  window.PalavroGame.ui = {
    createApp,
  };
})();
