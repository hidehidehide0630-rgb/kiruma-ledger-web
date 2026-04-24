import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 監査結果（未読のものや最新のもの）を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const reviews = await prisma.auditReview.findMany({
      where: unreadOnly ? { isRead: false } : {},
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching audit reviews:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST: 監査結果を論理上の「既読」にする
export async function PUT(request: Request) {
  try {
    const { id } = await request.json();
    await prisma.auditReview.update({
      where: { id: Number(id) },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating audit review:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
