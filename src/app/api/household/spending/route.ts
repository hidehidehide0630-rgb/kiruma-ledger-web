import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
