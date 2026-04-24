import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 単一トランザクションの取得
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        journalEntries: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

// PUT: トランザクションの更新（電帳法対応: 古いものを論理削除し、新しいものを作成）
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { date, description, receiptImagePath, entries } = body;

    // バリデーション: 貸借一致
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
      if (entry.entryType === 'DEBIT') totalDebit += Number(entry.amount);
      else if (entry.entryType === 'CREDIT') totalCredit += Number(entry.amount);
    }

    if (totalDebit !== totalCredit) {
      return NextResponse.json({ error: '貸借が一致しません' }, { status: 400 });
    }

    // トランザクションを利用して、古い取引の論理削除と新取引の作成を同時に行う
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. 古いデータを論理削除
      await tx.transaction.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // 2. 新しいデータを作成
      const newTransaction = await tx.transaction.create({
        data: {
          date: new Date(date),
          description,
          receiptImagePath,
          journalEntries: {
            create: entries.map((e: any) => ({
              accountId: e.accountId,
              entryType: e.entryType,
              amount: Number(e.amount),
            })),
          },
        },
        include: {
          journalEntries: true,
        },
      });

      return newTransaction;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE: 論理削除
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.transaction.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
