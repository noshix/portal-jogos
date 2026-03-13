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
      let solvedAt = null;
      const rows = guesses.map((guess, guessIndex) => {
        if (solvedAt !== null) {
          return null;
        }

        const row = {
          guess,
          status: evaluateGuess(guess, target),
          isExactMatch: guess === target,
        };

        if (row.isExactMatch) {
          solvedAt = guessIndex + 1;
        }

        return row;
      });

      return {
        target,
        rows,
        solvedAt,
        isSolved: solvedAt !== null,
      };
    });

    const keyboard = {};

    boards.forEach((board) => {
      board.rows.forEach((row) => {
        if (!row) {
          return;
        }

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
