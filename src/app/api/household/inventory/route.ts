import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 単一アイテムか複数アイテムかの判定
    const items = body.items ? body.items : [body];
    
    const results = [];
    for (const itemData of items) {
      const { name, quantity } = itemData;
      
      // 数量が文字列の場合（'100g'など）は数値を抽出、そうでなければデフォルト1
      let numericQuantity = 1;
      if (typeof quantity === 'number') {
        numericQuantity = quantity;
      } else if (typeof quantity === 'string') {
        const match = quantity.match(/(\d+(\.\d+)?)/);
        if (match) numericQuantity = parseFloat(match[1]);
      }

      const item = await prisma.inventory.upsert({
        where: { name },
        update: {
          quantity: { increment: numericQuantity },
          lastUsed: new Date()
        },
        create: {
          name,
          quantity: numericQuantity,
          unit: (typeof quantity === 'string' ? quantity.replace(/[\d.]/g, '') : '個') || '個'
        }
      });
      results.push(item);
    }
    
    return NextResponse.json(body.items ? { success: true, count: results.length } : results[0]);
  } catch (error: any) {
    console.error('Inventory API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID is required');
    await prisma.inventory.delete({
      where: { id: parseInt(id) }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const items = await prisma.inventory.findMany({
    orderBy: { updatedAt: 'desc' }
  });
  return NextResponse.json(items);
}
