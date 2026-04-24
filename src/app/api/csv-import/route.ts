import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { prisma } from '@/lib/prisma';

// 簡易的なキーワードマッチング（実際はもっと詳細化したりAIに投げたりする）
const KEYWORD_MAP: Record<string, string> = {
  '電気': '水道光熱費',
  'ガス': '水道光熱費',
  '水道': '水道光熱費',
  'ＪＲ': '旅費交通費',
  'タクシー': '旅費交通費',
  'Ａｍａｚｏｎ': '消耗品費',
  'ｱﾏｿﾞﾝ': '消耗品費',
  '文具': '消耗品費',
  '保険': '損害保険料',
  '通信': '通信費',
  'ＮＴＴ': '通信費',
  'ソフトバンク': '通信費',
  '家賃': '地代家賃',
  '手数料': '支払手数料',
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    
    // 一般的な銀行・クレカCSVフォーマットを想定してパース（ヘッダ有無などは実際のファイルによる）
    // 今回は日付(0), 摘要(1), 支払金額(2), 入金金額(3) の簡単な形式を想定
    const parseResult = Papa.parse(text, {
      skipEmptyLines: true,
      // UTF-8前提
    });

    const accounts = await prisma.account.findMany();
    // キャッシュ用マップ作成
    const accountMap = new Map(accounts.map(a => [a.name, a.id]));
    const defaultExpenseId = accountMap.get('雑費') || accounts.find(a => a.type === 'EXPENSE')?.id;
    const defaultRevenueId = accountMap.get('雑収入') || accounts.find(a => a.type === 'REVENUE')?.id;
    const bankAccountId = accountMap.get('普通預金') || accounts.find(a => a.name.includes('預金'))?.id;

    const drafts: any[] = [];

    // ヘッダ行をスキップする簡易ロジック
    const isHeader = (row: any[]) => {
      return row.some(col => col.includes('日付') || col.includes('摘要'));
    }

    let idCounter = 1;
    for (const row of parseResult.data as string[][]) {
      if (isHeader(row)) continue;
      if (row.length < 3) continue;

      const [dateStr, description, paymentStr, incomeStr] = row;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) continue; // 日付パース失敗

      const payment = paymentStr ? parseInt(paymentStr.replace(/[^0-9]/g, '')) : 0;
      const income = incomeStr ? parseInt(incomeStr.replace(/[^0-9]/g, '')) : 0;

      if (!payment && !income) continue; // 金額なし

      // 摘要から科目を推測
      let guessedAccountName = '';
      for (const [kw, acc] of Object.entries(KEYWORD_MAP)) {
        if (description.includes(kw)) {
          guessedAccountName = acc;
          break;
        }
      }

      const entries = [];
      if (payment > 0) {
        // 出金の場合
        // 借方：推測された費用科目（不明なら雑費） / 貸方：普通預金
        const accountId = accountMap.get(guessedAccountName) || defaultExpenseId;
        entries.push({ accountId, entryType: 'DEBIT', amount: payment, accountName: guessedAccountName || '雑費 (自動推測)' });
        entries.push({ accountId: bankAccountId, entryType: 'CREDIT', amount: payment, accountName: '普通預金' });
      } else if (income > 0) {
        // 入金の場合
        // 借方：普通預金 / 貸方：推測された収益科目（不明なら雑収入）
        const accountId = accountMap.get(guessedAccountName) || defaultRevenueId;
        entries.push({ accountId: bankAccountId, entryType: 'DEBIT', amount: income, accountName: '普通預金' });
        entries.push({ accountId, entryType: 'CREDIT', amount: income, accountName: guessedAccountName || '雑収入 (自動推測)' });
      }

      drafts.push({
        id: idCounter++, // UI上で一意にするためのテンポラリID
        date: date.toISOString().split('T')[0],
        description,
        entries
      });
    }

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('Error importing CSV:', error);
    return NextResponse.json({ error: 'Failed to parse CSV' }, { status: 500 });
  }
}
