import { Hono } from 'hono'
import { getEmbeddings } from '../ai/embedding.js'
import { getSupabaseClient } from '../db/supabase.js'
import AI_CONFIG from '../../ai-config.js'

// FILE: admin.js
// KAAM: Admin sync and embedding routes for data import to pgvector
// CONNECTS TO: db/supabase.js, ai/embedding.js
// CONFIG: ai-config.js se ENV setting leta hai

const adminRoute = new Hono()

/**
 * MIGRATION ROUTE: Update embeddings for all expenses in Supabase
 * GET /api/admin/sync-all
 */
adminRoute.get('/sync-all', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);
    
    // Fetch all expenses directly from Supabase
    const { data: results, error: fetchError } = await supabase
      .from('expenses')
      .select('*');

    if (fetchError) throw fetchError;

    const total = results?.length || 0;
    console.log(`\n🚀 Processing all ${total} rows for embeddings`);

    if (total === 0) {
      return c.json({ done: true, message: `No rows found to sync!` });
    }

    let successCount = 0;
    let errorCount   = 0;
    const errors     = [];

    for (const t of results) {
      try {
        const textToEmbed = `Description: ${t.description || 'N/A'}, Amount: ${t.amount ?? 0}, Category: ${t.category || 'N/A'}`;
        const embedding = await getEmbeddings(textToEmbed, c.env);

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error(`Invalid embedding returned`);
        }

        const { error: updateError } = await supabase
          .from('expenses')
          .update({ embedding })
          .eq('id', t.id);

        if (updateError) throw updateError;

        successCount++;
        console.log(`✅ [${successCount + errorCount}/${total}] ID ${t.id} synced`);
      } catch (rowErr) {
        errorCount++;
        const msg = `Row ID ${t.id}: ${rowErr.message}`;
        console.error(`❌ ${msg}`);
        if (errors.length < 5) errors.push(msg);
      }
    }

    return c.json({
      done: true,
      syncedCount: successCount,
      errorCount,
      totalRows: total,
      message: `🎉 All done! ${successCount} transactions synced with embeddings in Supabase.`,
      ...(errors.length > 0 && { sampleErrors: errors })
    });

  } catch (error) {
    console.error("❌ Sync Failed:", error.message);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * EMBED-ALL ROUTE: Find expenses with missing embeddings and embed them
 * GET /api/admin/embed-all
 */
adminRoute.get('/embed-all', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    // 1. Supabase se lo jahan embedding IS NULL
    const { data: missingRecords, error: fetchError } = await supabase
      .from('expenses')
      .select('*')
      .is('embedding', null);

    if (fetchError) throw fetchError;

    const total = missingRecords?.length || 0;
    if (total === 0) {
      return c.json({ done: true, message: `No rows with missing embeddings found.` });
    }

    let successCount = 0;

    for (const row of missingRecords) {
      // 2. Har row ke liye text = description + " " + category
      const text = `${row.description || 'Unknown'} ${row.category || 'General'}`;

      // 3. ai-config ke hisaab se embedding banao
      const embedding = await getEmbeddings(text, c.env);

      if (embedding && Array.isArray(embedding)) {
        // 4. Supabase mein update karo
        const { error: updateError } = await supabase
          .from('expenses')
          .update({ embedding })
          .eq('id', row.id);

        if (!updateError) {
          successCount++;
          // 5. Console: "3/150 embedded ✓"
          console.log(`${successCount}/${total} embedded ✓`);
        } else {
          console.error(`Failed to update DB for ID ${row.id}:`, updateError.message);
        }
      }
    }

    // 6. End mein: "All done! X expenses embedded."
    const endMessage = `All done! ${successCount} expenses embedded.`;
    console.log(endMessage);

    return c.json({ done: true, message: endMessage, embeddedCount: successCount });

  } catch (error) {
    console.error("❌ Embed-All Failed:", error.message);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * STATUS CHECK
 * URL: GET /api/admin/status
 */
adminRoute.get('/status', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);
    
    const { count, error } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true });
      
    if (error) throw error;

    return c.json({
      status: 'ok',
      supabase_transaction_count: count || 0,
      cloudflare_subrequest_limit: 'Removed (Using Supabase)',
      page_size_used: 'All',
      bindings: {
        db: true,
        vectorDB: true,
        ai: !!c.env?.AI
      }
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default adminRoute;
