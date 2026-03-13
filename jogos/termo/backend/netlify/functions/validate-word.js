const { isAcceptedWord, normalizeWord } = require("./_shared/game-service");

exports.handler = async function handler(event) {
  const guess = normalizeWord(event.queryStringParameters?.guess || "");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: JSON.stringify({
      guess,
      valid: isAcceptedWord(guess),
    }),
  };
};
