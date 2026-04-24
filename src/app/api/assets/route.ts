import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  if (!(prisma as any).fixedAsset) {
    return NextResponse.json({ error: 'Prisma client out of sync. Please restart server.' }, { status: 500 });
  }
  try {
    const assets = await prisma.fixedAsset.findMany({
      where: { isDeleted: false },
      orderBy: { purchaseDate: 'desc' },
    });
    return NextResponse.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(prisma as any).fixedAsset) {
    return NextResponse.json({ error: 'Prisma client out of sync. Please restart server.' }, { status: 500 });
  }
  try {
    const { name, purchaseDate, purchasePrice, usefulLife } = await request.json();

    if (!name || !purchaseDate || !purchasePrice || !usefulLife) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const asset = await prisma.fixedAsset.create({
      data: {
        name,
        purchaseDate: new Date(purchaseDate),
        purchasePrice: parseInt(purchasePrice),
        usefulLife: parseInt(usefulLife),
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}
