import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, message: '無効なデータ形式です' }, { status: 400 });
    }

    // 在庫を更新（upsert）
    // シンプルにするため、同じ名前の食材があれば加算、なければ作成する
    for (const item of items) {
      // 在庫利用（price=0）のものはスキップ（既に在庫にあるはず）
      if (item.totalPrice === 0) continue;

      await prisma.inventory.upsert({
        where: { name: item.name },
        update: {
          // 本来は分量をパースして加算すべきだが、一旦「1単位」として更新
          quantity: { increment: 1 },
          updatedAt: new Date(),
        },
        create: {
          name: item.name,
          quantity: 1,
          unit: item.quantity.includes('/') ? 'セット' : (item.quantity || '個'),
          updatedAt: new Date(),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Inventory Sync Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const inventory = await prisma.inventory.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    return NextResponse.json({ success: true, inventory });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
