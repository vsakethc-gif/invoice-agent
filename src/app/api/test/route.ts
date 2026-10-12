import { NextResponse } from 'next/server';
import { updateInvoiceStatus } from '@/app/dashboard/agent-actions';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no user' });

    const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).single();
    if (!biz) return NextResponse.json({ error: 'no biz' });
    const { data: inv } = await supabase.from('invoices').select('*').eq('business_id', biz.id).limit(1).single();

    if (!inv) return NextResponse.json({ error: 'no invoice' });

    const res = await updateInvoiceStatus(inv.id, 'paid');
    return NextResponse.json({ res });
  } catch(e: any) {
    return NextResponse.json({ error: e.message });
  }
}
