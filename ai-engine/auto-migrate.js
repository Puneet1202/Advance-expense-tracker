import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// SUPABASE CONNECTION
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: .env file mein Supabase URL ya Key nahi mili!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("⏳ 1. Extracting data from local D1 Database...");
  let d1Data = [];
  try {
    // Run the wrangler command to get JSON output ONLY for user 10
    // Root folder se run kar rahe hain kyunki purana D1 data wahi .wrangler folder mein hai
    const output = execSync('npx wrangler d1 execute expense-tracker-db --local --command="SELECT * FROM TRANSACTIONS WHERE user_id = 10" --json', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, cwd: '..' });
    const parsed = JSON.parse(output);
    
    // The data is inside the first result array
    if (parsed && parsed.length > 0 && parsed[0].results) {
      d1Data = parsed[0].results;
    } else {
      console.log("⚠️ No transactions found in D1 or wrong format.");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Failed to extract D1 data:", err.message);
    process.exit(1);
  }

  console.log(`✅ Found ${d1Data.length} transactions in D1!`);
  console.log("⏳ 2. Formatting and pushing to Supabase...");

  // Supabase needs array of formatted objects
  const supabaseRecords = d1Data.map(row => {
    return {
      // id: We skip passing 'id' so Supabase auto-generates a new UUID
      amount: row.amount,
      category: row.type === 'income' ? 'Income' : 'General', // Default category
      description: row.description,
      date: row.created_at ? row.created_at.split(' ')[0] : new Date().toISOString().split('T')[0],
      created_at: row.created_at,
      metadata: {
        userId: row.user_id?.toString(),
        accountId: row.account_id?.toString(),
        type: row.type,
        oldD1Id: row.id
      }
    };
  });

  // Batch insert into Supabase (Max 1000 per request is safe)
  const { data, error } = await supabase
    .from('expenses')
    .insert(supabaseRecords)
    .select();

  if (error) {
    console.error("❌ Supabase Insert Error:", error.message, error.details);
    process.exit(1);
  }

  console.log(`🎉 SUCCESS! All ${supabaseRecords.length} records have been migrated to Supabase!`);
  console.log(`💡 Ab sirf apna AI Engine chalayein (npx wrangler dev) aur is link par jayein:`);
  console.log(`👉 http://localhost:8788/api/admin/embed-all`);
  console.log(`Yeh link aapke naye data ke vector embeddings bana dega!`);
}

runMigration();
