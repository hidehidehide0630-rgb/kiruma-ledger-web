import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HouseholdLogic } from '@/lib/logic/household';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { days, budget, startDate, inventoryText, includeFavorites } = await req.json();

    // 1. 在庫情報の更新（画面의 入力内容でDBを完全に同期する）
    // 社長の最新の冷蔵庫状況を反映するため、一旦クリア
    await prisma.inventory.deleteMany({});
    
    if (inventoryText && inventoryText.trim() !== '') {
        const lines = inventoryText.split('\n').filter((l: string) => l.trim() !== '');
        
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

    const start = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // daysが未指定の場合は、今週の日曜日までの日数を計算
    const calculatedDays = days || (7 - ((today.getDay() + 6) % 7));

    // 2. 既存の（未実施の）献立を一旦クリア（今日以降をすべて削除して整合性を保つ）
    await prisma.mealPlan.deleteMany({
        where: {
            date: { gte: today }
        }
    });

    // 2. 献立生成ロジックの実行
    const { dailyPlans, weeklyBatchMissions } = await HouseholdLogic.generateMenu({
      days: calculatedDays,
      tripBudget: budget || 15000,
      startDate: start,
      vitalityMode: true, // デフォルトON
      includeFavorites: includeFavorites || false
    });

    // 3. データベースへの保存（ミッションのクリア）
    await prisma.batchMission.deleteMany({
        where: {
            date: { gte: start }
        }
    });

    for (const item of dailyPlans) {
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

    // ミッションの保存
    for (const mission of weeklyBatchMissions) {
        const missionDate = new Date(start);
        missionDate.setDate(start.getDate() + (mission.day - 1));
        await prisma.batchMission.create({
            data: {
                day: mission.day,
                name: mission.missionName,
                instructions: mission.instructions,
                ingredients: mission.ingredients,
                date: missionDate
            }
        });
    }

    return NextResponse.json({ success: true, count: dailyPlans.length });
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
