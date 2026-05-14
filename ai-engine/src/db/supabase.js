import { createClient } from '@supabase/supabase-js';

// FILE: Supabase client initialization
// REPLACES: D1/Vectorize bindings
// CONNECTS TO: Supabase API

// Note: In Cloudflare Workers, environment variables are often accessed via `c.env` per request.
// However, since we are moving away from Cloudflare bindings for DB, we can initialize it 
// per request or globally if env vars are globally available (like process.env in Node, but this is a worker).
// Let's create a function that takes `env` and returns the client, or use global if available.

export const getSupabaseClient = (env) => {
    const supabaseUrl = env?.SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = env?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase URL or Key is missing in environment variables.");
    }
    
    return createClient(supabaseUrl, supabaseKey);
};
