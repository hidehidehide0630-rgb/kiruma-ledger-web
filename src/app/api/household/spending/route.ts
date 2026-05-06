import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || '');
    const month = parseInt(searchParams.get('month') || '');
    const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!) : undefined;

    if (isNaN(year) || isNaN(month)) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    // 日本時間(JST)での月初のUTC日時を計算
    const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`);

    const spendings = await prisma.householdSpending.findMany({
      where: {
        date: {
          gte: monthStart,
          lt: monthEnd,
        },
        categoryId: categoryId,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    return NextResponse.json(spendings);
  } catch (error: any) {
    console.error('Spending GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { 
        date, 
        amount, 
        description, 
        categoryId, 
        syncToBusiness, 
        businessAccountCode 
    } = await req.json();

    // トランザクションで処理
    const result = await prisma.$transaction(async (tx) => {
        // 1. 家計支出の作成
        const spending = await tx.householdSpending.create({
            data: {
                date: new Date(date),
                amount: Number(amount),
                description: description,
                categoryId: categoryId
            }
        });

        // 2. ビジネス同期（青色申告用の記帳）
        if (syncToBusiness) {
            // 事業主借のアカウントを探す
            const proprietorLoanAccount = await tx.account.findFirst({
                where: { name: '事業主借' }
            });

            // 借方科目（ユーザーが選択した費用科目）を探す
            const debitAccount = await tx.account.findFirst({
                where: { code: businessAccountCode }
            });

            if (proprietorLoanAccount && debitAccount) {
                // 取引（Transaction）の作成
                const transaction = await tx.transaction.create({
                    data: {
                        date: new Date(date),
                        description: `[家計同期] ${description || '家計支出'}`,
                        householdSpendingId: spending.id
                    }
                });

                // 借方仕訳（費用発生）
                await tx.journalEntry.create({
                    data: {
                        transactionId: transaction.id,
                        accountId: debitAccount.id,
                        entryType: 'DEBIT',
                        amount: Number(amount)
                    }
                });

                // 貸方仕訳（事業主借：個人の財布からの支払い）
                await tx.journalEntry.create({
                    data: {
                        transactionId: transaction.id,
                        accountId: proprietorLoanAccount.id,
                        entryType: 'CREDIT',
                        amount: Number(amount)
                    }
                });
            }
        }

        return spending;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Spending API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
