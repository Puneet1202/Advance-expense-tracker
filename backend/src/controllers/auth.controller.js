// FILE: backend/src/controllers/auth.controller.js
// KAAM: User register, login, aur getAllUsers
//
// CHANGES (D1 → Supabase):
//   - c.env.expense_tracker_db hata diya (D1 tha, ab nahi hai)
//   - getSupabaseClient(c.env) se Supabase client lena shuru kiya
//   - db.prepare().bind().first() → supabase.from().select().eq().maybeSingle()
//   - db.prepare().bind().run()  → supabase.from().insert()
//   - Login mein OR query: email ya name se login —
//     do alag queries karte hain (supabase .or() string mein special chars safe nahi)

import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import { getSupabaseClient } from '../db/supabase.js';

export const registerController = async (c) => {
    try {
        const { email, name, password } = await c.req.json();

        if (!email || !name || !password) {
            return c.json({ message: "all fields are required", status: 400 }, 400);
        }

        // WHY: D1 se Supabase shift — getSupabaseClient() c.env se SUPABASE_URL + KEY leta hai
        const supabase = getSupabaseClient(c.env);

        // Email already exists? — maybeSingle() null deta hai agar nahi mila
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingUser) {
            return c.json({ message: "user already exists", status: 400 }, 400);
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        // Insert karo — error aaye to throw karo
        const { error } = await supabase
            .from('users')
            .insert({ email, name, password: hashedPassword });

        if (error) throw error;

        return c.json({ message: "user registered successfully", status: 200 }, 200);

    } catch (error) {
        console.log(error);
        return c.json({ message: error.message || "internal server error", status: 500 }, 500);
    }
};

export const loginController = async (c) => {
    try {
        const { email, name, username, password } = await c.req.json();

        // Email, name, ya username — jo bhi bheja ho
        const identifier = email || name || username;

        if (!identifier || !password) {
            return c.json({ message: "email/username and password are required", status: 400 }, 400);
        }

        const supabase = getSupabaseClient(c.env);

        // WHY DO QUERIES: Supabase .or() mein raw string hoti hai — agar identifier mein
        // special chars hain (like quotes) to injection ho sakti hai.
        // Safe approach: pehle email se try karo, phir name se.
        let user = null;

        const { data: byEmail } = await supabase
            .from('users')
            .select('*')
            .eq('email', identifier)
            .maybeSingle();

        if (byEmail) {
            user = byEmail;
        } else {
            const { data: byName } = await supabase
                .from('users')
                .select('*')
                .eq('name', identifier)
                .maybeSingle();
            user = byName;
        }

        if (!user) {
            return c.json({ message: "invalid credentials", status: 401 }, 401);
        }

        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return c.json({ message: "invalid credentials", status: 401 }, 401);
        }

        // Access Token — 7 din
        const accessToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }, c.env.ACCESS_TOKEN_SECRET);

        // Refresh Token — 7 din
        const refreshToken = await sign({
            id: user.id,
            name: user.name,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
        }, c.env.REFRESH_TOKEN_SECRET);

        setCookie(c, 'access_token', accessToken, {
            httpOnly: true,
            secure: false, // Local dev ke liye false — production mein true karna
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        });

        setCookie(c, 'refresh_token', refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        });

        return c.json({
            message: "login successful",
            user: { id: user.id, name: user.name, email: user.email },
            status: 200
        }, 200);

    } catch (error) {
        console.log(error);
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};

// Debug route — Supabase se saare users fetch karta hai
export const getAllUsers = async (c) => {
    try {
        const supabase = getSupabaseClient(c.env);

        // WHY: D1 se Supabase — .all() nahi, .select() use karte hain
        const { data: users, error } = await supabase
            .from('users')
            .select('id, email, name, created_at'); // password expose mat karo

        if (error) throw error;

        return c.json({ total_users: users.length, users, status: 200 }, 200);
    } catch (error) {
        console.log(error);
        return c.json({ message: "internal server error", status: 500 }, 500);
    }
};
