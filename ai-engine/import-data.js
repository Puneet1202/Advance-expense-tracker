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

// ==========================================
// 🎯 DATA TO IMPORT (Aap yahan koi bhi data daal sakte hain)
// ==========================================
const myDataToImport = [
  {
    amount: 150,
    category: "Food",
    description: "Zomato Lunch",
    date: "2026-05-13",
    metadata: { userId: "user-123" } // D1 ka purana user_id
  },
  {
    amount: 2500,
    category: "Shopping",
    description: "Amazon Shoes",
    date: "2026-05-12",
    metadata: { userId: "user-123" }
  }
  // Yahan aap apne 117 transactions ka json copy paste kar sakte hain
];

// ==========================================
// 🚀 IMPORT FUNCTION
// ==========================================
async function importData() {
  console.log(`🚀 Starting import of ${myDataToImport.length} records to Supabase...`);

  // Step 1: Insert into 'expenses' table
  const { data, error } = await supabase
    .from('expenses')
    .insert(myDataToImport)
    .select();

  if (error) {
    console.error("❌ ERROR importing data:", error.message);
    return;
  }

  console.log(`✅ Success! ${data.length} records inserted into Supabase.`);
  console.log(`💡 Ab aap 'http://localhost:8787/api/admin/embed-all' ko hit karke in sabki auto-embedding karwa sakte hain!`);
}

importData();
