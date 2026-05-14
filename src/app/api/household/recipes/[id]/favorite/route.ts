import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { isFavorite } = await req.json();
    const id = params.id;

    const updated = await prisma.recipe.update({
      where: { id },
      data: { isFavorite }
    });

    return NextResponse.json({ success: true, isFavorite: updated.isFavorite });
  } catch (error: any) {
    console.error('Failed to update favorite status:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
