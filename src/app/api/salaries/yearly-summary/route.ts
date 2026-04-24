import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 指定年の年末調整サマリー取得 (Raw SQL)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    if (!yearStr) return NextResponse.json({ error: 'Year is required' }, { status: 400 });
    const year = parseInt(yearStr);

    const summaries: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM YearlySalarySummary WHERE year = ${year}
    `);
    const summary = summaries[0];

    return NextResponse.json(summary || { year, totalAmount: 0, totalSocialInsurance: 0, totalWithholdingTax: 0, isConfirmed: 0 });
  } catch (error: any) {
    console.error('Error fetching yearly salary summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}

// POST: 年末調整サマリーの保存 (Raw SQL Upsert)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { year, totalAmount, totalSocialInsurance, totalWithholdingTax, isConfirmed } = body;
    const yearInt = parseInt(year);
    const confInt = isConfirmed ? 1 : 0;
    const now = new Date().toISOString();

    // SQLite Upsert (REPLACE)
    await prisma.$executeRawUnsafe(`
      INSERT OR REPLACE INTO YearlySalarySummary (year, totalAmount, totalSocialInsurance, totalWithholdingTax, isConfirmed, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, yearInt, Number(totalAmount), Number(totalSocialInsurance), Number(totalWithholdingTax), confInt, now);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving yearly salary summary:', error);
    return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
  }
}
