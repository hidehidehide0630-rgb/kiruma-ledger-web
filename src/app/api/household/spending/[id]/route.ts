import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE: 家計支出の削除
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const spending = await prisma.householdSpending.findUnique({
      where: { id },
      include: { transaction: true }
    });

    if (!spending) {
      return NextResponse.json({ error: 'Spending not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. 関連する取引（ビジネス同期）がある場合は、取引も論理削除
      if (spending.transactionId) {
        await tx.transaction.update({
          where: { id: spending.transactionId },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
      }

      // 2. 家計支出レコードの削除（こちらは物理削除でOKな設計とする）
      await tx.householdSpending.delete({
        where: { id }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting household spending:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: 家計支出の更新
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { date, amount, description, categoryId } = body;

    const spending = await prisma.householdSpending.findUnique({
      where: { id },
      include: { transaction: { include: { journalEntries: true } } }
    });

    if (!spending) {
      return NextResponse.json({ error: 'Spending not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. 家計支出の更新
      const updatedSpending = await tx.householdSpending.update({
        where: { id },
        data: {
          date: new Date(date),
          amount: Number(amount),
          description,
          categoryId: Number(categoryId)
        }
      });

      // 2. 関連する取引（ビジネス同期）がある場合
      if (spending.transactionId) {
        // 取引本体の更新
        await tx.transaction.update({
          where: { id: spending.transactionId },
          data: {
            date: new Date(date),
            description: `[家計同期] ${description || '家計支出'}`,
          }
        });

        // 仕訳（JournalEntry）の金額も更新
        await tx.journalEntry.updateMany({
          where: { transactionId: spending.transactionId },
          data: {
            amount: Number(amount)
          }
        });
      }

      return updatedSpending;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error updating household spending:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
