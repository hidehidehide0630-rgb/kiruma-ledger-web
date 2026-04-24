import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { HouseholdLogic } from '@/lib/logic/household';

export default async function HouseholdPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  // 1. 全予算設定の取得
  const allBudgets = await prisma.householdBudget.findMany({
    where: { year, month },
    include: { category: true }
  });
  const totalBudgetAmount = allBudgets.reduce((sum, b) => sum + b.amount, 0);

  // 2. 今月の総支出の取得（カテゴリ別集計を含む）
  const monthStart = new Date(year, month - 1, 1);
  const spendings = await prisma.householdSpending.findMany({
    where: {
      date: { gte: monthStart }
    },
    include: { category: true }
  });
  const totalSpent = spendings.reduce((sum, s) => sum + s.amount, 0);

  // 3. 進捗データの構築（親子関係を考慮した集計）
  const allCategories = await prisma.householdCategory.findMany({ orderBy: { id: 'asc' } });
  
  const categoryStats = allCategories
    .filter(c => !c.parentId) // まず親（または単体）を抽出
    .map(parent => {
      const children = allCategories.filter(c => c.parentId === parent.id);
      const isGroup = children.length > 0;
      
      let amount = 0;
      let spent = 0;
      
      if (isGroup) {
        // 子カテゴリーの合計を算出
        children.forEach(child => {
          const b = allBudgets.find(b => b.categoryId === child.id);
          amount += b ? b.amount : 0;
          spent += spendings
            .filter(s => s.categoryId === child.id)
            .reduce((sum, s) => sum + s.amount, 0);
        });
      } else {
        // 単体項目の場合
        const b = allBudgets.find(b => b.categoryId === parent.id);
        amount = b ? b.amount : 0;
        spent = spendings
          .filter(s => s.categoryId === parent.id)
          .reduce((sum, s) => sum + s.amount, 0);
      }
        
      const percent = Math.min(100, amount > 0 ? (spent / amount) * 100 : (spent > 0 ? 100 : 0));
      const isOver = amount > 0 ? (spent > amount) : (spent > 0);
      const isWarning = amount > 0 && (spent > amount * 0.8);
      
      let icon = '📦';
      if (parent.name === '朝食・昼食') icon = '☕';
      else if (parent.name === '夕食') icon = '🍱';
      else if (parent.name === '調味料') icon = '🧂';
      else if (parent.name === '嗜好品') icon = '🍫';
      else if (parent.name === '交際費') icon = '🍻';
      else if (parent.name === '雑費') icon = '💠';
      else if (parent.name === '食費') icon = '🛒';
      else if (parent.name === '日用品') icon = '🧴';

      return {
        categoryId: parent.id,
        name: parent.name,
        amount,
        spent,
        percent,
        isOver,
        isWarning,
        icon,
        isGroup,
        children: children.map(child => {
           const b = allBudgets.find(b => b.categoryId === child.id);
           const cAmount = b ? b.amount : 0;
           const cSpent = spendings
            .filter(s => s.categoryId === child.id)
            .reduce((sum, s) => sum + s.amount, 0);
           return {
             id: child.id,
             name: child.name,
             amount: cAmount,
             spent: cSpent,
             percent: Math.min(100, cAmount > 0 ? (cSpent / cAmount) * 100 : (cSpent > 0 ? 100 : 0))
           };
        })
      };
    })
    .filter(stat => stat.amount > 0 || stat.spent > 0);

  // 4. 今週の献立取得
  const weekEnd = new Date();
  weekEnd.setDate(today.getDate() + 7);
  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      date: { gte: today, lte: weekEnd }
    },
    include: { recipe: true },
    orderBy: { date: 'asc' }
  });

  const remainingBudget = totalBudgetAmount - totalSpent;
  const progressPercent = totalBudgetAmount > 0 ? Math.min(100, (totalSpent / totalBudgetAmount) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Household & Menu</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1 italic">
            🏡 家計・献立マネージャー <span className="mx-2">|</span> {year}年{month}月の状況
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/household/setup" className="px-6 py-3 bg-pink-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-pink-100 hover:scale-[1.02] active:scale-95 transition-all">
            献立を自動生成
          </Link>
          <Link href="/entry?mode=expense" className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl text-sm font-black shadow-sm hover:bg-gray-50 active:scale-95 transition-all">
            支出を記録
          </Link>
        </div>
      </div>

      {/* 統合予算ダッシュボード */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* メイン進捗 (Total) */}
        <div className="xl:col-span-1 bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[320px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div>
            <h3 className="text-[10px] font-black uppercase text-pink-400 tracking-[0.2em] mb-4">Total Budget Status</h3>
            <div className="space-y-1">
              <p className="text-sm font-bold opacity-60">今月の総支出</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black italic">¥{totalSpent.toLocaleString()}</span>
                <span className="text-xs opacity-40 font-bold">/ ¥{totalBudgetAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="h-4 bg-white/10 rounded-full flex overflow-hidden">
              <div 
                style={{ width: `${progressPercent}%` }} 
                className={`transition-all duration-1000 ${progressPercent > 90 ? 'bg-rose-500' : 'bg-pink-500'}`}
              ></div>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs font-bold opacity-60 uppercase">Remaining</p>
              <p className="text-xl font-black italic text-pink-400">¥{remainingBudget.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* カテゴリ別マルチ進捗 (Multi Progress List) */}
        <div className="xl:col-span-2 bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-white/20">
          <div className="flex justify-between items-center mb-6 px-2">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">All Categories Progress</h3>
              <span className="text-[8px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold">HIERARCHY VIEW</span>
            </div>
            <Link href="/household/budget" className="text-[10px] font-black text-indigo-600 hover:underline tracking-widest">EDIT BUDGET</Link>
          </div>
          
          <div className="space-y-6 max-h-[350px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {categoryStats.map((stat) => (
              <div key={stat.categoryId} className="space-y-3">
                {/* 親項目 */}
                <div className="group">
                  <div className="flex justify-between items-end mb-1 px-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-inner border ${stat.isGroup ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
                        {stat.icon}
                      </div>
                      <span className="text-sm font-black text-gray-700">
                        {stat.name}
                        {stat.isGroup && <span className="ml-2 text-[8px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded italic uppercase">Group</span>}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className={`text-sm font-black ${stat.isOver ? 'text-rose-500' : 'text-gray-900'}`}>
                          ¥{stat.spent.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400">
                          / ¥{stat.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`h-2 w-full rounded-full overflow-hidden flex ${stat.isGroup ? 'bg-indigo-50' : 'bg-gray-100'}`}>
                    <div 
                      style={{ width: `${stat.percent}%` }}
                      className={`h-full transition-all duration-1000 ${
                        stat.isOver ? 'bg-rose-500' : 
                        stat.isWarning ? 'bg-amber-500' : stat.isGroup ? 'bg-indigo-600' : 'bg-indigo-500'
                      }`}
                    ></div>
                  </div>
                </div>

                {/* 子項目（表示がある場合のみ、少しコンパクトに） */}
                {stat.isGroup && (
                  <div className="pl-11 pr-2 space-y-2 border-l-2 border-indigo-50 ml-4">
                    {stat.children.filter(c => c.amount > 0 || c.spent > 0).map(child => (
                      <div key={child.id} className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-gray-400">{child.name}</span>
                          <span className="text-gray-500">¥{child.spent.toLocaleString()} / <span className="text-gray-300">¥{child.amount.toLocaleString()}</span></span>
                        </div>
                        <div className="h-1 w-full bg-gray-50 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${child.percent}%` }}
                            className="h-full bg-indigo-300 transition-all duration-1000"
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {categoryStats.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No Categories Found</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Insight (Right Side) */}
        <div className="xl:col-span-1 bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-[10px] font-black uppercase text-indigo-300 tracking-[0.2em] mb-4">AI Advisor</h3>
            <p className="text-sm font-bold leading-relaxed mb-6 italic">
              {progressPercent > 80 
                ? "今月は予算の8割を消費しています。外食を控え、冷蔵庫の余り物で献立を組むのが吉です。"
                : "予算内に収まっています。現在のペースを維持しましょう！明日は少し豪華な食材を使っても大丈夫そうです。"}
            </p>
          </div>
          <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💡</span>
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Recommended Next Purchase</p>
            </div>
            <p className="text-2xl font-black italic">¥{Math.max(0, Math.floor(remainingBudget / 4)).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* セクション: 今週の献立 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <span className="mr-2">📅</span> 今週の献立プラン
            </h2>
            <Link href="/household/meals" className="text-sm text-pink-600 hover:underline">すべて表示</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {mealPlans.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {mealPlans.map((plan) => (
                  <li key={plan.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">{plan.date.toLocaleDateString('ja-JP', { weekday: 'short', month: 'numeric', day: 'numeric' })}</p>
                        <h4 className="font-medium text-gray-900">{plan.recipe.name}</h4>
                      </div>
                      <span className="text-sm font-mono text-gray-500">¥{plan.recipe.estimatedPrice}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-400 mb-4">献立が作成されていません</p>
                <button className="px-4 py-2 bg-pink-50 text-pink-600 rounded-lg text-sm font-bold border border-pink-100 hover:bg-pink-100">
                  AIで献立を作成する
                </button>
              </div>
            )}
          </div>
        </section>

        {/* セクション: 最近の支出 */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <span className="mr-2">💸</span> 最近の支出
            </h2>
            <Link href="/household/spending" className="text-sm text-gray-500 hover:underline">履歴詳細</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日付</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内容</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">金額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {spendings.slice(0, 5).map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{s.date.toLocaleDateString('ja-JP')}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.description || s.category.name}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">¥{s.amount.toLocaleString()}</td>
                  </tr>
                ))}
                {spendings.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-gray-400">データがありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
