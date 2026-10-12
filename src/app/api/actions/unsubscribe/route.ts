import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const business = searchParams.get('business');

  if (email) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Find business
      let businessId: string | null = null;
      if (business) {
        const { data: biz } = await supabase
          .from('businesses')
          .select('id')
          .eq('name', business)
          .single();
        if (biz) businessId = biz.id;
      }

      if (businessId) {
        await supabase.from('suppressions').insert({
          business_id: businessId,
          email: email,
          reason: 'one_click_unsubscribe'
        });
      }
    } catch (err) {
      console.error('Error recording unsubscribe:', err);
    }
  }
  
  return new NextResponse(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribed</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 50px; color: #334155; }
        h1 { color: #0f172a; }
        .container { max-width: 500px; margin: 0 auto; background: #f8fafc; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Unsubscribed</h1>
        <p><strong>${email}</strong> has been successfully unsubscribed from future reminders from <strong>${business}</strong>.</p>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}
