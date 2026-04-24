import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 取引一覧取得（論理削除を除外、検索対応）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const q = searchParams.get('q'); // 摘要検索用

    const where: any = {
      isDeleted: false,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    if (q) {
      where.description = { contains: q };
    }

    // 金額での絞り込み（リレーション先であるJournalEntryの金額を基にするため多少複雑になりますが、
    // ここでは簡易的に、Transactionに紐づくDEBITの合計額等でフィルタすることも考えられます。
    // 今回はJournalEntryを常にインクルードして返す形にします）

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        journalEntries: {
          include: {
            account: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    // フロントエンド側で金額のフィルタリングを行うか、ここで後処理するか
    let filteredTransactions = transactions;
    if (minAmount || maxAmount) {
      filteredTransactions = transactions.filter((t: any) => {
        // 取引全体の金額（DEBITの合計などを取引額とみなす）
        const total = t.journalEntries
          .filter((e: any) => e.entryType === 'DEBIT')
          .reduce((sum: number, e: any) => sum + e.amount, 0);

        if (minAmount && total < Number(minAmount)) return false;
        if (maxAmount && total > Number(maxAmount)) return false;
        return true;
      });
    }

    return NextResponse.json(filteredTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST: 新規取引登録（貸借一致バリデーション付き）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, description, receiptImagePath, entries } = body;

    // バリデーション: entriesが存在するか
    if (!entries || !Array.isArray(entries) || entries.length < 2) {
      return NextResponse.json({ error: '仕訳データ（最低2行）が必要です' }, { status: 400 });
    }

    // 貸借一致のバリデーション
    let totalDebit = 0;
    let totalCredit = 0;

    for (const entry of entries) {
      if (entry.entryType === 'DEBIT') totalDebit += Number(entry.amount);
      else if (entry.entryType === 'CREDIT') totalCredit += Number(entry.amount);
      else return NextResponse.json({ error: 'Invalid entryType' }, { status: 400 });
    }

    if (totalDebit !== totalCredit) {
      return NextResponse.json(
        { error: '貸借が一致しません', details: { totalDebit, totalCredit } },
        { status: 400 }
      );
    }

    // DBへの保存
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(date),
        description,
        receiptImagePath,
        journalEntries: {
          create: entries.map((e: any) => ({
            accountId: e.accountId,
            entryType: e.entryType,
            amount: Number(e.amount),
            tag: e.tag || null,
          })),
        },
      },
      include: {
        journalEntries: {
          include: {
            account: true,
          },
        },
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
