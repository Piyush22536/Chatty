import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage } from "../controllers/message.controller.js";
<<<<<<< HEAD

=======
import { tokenBucketLimiter } from "../middleware/tokenBucket.middleware.js";
>>>>>>> main
const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

<<<<<<< HEAD
router.post("/send/:id", protectRoute, sendMessage);
=======
router.post("/send/:id", protectRoute, tokenBucketLimiter, sendMessage);
>>>>>>> main

export default router;
