const { getDailyChallenge } = require("./_shared/game-service");

exports.handler = async function handler() {
  try {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify(getDailyChallenge()),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        error: "challenge_unavailable",
        message: error.message,
      }),
    };
  }
};
