

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
