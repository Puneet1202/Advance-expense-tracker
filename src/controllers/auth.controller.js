import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';

export const registerController = async (c) => {
    try {
        const { email, name, password } = await c.req.json();
        
        if (!email || !name || !password) {
            return c.json({
                message: "all fields are required",
                status: 400
            }, 400);
        }

        const db = c.env.expense_tracker_db;
        const existingUser = await db.prepare("select * from users where email = ?").bind(email).first();
        
        if (existingUser) {
            return c.json({
                message: "user already exists",
                status: 400
            }, 400);
        }

        // Hash the password securely
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        // Insert new user
        await db.prepare("insert into users (email,name,password) values (?,?,?)")
            .bind(email, name, hashedPassword)
            .run();

        return c.json({
            message: "user registered successfully",
            status: 200
        }, 200);

    } catch (error) {
        console.log(error);
        return c.json({
            message: error.message || "internal server error",
            status: 500
        }, 500);
    }
}

export const loginController = async (c) => {
    try {
        const { email, name, username, password } = await c.req.json();
        
        // Find whichever identifier the user sent (email, name, or username)
        const identifier = email || name || username;

        if (!identifier || !password) {
            return c.json({
                message: "email/username and password are required",
                status: 400
            }, 400);
        }

        const db = c.env.expense_tracker_db;
        const user = await db.prepare("select * from users where email = ? OR name = ?").bind(identifier, identifier).first();

        if (!user) {
            return c.json({
                message: "invalid credentials",
                status: 401
            }, 401);
        }

        // Compare password
        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return c.json({
                message: "invalid credentials",
                status: 401
            }, 401);
        }

        // Generate Access Token (e.g. 7 days for dev)
        const accessToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        }, c.env.ACCESS_TOKEN_SECRET);

        // Generate Refresh Token (e.g. 7 days)
        const refreshToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        }, c.env.REFRESH_TOKEN_SECRET);

        // Set Cookies
        setCookie(c, 'access_token', accessToken, {
            httpOnly: true,
            secure: false, // Set to false for local HTTP development!
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/',
        });

        setCookie(c, 'refresh_token', refreshToken, {
            httpOnly: true,
            secure: false, // Set to false for local HTTP development!
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
            path: '/',
        });

        return c.json({
            message: "login successful",
            user: { id: user.id, name: user.name, email: user.email },
            status: 200
        }, 200);

    } catch (error) {
        console.log(error);
        return c.json({
            message: "internal server error",
            status: 500
        }, 500);
    }
}

// Ye naya controller hai taaki aap directly Postman mein saara data dekh sakein
export const getAllUsers = async (c) => {
    try {
        const db = c.env.expense_tracker_db;
        const users = await db.prepare("select * from users").all();
        return c.json({
            total_users: users.results.length,
            users: users.results,
            status: 200
        }, 200);
    } catch (error) {
        console.log(error);
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
}
