import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const favorites = await prisma.recipe.findMany({
      where: {
        isFavorite: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(favorites);
  } catch (error: any) {
    console.error('Failed to fetch favorite recipes:', error);
    return NextResponse.json(
      { error: 'お気に入りレシピの取得に失敗しました。' },
      { status: 500 }
    );
  }
}
