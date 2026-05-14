import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // 今月の日数
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const daysRemainingInMonth = lastDayOfMonth - day + 1;

    // 今週の日曜日（週の終わり）までの日数 (月-日サイクル)
    // getDay(): 0(日), 1(月), ..., 6(土)
    // 月=7, 火=6, ..., 日=1 となるように計算
    const dayOfWeek = now.getDay();
    const daysUntilSunday = 7 - ((dayOfWeek + 6) % 7);

    // カテゴリ定義
    // 11: 朝食・昼食
    const categories = [
      { id: 11, name: '朝食・昼食' }
    ];

    const recommendations = await Promise.all(categories.map(async (cat) => {
      // 予算の取得
      const budget = await prisma.householdBudget.findUnique({
        where: {
          year_month_categoryId: {
            year,
            month,
            categoryId: cat.id
          }
        }
      });
      const budgetAmount = budget?.amount || 0;

      // 支出の取得
      const spendings = await prisma.householdSpending.findMany({
        where: {
          date: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1)
          },
          categoryId: cat.id
        }
      });
      const spentAmount = spendings.reduce((sum, s) => sum + s.amount, 0);

      const remaining = Math.max(0, budgetAmount - spentAmount);
      const daily = daysRemainingInMonth > 0 ? Math.floor(remaining / daysRemainingInMonth) : 0;

      return {
        categoryId: cat.id,
        name: cat.name,
        totalBudget: budgetAmount,
        totalSpent: spentAmount,
        remainingBudget: remaining,
        dailyRecommended: daily,
        weeklyRecommended: daily * daysUntilSunday
      };
    }));

    return NextResponse.json({
      year,
      month,
      daysRemainingInMonth,
      daysUntilSunday,
      recommendations
    });
  } catch (error: any) {
    console.error('Recommendation API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
