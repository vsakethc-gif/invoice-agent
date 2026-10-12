import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { InvoiceContext } from '@/lib/guardrails';

async function handleSendCron(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch messages that are 'approved' to be sent.
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select(`
        id,
        subject,
        body,
        invoice_id,
        invoices (
          invoice_number,
          customer_name,
          customer_email,
          amount,
          currency,
          due_date,
          payment_link,
          businesses (
            name,
            owner_name,
            reply_to_email,
            bcc_email,
            skip_weekends,
            id
          )
        )
      `)
      .eq('status', 'approved')
      .eq('type', 'draft')
      .limit(50); // Process in batches

    if (msgError) throw msgError;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const currentDay = new Date().getDay();
    const isWeekend = currentDay === 0 || currentDay === 6;

    let count = 0;
    for (const msg of messages) {
      const inv = msg.invoices as any;
      const biz = inv.businesses as any;

      if (biz.skip_weekends !== false && isWeekend) {
        // Skip sending today, leave in approved state for Monday
        continue;
      }

      if (!inv.customer_email) {
        // Mark as skipped if no email
        await supabase.from('messages').update({ status: 'skipped' }).eq('id', msg.id);
        continue;
      }

      const context: InvoiceContext = {
        business_name: biz.name,
        owner_name: biz.owner_name,
        customer_name: inv.customer_name,
        invoice_number: inv.invoice_number,
        amount: inv.amount,
        currency: inv.currency,
        due_date: inv.due_date,
        payment_link: inv.payment_link
      };

      const result = await sendEmail({
        to: inv.customer_email,
        subject: msg.subject,
        body: msg.body,
        context,
        businessEmail: biz.reply_to_email || 'noreply@invoicenudge.com',
        bcc: biz.bcc_email,
        messageId: msg.id
      });

      if (result.error) {
        console.error(`Failed to send message ${msg.id}:`, result.error);
        // Could mark status as 'failed', but for MVP we might leave it 'approved' or mark 'error'
        continue;
      }

      // Update message to sent
      await supabase.from('messages').update({
        status: 'sent',
        type: 'sent',
        sent_at: new Date().toISOString()
      }).eq('id', msg.id);

      // Audit log
      await supabase.from('audit_logs').insert({
        business_id: biz.id,
        invoice_id: msg.invoice_id,
        action: 'message_sent',
        actor: 'system',
        details: { message_id: msg.id, resend_id: result.id, subject: msg.subject }
      });

      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Cron Send Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleSendCron(req);
}

export async function POST(req: Request) {
  return handleSendCron(req);
}
