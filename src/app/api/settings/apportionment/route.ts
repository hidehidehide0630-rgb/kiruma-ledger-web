import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 支出科目のリストと現在の按分比率を取得
export async function GET() {
  if (!(prisma as any).businessRatio) {
    return NextResponse.json({ error: 'Prisma client out of sync. Please restart server.' }, { status: 500 });
  }
  try {
    const expenseAccounts = await prisma.account.findMany({
      where: { type: 'EXPENSE' },
      include: { businessRatio: true },
    });

    return NextResponse.json(expenseAccounts);
  } catch (error) {
    console.error('Error fetching apportionment ratios:', error);
    return NextResponse.json({ error: 'Failed to fetch ratios' }, { status: 500 });
  }
}

// 按分比率を更新
export async function POST(request: Request) {
  if (!(prisma as any).businessRatio) {
    return NextResponse.json({ error: 'Prisma client out of sync. Please restart server.' }, { status: 500 });
  }
  try {
    const { accountId, ratio } = await request.json();

    if (ratio < 0 || ratio > 100) {
      return NextResponse.json({ error: 'Ratio must be between 0 and 100' }, { status: 400 });
    }

    const updated = await prisma.businessRatio.upsert({
      where: { accountId },
      update: { ratio },
      create: { accountId, ratio },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating apportionment ratio:', error);
    return NextResponse.json({ error: 'Failed to update ratio' }, { status: 500 });
  }
}
