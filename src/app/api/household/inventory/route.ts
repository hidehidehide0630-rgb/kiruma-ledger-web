import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { name, quantity, unit } = await req.json();
    const item = await prisma.inventory.upsert({
      where: { name },
      update: {
        quantity: { increment: quantity },
        unit: unit || '個'
      },
      create: {
        name,
        quantity,
        unit: unit || '個'
      }
    });
    return NextResponse.json(item);
  } catch (error: any) {
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
