import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users[0];
  if (!user) return console.log('no user');

  const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
  const { data: inv } = await supabase.from('invoices').select('*').eq('business_id', biz.id).limit(1).single();
  
  if (!inv) return console.log('no invoices');

  console.log('Inv Amount:', inv.amount, 'Type:', typeof inv.amount);

  const amt = Number(inv.amount);
  const update = { status: 'paid', amount_paid: amt, paid_at: new Date().toISOString() };
  console.log('Updating with:', update);

  const { data, error } = await supabase.from('invoices').update(update).eq('id', inv.id);
  
  console.log('Error:', error);
  console.log('Data:', data);
}

run();
