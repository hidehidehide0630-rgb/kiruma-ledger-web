import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

  try {
    const budgets = await prisma.householdBudget.findMany({
      where: { year, month },
      include: { category: true }
    });
    return NextResponse.json(budgets);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, month, budgets } = body; // budgets: [{ categoryId, amount }]

    if (!year || !month || !Array.isArray(budgets)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // 各項目を Upsert する
    const results = await Promise.all(
      budgets.map(async (b: any) => {
        return prisma.householdBudget.upsert({
          where: {
            year_month_categoryId: {
              year,
              month,
              categoryId: b.categoryId
            }
          },
          update: {
            amount: b.amount
          },
          create: {
            year,
            month,
            categoryId: b.categoryId,
            amount: b.amount
          }
        });
      })
    );

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
