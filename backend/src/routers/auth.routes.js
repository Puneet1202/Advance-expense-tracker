import { Hono } from "hono";
import { registerController, loginController, getAllUsers } from "../controllers/auth.controller";

const router = new Hono();

router.post('/register', registerController);
router.post('/login', loginController);
router.get('/users', getAllUsers);

export default router;