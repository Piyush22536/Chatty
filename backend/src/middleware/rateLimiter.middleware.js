import redisClient from "../lib/redis.js";

//tocken bucket algo: 

const MAX_TOKENS = 10;
const REFILL_RATE = 1; // tokens per second

export const tokenBucketLimiter = async (req, res, next) => {
  try {
    const userId = req.user._id.toString();
    const key = `bucket:${userId}`;

    const bucket = await redisClient.get(key);

    let tokens = MAX_TOKENS;
    let lastRefill = Date.now();

    if (bucket) {
      const data = JSON.parse(bucket);
      tokens = data.tokens;
      lastRefill = data.lastRefill;
    }

    const now = Date.now();
    const secondsPassed = (now - lastRefill) / 1000;

    const refill = Math.floor(secondsPassed * REFILL_RATE);
    tokens = Math.min(MAX_TOKENS, tokens + refill);

    if (tokens <= 0) {
      return res.status(429).json({
        error: "Too many messages. Please wait.",
      });
    }

    tokens -= 1;

    await redisClient.set(
      key,
      JSON.stringify({
        tokens,
        lastRefill: now,
      }),
      { EX: 60 }
    );

    next();
  } catch (error) {
    console.log("Rate limiter error:", error);
    next();
  }
};