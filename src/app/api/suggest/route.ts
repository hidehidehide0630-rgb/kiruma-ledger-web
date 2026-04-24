import { NextResponse } from 'next/server';
import { suggestAccountFromHistoryOrKeyword } from '@/lib/logic/account_suggester';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const suggestion = await suggestAccountFromHistoryOrKeyword(q);
    return NextResponse.json(suggestion);
  } catch (error) {
    console.error('Suggestion API Error:', error);
    return NextResponse.json({ error: 'Failed to suggest account' }, { status: 500 });
  }
}
