// FILE: backend/src/db/supabase.js
// KAAM: Backend ke liye Supabase client factory
//
// WHY BANAYA: Backend pehle D1 (Cloudflare) use karta tha.
// Ab Supabase primary database ban gaya hai.
// Har controller request pe nayi client instance banta hai
// taaki c.env se fresh secrets milein (wrangler dev aur production dono mein).
//
// .dev.vars mein ye keys chahiye:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
//
// SERVICE_ROLE key use ki hai (anon nahi) kyunki:
//   - Backend server-side hai, browser mein expose nahi hoti
//   - Row Level Security bypass karne ki zaroorat hai user data ke liye

import { createClient } from '@supabase/supabase-js';

export const getSupabaseClient = (env) => {
    const supabaseUrl = env?.SUPABASE_URL;
    const supabaseKey = env?.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error(
            'SUPABASE_URL ya SUPABASE_SERVICE_ROLE_KEY missing hai. ' +
            'Root .dev.vars mein add karo: SUPABASE_URL aur SUPABASE_SERVICE_ROLE_KEY'
        );
    }

    return createClient(supabaseUrl, supabaseKey);
};
