import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const accountId = searchParams.get('accountId');

    // 基本となる日付フィルタ
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    
    // 論理削除されていない取引のIDサブクエリ条件
    const validTransactionFilter = Object.keys(dateFilter).length > 0 
      ? { isDeleted: false, date: dateFilter }
      : { isDeleted: false };

    if (type === 'pl' || type === 'bs') {
      // 勘定科目ごとに、指定期間内のすべて仕訳を集計する
      // TODO: パフォーマンスが課題になるならSQL直書きも検討するが、ローカルSQLite + 個人利用規模ならPrismaで全件引いて集計で十分
      const accounts = await prisma.account.findMany({
        include: {
          journalEntries: {
            where: {
              transaction: validTransactionFilter
            }
          },
          businessRatio: true,
        }
      });

      const reportData = accounts.map(acc => {
        let totalDebit = 0;
        let totalCredit = 0;
        for (const entry of acc.journalEntries) {
          if (entry.entryType === 'DEBIT') totalDebit += entry.amount;
          else if (entry.entryType === 'CREDIT') totalCredit += entry.amount;
        }

        // 勘定科目の種類によって残高の計算方向が変わる
        let balance = 0;
        if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
          balance = totalDebit - totalCredit;
        } else {
          balance = totalCredit - totalDebit;
        }

        const ratio = (acc.businessRatio as any)?.ratio ?? 100;
        
        // 所得控除科目 (800番台) は事業経費に含めない
        let businessBalance = balance;
        if (acc.type === 'EXPENSE') {
          if (acc.code && acc.code.startsWith('8')) {
            businessBalance = 0;
          } else {
            businessBalance = Math.floor(balance * (ratio / 100));
          }
        }

        return {
          accountId: acc.id,
          name: acc.name,
          type: acc.type,
          code: acc.code,
          totalDebit,
          totalCredit,
          balance, // 額面
          businessBalance, // 事業分
          ratio
        };
      });

      if (type === 'pl') {
        const plAccounts = reportData.filter(a => a.type === 'REVENUE' || a.type === 'EXPENSE');
        const revenue = plAccounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.businessBalance, 0);
        const expense = plAccounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.businessBalance, 0);
        const netIncome = revenue - expense;

        return NextResponse.json({
          type: 'pl',
          accounts: plAccounts,
          summary: { revenue, expense, netIncome }
        });
      } else if (type === 'bs') {
        const bsAccounts = reportData.filter(a => a.type === 'ASSET' || a.type === 'LIABILITY' || a.type === 'EQUITY');
        const asset = bsAccounts.filter(a => a.type === 'ASSET').reduce((sum, a) => sum + a.balance, 0);
        const liability = bsAccounts.filter(a => a.type === 'LIABILITY').reduce((sum, a) => sum + a.balance, 0);
        const equity = bsAccounts.filter(a => a.type === 'EQUITY').reduce((sum, a) => sum + a.balance, 0);
        
        // P/Lの当期純利益も加算する必要がある
        const plAccounts = reportData.filter(a => a.type === 'REVENUE' || a.type === 'EXPENSE');
        const netIncome = 
          plAccounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => sum + a.businessBalance, 0) -
          plAccounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => sum + a.businessBalance, 0);

        return NextResponse.json({
          type: 'bs',
          accounts: bsAccounts,
          summary: { asset, liability, equity, netIncome, totalLiabilitiesAndEquity: liability + equity + netIncome }
        });
      }
    } else if (type === 'ledger') {
      if (!accountId) {
        return NextResponse.json({ error: 'accountId is required for ledger' }, { status: 400 });
      }

      const entries = await prisma.journalEntry.findMany({
        where: {
          accountId: parseInt(accountId),
          transaction: validTransactionFilter
        },
        include: {
          transaction: {
            include: {
              journalEntries: {
                include: {
                  account: true
                }
              }
            }
          }
        },
        orderBy: {
          transaction: {
            date: 'asc'
          }
        }
      });

      const account = await prisma.account.findUnique({ where: { id: parseInt(accountId) } });
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

      let currentBalance = 0;
      const ledgerEntries = entries.map(entry => {
        const otherEntries = entry.transaction.journalEntries.filter(e => e.id !== entry.id);
        const targetAccountName = otherEntries.length === 1 
          ? otherEntries[0].account.name 
          : (otherEntries.length > 1 ? '諸口' : '不明');

        if (account.type === 'ASSET' || account.type === 'EXPENSE') {
          if (entry.entryType === 'DEBIT') currentBalance += entry.amount;
          else currentBalance -= entry.amount;
        } else {
          if (entry.entryType === 'CREDIT') currentBalance += entry.amount;
          else currentBalance -= entry.amount;
        }

        return {
          id: entry.id,
          date: entry.transaction.date,
          description: entry.transaction.description,
          targetAccountName,
          debit: entry.entryType === 'DEBIT' ? entry.amount : 0,
          credit: entry.entryType === 'CREDIT' ? entry.amount : 0,
          balance: currentBalance,
        };
      });

      return NextResponse.json({ type: 'ledger', account, entries: ledgerEntries });
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });

  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
