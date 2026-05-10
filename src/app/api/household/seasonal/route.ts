import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const currentMonth = new Date().getMonth() + 1;
    
    // 旬の食材と、活力食材（isVitality: true）を優先的に取得
    const ingredients = await prisma.ingredientMaster.findMany({
      orderBy: [
        { isVitality: 'desc' },
        { name: 'asc' }
      ]
    });

    // 今月が旬に含まれるもの、または通年(1-12月)のもの
    const seasonal = ingredients.filter(i => i.seasonalMonths.includes(currentMonth));
    
    return NextResponse.json(seasonal);
  } catch (error) {
    console.error('Failed to fetch seasonal ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
