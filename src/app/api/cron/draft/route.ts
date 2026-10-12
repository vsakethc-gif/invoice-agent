import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runDraftingForBusiness, type BusinessRow } from '@/services/drafting';

async function handleDraftCron(req: Request) {
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

    // Fetch all businesses
    const { data: businesses, error: bizError } = await supabase
      .from('businesses')
      .select('*');

    if (bizError) throw bizError;

    let totalDrafted = 0;
    let totalSkipped = 0;
    let totalAttention = 0;

    for (const biz of (businesses || [])) {
      const summary = await runDraftingForBusiness(supabase, biz as BusinessRow);
      totalDrafted += summary.drafted;
      totalSkipped += summary.skipped;
      totalAttention += summary.needsAttention;
    }

    return NextResponse.json({
      success: true,
      drafted: totalDrafted,
      skipped: totalSkipped,
      needsAttention: totalAttention,
      businessesProcessed: (businesses || []).length
    });
  } catch (error: any) {
    console.error('Cron Draft Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleDraftCron(req);
}

export async function POST(req: Request) {
  return handleDraftCron(req);
}
