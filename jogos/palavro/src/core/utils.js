window.PalavroGame = window.PalavroGame || {};
window.PalavroGame.utils = {
  normalizeWord(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase();
  },

  padNumber(value) {
    return String(value).padStart(2, "0");
  },

  xmur3(seed) {
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
  },

  mulberry32(seed) {
    return function next() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  shuffleWithSeed(list, seedLabel) {
    const seedFactory = window.PalavroGame.utils.xmur3(seedLabel);
    const random = window.PalavroGame.utils.mulberry32(seedFactory());
    const copy = [...list];

    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }

    return copy;
  },
};
