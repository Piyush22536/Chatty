import express from "express";
import { checkAuth, login, logout, signup, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { tokenBucketLimiter } from "../middleware/tokenBucket.middleware.js";
const router = express.Router();

router.post("/signup", tokenBucketLimiter, signup);
router.post("/login", tokenBucketLimiter, login);
router.post("/logout", logout);

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, checkAuth);

export default router;