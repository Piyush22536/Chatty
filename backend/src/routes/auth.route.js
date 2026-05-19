import express from "express";
import { checkAuth, login, logout, signup, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { tokenBucketLimiter } from "../middleware/rateLimiter.middleware.js";
import { loginTokenBucketLimiter } from "../middleware/loginRateLimiter.js";
const router = express.Router();

router.post("/signup", loginTokenBucketLimiter, signup);
router.post("/login", loginTokenBucketLimiter, login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, checkAuth);

export default router;