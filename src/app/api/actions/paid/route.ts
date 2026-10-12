import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const invoiceNum = searchParams.get('invoice');
  const business = searchParams.get('business');

  if (invoiceNum) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Find invoice and update to paused
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, business_id')
        .eq('invoice_number', invoiceNum)
        .single();

      if (inv) {
        await supabase
          .from('invoices')
          .update({ status: 'paused', needs_attention: true })
          .eq('id', inv.id);

        // Cancel pending drafts
        await supabase
          .from('messages')
          .update({ status: 'skipped' })
          .eq('invoice_id', inv.id)
          .eq('status', 'pending_approval');

        // Audit log
        await supabase.from('audit_logs').insert({
          business_id: inv.business_id,
          invoice_id: inv.id,
          action: 'customer_marked_paid',
          actor: 'customer',
          details: { invoice_number: invoiceNum, via: 'one_click_link' }
        });
      }
    } catch (err) {
      console.error('Error handling 1-click paid link:', err);
    }
  }
  
  return new NextResponse(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Recorded</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 50px; color: #334155; }
        h1 { color: #0f172a; }
        .container { max-width: 500px; margin: 0 auto; background: #f8fafc; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Thank you</h1>
        <p>We've recorded that you've already paid invoice <strong>${invoiceNum || ''}</strong> for <strong>${business || ''}</strong>.</p>
        <p>Reminders for this invoice have been paused.</p>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}
