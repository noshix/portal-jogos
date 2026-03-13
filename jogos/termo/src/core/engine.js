window.PalavroGame = window.PalavroGame || {};

(function registerEngineModule() {
  const { STATUS_PRIORITY } = window.PalavroGame.constants;

  function evaluateGuess(guess, target) {
    const result = Array.from({ length: guess.length }, () => "absent");
    const remainingTarget = target.split("");
    const letters = guess.split("");

    for (let index = 0; index < letters.length; index += 1) {
      if (letters[index] === remainingTarget[index]) {
        result[index] = "correct";
        remainingTarget[index] = null;
        letters[index] = null;
      }
    }

    for (let index = 0; index < letters.length; index += 1) {
      if (!letters[index]) {
        continue;
      }

      const presentIndex = remainingTarget.indexOf(letters[index]);

      if (presentIndex >= 0) {
        result[index] = "present";
        remainingTarget[presentIndex] = null;
      }
    }

    return result;
  }

  function buildModeResult({ targets, guesses, maxAttempts }) {
    const boards = targets.map((target) => {
      const rows = guesses.map((guess) => ({
        guess,
        status: evaluateGuess(guess, target),
        isExactMatch: guess === target,
      }));
      const solvedAt = rows.findIndex((row) => row.isExactMatch);

      return {
        target,
        rows,
        solvedAt: solvedAt >= 0 ? solvedAt + 1 : null,
        isSolved: solvedAt >= 0,
      };
    });

    const keyboard = {};

    boards.forEach((board) => {
      board.rows.forEach((row) => {
        row.guess.split("").forEach((letter, index) => {
          const nextStatus = row.status[index];
          const currentStatus = keyboard[letter];

          if (
            !currentStatus ||
            STATUS_PRIORITY[nextStatus] > STATUS_PRIORITY[currentStatus]
          ) {
            keyboard[letter] = nextStatus;
          }
        });
      });
    });

    const isWin = boards.every((board) => board.isSolved);
    const isComplete = isWin || guesses.length >= maxAttempts;

    return {
      boards,
      guesses,
      guessCount: guesses.length,
      maxAttempts,
      isWin,
      isComplete,
      remainingAttempts: Math.max(0, maxAttempts - guesses.length),
      keyboard,
    };
  }

  window.PalavroGame.engine = {
    evaluateGuess,
    buildModeResult,
  };
})();
