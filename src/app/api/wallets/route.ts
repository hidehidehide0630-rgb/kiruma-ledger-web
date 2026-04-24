import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const wallets = await prisma.wallet.findMany({
      include: {
        account: true
      }
    });
    return NextResponse.json(wallets);
  } catch (error) {
    console.error('Failed to fetch wallets:', error);
    return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
  }
}
