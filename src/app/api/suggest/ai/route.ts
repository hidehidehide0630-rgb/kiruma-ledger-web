import { NextResponse } from 'next/server';
import { getAiSuggestions } from '@/lib/logic/account_suggester';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    // 勘定科目のリストを取得してプロンプトに含める
    const accounts = await prisma.account.findMany({
      where: {
        type: { in: ['EXPENSE', 'REVENUE', 'ASSET', 'LIABILITY'] }
      }
    });
    const accountNames = accounts.map(a => a.name);

    let suggestions: { accountName: string; reason: string }[] = [];
    if (process.env.GEMINI_API_KEY) {
      const { getAiSuggestions } = await import('@/lib/logic/account_suggester');
      suggestions = await getAiSuggestions(description, accountNames);
    }

    // AI提案が取得できない（キー不足、エラー、結果ゼロ）場合の強力なフォールバック
    if (suggestions.length === 0) {
      const { suggestAccountFromHistoryOrKeyword } = await import('@/lib/logic/account_suggester');
      const localResult = await suggestAccountFromHistoryOrKeyword(description);
      if (localResult) {
        suggestions = [{
          accountName: localResult.accountName,
          reason: '過去の履歴または辞書から推測されました（AIキー未設定）'
        }];
      }
    }

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('AI Suggestion API Error:', error);
    return NextResponse.json({ error: 'Failed to get AI suggestions' }, { status: 500 });
  }
}
