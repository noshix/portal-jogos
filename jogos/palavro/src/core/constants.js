window.PalavroGame = window.PalavroGame || {};
window.PalavroGame.constants = {
  WORD_LENGTH: 5,
  DAILY_WORDS_PER_SET: 7,
  MODES: {
  termo: {
    key: "termo",
    label: "Palavro",
    boardCount: 1,
    maxAttempts: 6,
    description: "1 palavra, 6 chances.",
  },
  dueto: {
    key: "dueto",
    label: "Duplo",
    boardCount: 2,
    maxAttempts: 7,
    description: "2 palavras, 7 chances.",
  },
  quarteto: {
    key: "quarteto",
    label: "Quadruplo",
    boardCount: 4,
    maxAttempts: 9,
    description: "4 palavras, 9 chances.",
  },
  },
  MODE_ORDER: ["termo", "dueto", "quarteto"],
  KEYBOARD_ROWS: [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ],
  STATUS_PRIORITY: {
    absent: 0,
    present: 1,
    correct: 2,
  },
};
