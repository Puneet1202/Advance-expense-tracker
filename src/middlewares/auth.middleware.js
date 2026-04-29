import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';

export const authMiddleware = async (c, next) => {
    try {
        const token = getCookie(c, 'access_token');
        if (!token) {
            return c.json({ message: "unauthorized: no token provided", status: 401 }, 401);
        }

        console.log("Token:", token.substring(0, 10));
        console.log("Secret available:", !!c.env.ACCESS_TOKEN_SECRET);
        const decoded = await verify(token, c.env.ACCESS_TOKEN_SECRET, 'HS256');
        c.set('user', decoded); // Set user info in context
        await next();
    } catch (error) {
        console.log("Auth error:", error.message || error);
        return c.json({ message: "unauthorized: invalid token", status: 401 }, 401);
    }
}
