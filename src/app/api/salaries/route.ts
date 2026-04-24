import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 全給与データの取得 (Raw SQL)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year}-12-31T23:59:59.999Z`;

    const salaries: any[] = await prisma.$queryRaw`
      SELECT * FROM Salary 
      WHERE date >= ${start} AND date <= ${end}
      ORDER BY date ASC
    `;

    // SQLite may return 0/1 for booleans
    const formatted = salaries.map(s => ({
      ...s,
      isYearEndAdjusted: s.isYearEndAdjusted === 1 || s.isYearEndAdjusted === true
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching salaries:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// POST: 給与データの登録 (Raw SQL)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, amount, socialInsurance, withholdingTax, isYearEndAdjusted, description } = body;

    const dateObj = new Date(date);
    const dateStr = dateObj.toISOString();
    const now = new Date().toISOString();
    const adjInt = isYearEndAdjusted ? 1 : 0;

    const amt = Number(amount) || 0;
    const soc = Number(socialInsurance) || 0;
    const tax = Number(withholdingTax) || 0;

    await prisma.$executeRaw`
      INSERT INTO Salary (date, amount, socialInsurance, withholdingTax, isYearEndAdjusted, description, updatedAt, createdAt)
      VALUES (${dateStr}, ${amt}, ${soc}, ${tax}, ${adjInt}, ${description || ''}, ${now}, ${now})
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating salary:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// DELETE: 給与データの削除 (Raw SQL)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const idInt = parseInt(id);

    await prisma.$executeRaw`
      DELETE FROM Salary WHERE id = ${idInt}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting salary:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// PUT: 給与データの更新 (Raw SQL)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, date, amount, socialInsurance, withholdingTax, isYearEndAdjusted, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const idInt = parseInt(id);
    const dateObj = new Date(date);
    const dateStr = dateObj.toISOString();
    const now = new Date().toISOString();
    const adjInt = isYearEndAdjusted ? 1 : 0;

    const amt = Number(amount) || 0;
    const soc = Number(socialInsurance) || 0;
    const tax = Number(withholdingTax) || 0;

    await prisma.$executeRaw`
      UPDATE Salary 
      SET date = ${dateStr}, 
          amount = ${amt}, 
          socialInsurance = ${soc}, 
          withholdingTax = ${tax}, 
          isYearEndAdjusted = ${adjInt}, 
          description = ${description || ''}, 
          updatedAt = ${now}
      WHERE id = ${idInt}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating salary:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
