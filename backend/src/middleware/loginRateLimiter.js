import redisClient from "../lib/redis.js";

// 5 attempts per 15 minutes per IP
const MAX_TOKENS = 5;
const REFILL_RATE = MAX_TOKENS / (15 * 60); // tokens per second

export const loginTokenBucketLimiter = async (req, res, next) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;

    const key = `bucket:login:${ip}`;

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

    // refill tokens
    const refill = secondsPassed * REFILL_RATE;
    tokens = Math.min(MAX_TOKENS, tokens + refill);

    if (tokens < 1) {
      return res.status(429).json({
        error: "Too many login attempts. Try again after 15 minutes.",
      });
    }

    // consume 1 token
    tokens -= 1;

    await redisClient.set(
      key,
      JSON.stringify({
        tokens,
        lastRefill: now,
      }),
      { EX: 15 * 60 } // expire after 15 min
    );

    next();
  } catch (error) {
    console.log("Login token bucket limiter error:", error);
    next();
  }
};