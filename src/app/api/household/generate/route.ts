import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HouseholdLogic } from '@/lib/logic/household';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { days, budget, startDate, inventoryText } = await req.json();

    // 1. 在庫情報の更新（入力がある場合）
    if (inventoryText) {
        const lines = inventoryText.split('\n').filter((l: string) => l.trim() !== '');
        // 社長の最新の冷蔵庫状況を反映するため、一旦クリアして再登録
        await prisma.inventory.deleteMany({});
        
        for (const line of lines) {
            const [name, quantityPart] = line.split(/[:：]/).map((s: string) => s.trim());
            if (name) {
                // 数量部分から数値と単位を抽出
                const quantityMatch = (quantityPart || '').match(/([0-9.]+)?(.*)/);
                const quantity = quantityMatch ? parseFloat(quantityMatch[1]) || 0 : 0;
                const unit = quantityMatch ? quantityMatch[2].trim() : '';

                await prisma.inventory.create({
                    data: {
                        name,
                        quantity,
                        unit: unit || '個' // デフォルト単位
                    }
                });
            }
        }
    }

    // 2. 既存の（未実施の）献立を一旦クリア（上書き前提）
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
    for (const item of generatedMenu) {
        try {
            // レシピの保存（IDが衝突した場合は更新）
            await prisma.recipe.upsert({
                where: { id: item.recipe.id },
                update: {
                    name: item.recipe.name,
                    estimatedPrice: item.recipe.estimatedPrice,
                    ingredients: item.recipe.ingredients,
                    instructions: item.recipe.instructions,
                },
                create: {
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
        } catch (dbError) {
            console.error('Database save error for item:', item.recipe.id, dbError);
            throw new Error(`データベースの保存中にエラーが発生しました: ${item.recipe.id}`);
        }
    }

    return NextResponse.json({ success: true, count: generatedMenu.length });
  } catch (error: any) {
    console.error('--- Generation API error details ---');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '予期せぬエラーが発生しました。' 
    }, { status: 500 });
  }
}
