import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { isDeleted: false },
      select: { description: true },
      distinct: ['description'],
      orderBy: { date: 'desc' },
      take: 50,
    });
    
    return NextResponse.json(transactions.map(t => t.description));
  } catch (error) {
    console.error('Fetch descriptions error:', error);
    return NextResponse.json({ error: 'Failed to fetch descriptions' }, { status: 500 });
  }
}
