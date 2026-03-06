const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    // try to get foreign keys on prompt_favorites
    const { data: fkInfo, error: err } = await supabaseAdmin.rpc('get_foreign_keys', { table_name: 'prompt_favorites' });
    console.log("FKs info:", fkInfo, err);
}
run();
