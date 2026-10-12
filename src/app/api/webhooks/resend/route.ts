import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyReply } from '@/lib/llm';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    
    // Resend webhook format for received emails
    if (payload.type !== 'email.received') {
      return NextResponse.json({ success: true, ignored: true });
    }

    const email = payload.data;
    const from = email.from;
    const to = email.to; // This might be the reply_to address
    const subject = email.subject || '';
    const body = email.text || email.html || '';

    // Extract invoice number from tags if Resend threaded it, or from subject line.
    // As a simple heuristic, look for INV-XXXX in the subject.
    const invMatch = subject.match(/INV-\d+/i) || body.match(/INV-\d+/i);
    const invoiceNumber = invMatch ? invMatch[0].toUpperCase() : null;

    if (!invoiceNumber) {
      console.warn("Could not determine invoice number for inbound email.");
      return NextResponse.json({ success: true, warning: 'No invoice number found' });
    }

    // Find the invoice in the DB
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, business_id, status')
      .eq('invoice_number', invoiceNumber)
      .single();

    if (invError || !invoice) {
      console.warn(`Invoice ${invoiceNumber} not found.`);
      return NextResponse.json({ success: true, warning: 'Invoice not found' });
    }

    // Classify
    const classification = await classifyReply(subject, body);
    console.log(`[Webhook] Reply for ${invoiceNumber} classified as ${classification}`);

    // Insert into messages
    const { data: newMsg, error: msgError } = await supabase
      .from('messages')
      .insert({
        invoice_id: invoice.id,
        direction: 'inbound',
        subject: subject,
        body: body,
        type: 'received',
        status: 'received',
        sent_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (msgError) {
      console.error("Failed to insert message", msgError);
    }

    let newStatus = invoice.status;
    let needsAttention = true;

    if (classification === 'already_paid') {
      newStatus = 'paused';
    } else if (classification === 'dispute') {
      newStatus = 'disputed';
    } else if (classification === 'promise_to_pay') {
      newStatus = 'promised';
    } else if (classification === 'unsubscribe') {
      // Add to suppressions
      await supabase.from('suppressions').insert({
        business_id: invoice.business_id,
        email: from,
        reason: 'inbound_unsubscribe'
      });
      newStatus = 'paused';
    } else if (classification === 'out_of_office') {
      needsAttention = false;
    }

    // Update invoice status
    if (newStatus !== invoice.status || needsAttention) {
      await supabase
        .from('invoices')
        .update({ status: newStatus, needs_attention: needsAttention })
        .eq('id', invoice.id);
    }

    // Log to audit
    await supabase.from('audit_logs').insert({
      business_id: invoice.business_id,
      invoice_id: invoice.id,
      action: 'reply_received',
      actor: 'system',
      details: { 
        classification, 
        message_id: newMsg?.id,
        status_changed_to: newStatus !== invoice.status ? newStatus : null 
      }
    });

    // If it's a dispute, maybe we cancel all pending drafts
    if (classification === 'dispute' || classification === 'already_paid' || classification === 'unsubscribe') {
      await supabase
        .from('messages')
        .update({ status: 'skipped' })
        .eq('invoice_id', invoice.id)
        .eq('status', 'pending_approval');
    }

    return NextResponse.json({ success: true, classification });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
