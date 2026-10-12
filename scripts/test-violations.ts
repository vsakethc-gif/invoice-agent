import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, violations, body, subject')
    .eq('used_fallback', true)
    .order('created_at', { ascending: false })
    .limit(3);
  console.log('Error:', error);
  console.log(JSON.stringify(messages, null, 2));
}

run();
