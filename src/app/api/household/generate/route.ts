import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HouseholdLogic } from '@/lib/logic/household';

export async function POST(req: NextRequest) {
  try {
    const { days, budget, startDate } = await req.json();

    // 1. 既存の（未実施の）献立を一旦クリア（上書き前提）
    // 実際には特定期間のみ削除するなど調整が必要
    await prisma.mealPlan.deleteMany({
        where: {
            date: { gte: new Date(startDate) }
        }
    });

    // 2. 献立生成ロジックの実行
    const generatedMenu = await HouseholdLogic.generateMenu({
      days: days || 7,
      tripBudget: budget || 15000,
      startDate: new Date(startDate),
      vitalityMode: true // デフォルトON
    });

    // 3. データベースへの保存
    // トランザクションで保存
    for (const item of generatedMenu) {
        // 先に生成されたレシピをDBに保存する
        await prisma.recipe.create({
            data: {
                id: item.recipe.id,
                name: item.recipe.name,
                estimatedPrice: item.recipe.estimatedPrice,
                ingredients: item.recipe.ingredients,
                instructions: item.recipe.instructions,
                isFavorite: false
            }
        });

        await prisma.mealPlan.create({
            data: {
                date: item.date,
                recipeId: item.recipe.id
            }
        });
    }

    return NextResponse.json({ success: true, count: generatedMenu.length });
  } catch (error: any) {
    console.error('Generation API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
