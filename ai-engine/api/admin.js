import { Hono } from 'hono'
import { getEmbeddings } from '../ollama/client.js'

const adminRoute = new Hono()

/**
 * MIGRATION ROUTE: D1 → Vectorize sync (Paginated)
 * 
 * ⚠️ Cloudflare Free Plan limit: 50 subrequests per Worker invocation
 *    Isliye hum ek baar mein 40 rows process karte hain.
 * 
 * Usage:
 *   Page 1: GET /api/admin/sync-all?page=1
 *   Page 2: GET /api/admin/sync-all?page=2
 *   Page 3: GET /api/admin/sync-all?page=3
 *   ... jab tak "done: true" na aaye
 */
adminRoute.get('/sync-all', async (c) => {
  try {
    const db = c.env.expense_tracker_db || c.env.DB;
    if (!db)              throw new Error("D1 binding missing!");
    if (!c.env.VECTOR_DB) throw new Error("Vectorize binding missing!");
    if (!c.env.AI)        throw new Error("AI binding missing!");

    // ✅ Pagination params
    const PAGE_SIZE = 40;  // 40 AI calls + 1 D1 + ~4 upserts = ~45 subrequests (safe under 50)
    const page      = parseInt(c.req.query('page') || '1');
    const offset    = (page - 1) * PAGE_SIZE;

    // Total count
    const { results: countRes } = await db
      .prepare("SELECT COUNT(*) as total FROM TRANSACTIONS")
      .all();
    const total = countRes[0]?.total || 0;

    // Is page ke rows
    const { results } = await db
      .prepare("SELECT * FROM TRANSACTIONS LIMIT ? OFFSET ?")
      .bind(PAGE_SIZE, offset)
      .all();

    console.log(`\n🚀 [PAGE ${page}] Processing rows ${offset + 1}–${offset + results.length} of ${total}`);

    if (results.length === 0) {
      return c.json({
        done: true,
        page,
        message: `All ${total} rows already synced!`
      });
    }

    let successCount = 0;
    let errorCount   = 0;
    const errors     = [];

    for (const t of results) {
      try {
        const textToEmbed = `Description: ${t.description || 'N/A'}, Amount: ${t.amount ?? 0}, Type: ${t.type || 'N/A'}`;
        const embedding   = await getEmbeddings(textToEmbed, c.env);

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error(`Invalid embedding returned`);
        }

        await c.env.VECTOR_DB.upsert([{
          id:        t.id.toString(),
          values:    embedding,
          namespace: (t.user_id ?? 'unknown').toString(),
          metadata: {
            userId:      t.user_id,
            description: t.description,
            amount:      t.amount,
            type:        t.type
          }
        }]);

        successCount++;
        console.log(`✅ [${offset + successCount + errorCount}/${total}] ID ${t.id} synced`);

      } catch (rowErr) {
        errorCount++;
        const msg = `Row ID ${t.id}: ${rowErr.message}`;
        console.error(`❌ ${msg}`);
        if (errors.length < 5) errors.push(msg);
      }
    }

    const hasMore   = (offset + results.length) < total;
    const nextPage  = hasMore ? page + 1 : null;

    return c.json({
      done:        !hasMore,
      page,
      totalPages:  Math.ceil(total / PAGE_SIZE),
      syncedCount: successCount,
      errorCount,
      totalSoFar:  offset + successCount,
      totalRows:   total,
      nextPage,
      nextUrl:     nextPage ? `/api/admin/sync-all?page=${nextPage}` : null,
      message:     hasMore
        ? `Page ${page} done. Hit /api/admin/sync-all?page=${nextPage} for next batch.`
        : `🎉 All done! ${offset + successCount} transactions synced to Vectorize.`,
      ...(errors.length > 0 && { sampleErrors: errors })
    });

  } catch (error) {
    console.error("❌ Sync Failed:", error.message);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * STATUS CHECK
 * URL: GET /api/admin/status
 */
adminRoute.get('/status', async (c) => {
  try {
    const db = c.env.expense_tracker_db || c.env.DB;
    const { results } = await db
      .prepare("SELECT COUNT(*) as count FROM TRANSACTIONS")
      .all();
    return c.json({
      status: 'ok',
      d1_transaction_count: results[0]?.count || 0,
      cloudflare_subrequest_limit: 50,
      page_size_used: 40,
      bindings: {
        db:       !!db,
        vectorDB: !!c.env.VECTOR_DB,
        ai:       !!c.env.AI
      }
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default adminRoute;