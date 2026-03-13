const fs = require("node:fs");
const path = require("node:path");

const WORD_LENGTH = 5;
const DAILY_WORDS_PER_SET = 7;
const BRASILIA_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

let cache = null;

function resolveDataFilePath(filename) {
  const candidates = [
    path.resolve(__dirname, "..", "..", "..", "..", "data", filename),
    path.resolve(__dirname, "..", "..", "..", "data", filename),
    path.resolve(process.cwd(), "jogos", "termo", "data", filename),
    path.resolve(process.cwd(), "data", filename),
  ];

  const match = candidates.find((filePath) => fs.existsSync(filePath));

  if (!match) {
    throw new Error(`Arquivo de dados nao encontrado para ${filename}. Caminhos tentados: ${candidates.join(", ")}`);
  }

  return match;
}

function readJsonFile(filename) {
  const filePath = resolveDataFilePath(filename);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadData() {
  if (!cache) {
    const answers = readJsonFile("answer-words.json");
    const accepted = readJsonFile("accepted-words.json");

    cache = {
      answers,
      acceptedSet: new Set(accepted),
    };
  }

  return cache;
}

function normalizeWord(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

function xmur3(seed) {
  let h = 1779033703 ^ seed.length;

  for (let index = 0; index < seed.length; index += 1) {
    h = Math.imul(h ^ seed.charCodeAt(index), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed(list, seedLabel) {
  const seedFactory = xmur3(seedLabel);
  const random = mulberry32(seedFactory());
  const copy = [...list];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function getBrasiliaDateParts(referenceDate = new Date()) {
  const shifted = new Date(referenceDate.getTime() - BRASILIA_OFFSET_HOURS * 60 * 60 * 1000);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function getBrasiliaDayKey(referenceDate = new Date()) {
  const { year, month, day } = getBrasiliaDateParts(referenceDate);
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
}

function getNextBrasiliaMidnightEpoch(referenceDate = new Date()) {
  const { year, month, day } = getBrasiliaDateParts(referenceDate);
  return Date.UTC(year, month - 1, day + 1, BRASILIA_OFFSET_HOURS, 0, 0, 0);
}

function getDayNumber(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0, 0) / DAY_MS);
}

function getDailyChallenge(referenceDate = new Date()) {
  const { answers } = loadData();
  const availableDaysPerSeason = Math.floor(answers.length / DAILY_WORDS_PER_SET);

  if (availableDaysPerSeason < 1) {
    throw new Error("A lista de respostas precisa ter pelo menos sete palavras.");
  }

  const dayKey = getBrasiliaDayKey(referenceDate);
  const absoluteDay = getDayNumber(dayKey);
  const season = Math.floor(absoluteDay / availableDaysPerSeason);
  const dayInSeason = absoluteDay % availableDaysPerSeason;
  const seasonPool = shuffleWithSeed(answers, `season:${season}`);
  const start = dayInSeason * DAILY_WORDS_PER_SET;
  const selectedWords = seasonPool.slice(start, start + DAILY_WORDS_PER_SET);

  return {
    dayKey,
    serverNowEpochMs: Date.now(),
    nextChangeEpochMs: getNextBrasiliaMidnightEpoch(referenceDate),
    termo: [selectedWords[0]],
    dueto: selectedWords.slice(1, 3),
    quarteto: selectedWords.slice(3, 7),
  };
}

function isAcceptedWord(word) {
  const normalized = normalizeWord(word);

  if (normalized.length !== WORD_LENGTH) {
    return false;
  }

  return loadData().acceptedSet.has(normalized);
}

module.exports = {
  getDailyChallenge,
  isAcceptedWord,
  normalizeWord,
};
