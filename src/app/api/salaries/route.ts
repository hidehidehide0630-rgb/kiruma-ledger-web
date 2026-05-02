import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: 全給与データの取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const salaries = await prisma.salary.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    return NextResponse.json(salaries);
  } catch (error: any) {
    console.error('Error fetching salaries:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// POST: 給与データの登録
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, amount, socialInsurance, withholdingTax, isYearEndAdjusted, description } = body;

    const salary = await prisma.salary.create({
      data: {
        date: new Date(date),
        amount: Number(amount) || 0,
        socialInsurance: Number(socialInsurance) || 0,
        withholdingTax: Number(withholdingTax) || 0,
        isYearEndAdjusted: !!isYearEndAdjusted,
        description: description || ''
      }
    });

    return NextResponse.json(salary, { status: 201 });
  } catch (error: any) {
    console.error('Error creating salary:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// DELETE: 給与データの削除
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.salary.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting salary:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// PUT: 給与データの更新
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, date, amount, socialInsurance, withholdingTax, isYearEndAdjusted, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const salary = await prisma.salary.update({
      where: { id: parseInt(id) },
      data: {
        date: new Date(date),
        amount: Number(amount) || 0,
        socialInsurance: Number(socialInsurance) || 0,
        withholdingTax: Number(withholdingTax) || 0,
        isYearEndAdjusted: !!isYearEndAdjusted,
        description: description || ''
      }
    });

    return NextResponse.json(salary);
  } catch (error: any) {
    console.error('Error updating salary:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
