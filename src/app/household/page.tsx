import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function HouseholdPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  // 日付計算（理想値の算出用）
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const currentDay = today.getDate();
  const elapsedRate = currentDay / lastDayOfMonth; // 月の経過率 (0.0 - 1.0)

  // 1. 全予算設定の取得
  const allBudgets = await prisma.householdBudget.findMany({
    where: { year, month },
    include: { category: true }
  });
  const totalBudgetAmount = allBudgets
    .filter(b => b.category.parentId === null)
    .reduce((sum, b) => sum + b.amount, 0);

  // 2. 今月の総支出の取得
  const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`);

  const spendings = await prisma.householdSpending.findMany({
    where: {
      date: { gte: monthStart, lt: monthEnd }
    },
    include: { category: true },
    orderBy: { date: 'desc' }
  });
  const totalSpent = spendings.reduce((sum, s) => sum + s.amount, 0);

  // 3. カテゴリ別データの構築
  const allCategories = await prisma.householdCategory.findMany({ orderBy: { id: 'asc' } });
  
  const categoryStats = allCategories
    .filter(c => !c.parentId)
    .map(parent => {
      const children = allCategories.filter(c => c.parentId === parent.id);
      let budgetAmount = 0;
      let spentAmount = 0;
      
      const parentBudgets = allBudgets.filter(b => b.categoryId === parent.id);
      budgetAmount += parentBudgets.reduce((sum, b) => sum + b.amount, 0);
      spentAmount += spendings.filter(s => s.categoryId === parent.id).reduce((sum, s) => sum + s.amount, 0);

      children.forEach(child => {
        const childBudgets = allBudgets.filter(b => b.categoryId === child.id);
        budgetAmount += childBudgets.reduce((sum, b) => sum + b.amount, 0);
        spentAmount += spendings.filter(s => s.categoryId === child.id).reduce((sum, s) => sum + s.amount, 0);
      });

      const idealSpent = budgetAmount * elapsedRate;
      const spentRate = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;
      const idealRatePercent = elapsedRate * 100;
      
      // ステータス判定
      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (spentAmount > budgetAmount) status = 'danger';
      else if (spentAmount > idealSpent * 1.1) status = 'warning';

      let icon = '📦';
      if (parent.name === '朝食・昼食') icon = '☕';
      else if (parent.name === '夕食') icon = '🍱';
      else if (parent.name === '調味料') icon = '🧂';
      else if (parent.name === '嗜好品') icon = '🍫';
      else if (parent.name === '交際費') icon = '🍻';
      else if (parent.name === '食費') icon = '🛒';
      else if (parent.name === '日用品') icon = '🧴';
      else if (parent.name.includes('住居')) icon = '🏠';
      else if (parent.name.includes('通信')) icon = '📱';
      else if (parent.name.includes('光熱')) icon = '⚡';
      else if (parent.name.includes('医療')) icon = '🏥';

      return {
        id: parent.id,
        name: parent.name,
        icon,
        budgetAmount,
        spentAmount,
        idealSpent,
        spentRate,
        idealRatePercent,
        status,
        children: children.map(child => {
          const cBudget = allBudgets.filter(b => b.categoryId === child.id).reduce((sum, b) => sum + b.amount, 0);
          const cSpent = spendings.filter(s => s.categoryId === child.id).reduce((sum, s) => sum + s.amount, 0);
          
          const cIdealSpent = cBudget * elapsedRate;
          const cSpentRate = cBudget > 0 ? (cSpent / cBudget) * 100 : 0;
          let cStatus: 'safe' | 'warning' | 'danger' = 'safe';
          if (cSpent > cBudget) cStatus = 'danger';
          else if (cSpent > cIdealSpent * 1.1) cStatus = 'warning';

          return { 
            id: child.id, 
            name: child.name, 
            budget: cBudget, 
            spent: cSpent,
            idealSpent: cIdealSpent,
            spentRate: cSpentRate,
            status: cStatus
          };
        }).filter(c => c.budget > 0 || c.spent > 0)
      };
    })
    .filter(s => s.budgetAmount > 0 || s.spentAmount > 0);

  const remainingBudget = totalBudgetAmount - totalSpent;
  const totalIdealSpent = totalBudgetAmount * elapsedRate;

  return (
    <div className="max-w-[1600px] mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full tracking-widest uppercase">
              Financial Status
            </span>
            <span className="text-gray-300 font-bold text-xs">{year}年 {month}月期</span>
          </div>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter">
            Budget <span className="text-indigo-600">Analytics</span>
          </h1>
        </div>
        <div className="flex gap-4">
          <Link href="/household/budget" className="group px-8 py-4 bg-white border-2 border-gray-100 rounded-[2rem] text-sm font-black shadow-sm hover:border-indigo-200 transition-all flex items-center gap-2">
            <span className="group-hover:rotate-12 transition-transform">⚖️</span> 予算設定
          </Link>
          <Link href="/entry?mode=expense" className="px-8 py-4 bg-gray-900 text-white rounded-[2rem] text-sm font-black shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2">
            <span>➕</span> 支出を記録
          </Link>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                項目別予算・進捗モニタリング
              </h2>
              <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-gray-100 rounded-full"></span> 予算枠
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full"></span> 現在の支出
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-0.5 h-3 bg-rose-500 rounded-full"></span> 理想値（本日時点）
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {categoryStats.map((stat) => (
                <div key={stat.id} className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-xl shadow-inner border border-gray-100">
                        {stat.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gray-800">{stat.name}</h4>
                        <p className={`text-[10px] font-bold tracking-widest uppercase ${
                          stat.status === 'danger' ? 'text-rose-500' : 
                          stat.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {stat.status === 'danger' ? 'Over Budget' : 
                           stat.status === 'warning' ? 'Over Pace' : 'On Track'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-900 italic">¥{stat.spentAmount.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-gray-300">Target: ¥{stat.budgetAmount.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Meter with Ideal Marker */}
                  <div className="relative pt-2 group cursor-pointer">
                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-gray-900 text-white text-[10px] font-bold rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-400">理想値: ¥{Math.floor(stat.idealSpent).toLocaleString()}</span>
                        <span className={stat.spentAmount > stat.idealSpent ? 'text-rose-400' : 'text-emerald-400'}>
                          {stat.spentAmount > stat.idealSpent 
                            ? `超過: +¥${Math.floor(stat.spentAmount - stat.idealSpent).toLocaleString()}` 
                            : `余裕: -¥${Math.floor(stat.idealSpent - stat.spentAmount).toLocaleString()}`}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>

                    <div className="h-3 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                      <div 
                        style={{ width: `${Math.min(100, stat.spentRate)}%` }}
                        className={`h-full transition-all duration-1000 ${
                          stat.status === 'danger' ? 'bg-rose-500' : 
                          stat.status === 'warning' ? 'bg-amber-400' : 'bg-indigo-600'
                        }`}
                      ></div>
                    </div>
                    {/* Ideal Value Marker */}
                    <div 
                      className="absolute top-0 w-1 h-6 bg-rose-500 rounded-full shadow-lg transition-all duration-1000 z-20"
                      style={{ left: `${stat.idealRatePercent}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-rose-500 whitespace-nowrap">IDEAL</div>
                    </div>
                  </div>
                  
                  {/* Pace Info */}
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Efficiency</span>
                    <span className={`text-[10px] font-black italic ${
                      stat.spentAmount > stat.idealSpent ? 'text-rose-500' : 'text-emerald-600'
                    }`}>
                      {stat.spentAmount > stat.idealSpent 
                        ? `理想値より +¥${Math.floor(stat.spentAmount - stat.idealSpent).toLocaleString()} 超過` 
                        : `理想値まであと ¥${Math.floor(stat.idealSpent - stat.spentAmount).toLocaleString()} 余裕`}
                    </span>
                  </div>

                  {/* Subcategories (if any) */}
                  {stat.children.length > 0 && (
                    <div className="pl-4 mt-3 space-y-3 border-l-2 border-gray-100">
                      {stat.children.map(child => (
                        <div key={child.id} className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-gray-500">{child.name}</span>
                            <span className="text-[11px] font-black text-gray-700 italic">
                              ¥{child.spent.toLocaleString()} <span className="text-[9px] font-normal text-gray-400">/ ¥{child.budget.toLocaleString()}</span>
                            </span>
                          </div>
                          <div className="relative pt-1 group cursor-pointer">
                            {/* Subcategory Hover Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-max px-2 py-1.5 bg-gray-800 text-white text-[9px] font-bold rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                              <div className="flex flex-col">
                                <span className="text-gray-300">理想値: ¥{Math.floor(child.idealSpent).toLocaleString()}</span>
                                <span className={child.spent > child.idealSpent ? 'text-rose-400' : 'text-emerald-400'}>
                                  {child.spent > child.idealSpent 
                                    ? `超過: +¥${Math.floor(child.spent - child.idealSpent).toLocaleString()}` 
                                    : `余裕: -¥${Math.floor(child.idealSpent - child.spent).toLocaleString()}`}
                                </span>
                              </div>
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                            </div>

                            <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                              <div 
                                style={{ width: `${Math.min(100, child.spentRate)}%` }}
                                className={`h-full transition-all duration-1000 ${
                                  child.status === 'danger' ? 'bg-rose-400' : 
                                  child.status === 'warning' ? 'bg-amber-300' : 'bg-indigo-400'
                                }`}
                              ></div>
                            </div>
                            {/* Subcategory Ideal Marker */}
                            <div 
                              className="absolute top-0 w-0.5 h-3.5 bg-rose-400 rounded-full z-20"
                              style={{ left: `${stat.idealRatePercent}%`, transform: 'translateX(-50%)' }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Total Summary Card */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-gray-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden min-h-[400px] flex flex-col justify-between">
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-600/30 rounded-full blur-3xl -mb-24 -mr-24"></div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">Monthly Consolidation</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 mb-1">Total Expenditure</p>
                  <p className="text-5xl font-black italic tracking-tighter">¥{totalSpent.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Current Progress</p>
                    <p className="text-xl font-black italic">{Math.floor((totalSpent / totalBudgetAmount) * 100)}%</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Elapsed Time</p>
                    <p className="text-xl font-black italic text-indigo-400">{Math.floor(elapsedRate * 100)}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Available Balance</p>
                  <p className={`text-3xl font-black italic ${remainingBudget < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                    ¥{remainingBudget.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-1">Monthly Budget</p>
                  <p className="text-sm font-bold opacity-60">¥{totalBudgetAmount.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-4 bg-white/10 rounded-full overflow-hidden relative">
                <div 
                  style={{ width: `${Math.min(100, (totalSpent / totalBudgetAmount) * 100)}%` }}
                  className={`h-full transition-all duration-1000 ${totalSpent > totalIdealSpent ? 'bg-rose-500' : 'bg-indigo-500'}`}
                ></div>
                {/* Global Ideal Marker */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-white/40 z-10"
                  style={{ left: `${elapsedRate * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
              {totalSpent > totalIdealSpent ? '⚠️' : '🎯'}
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-widest mb-1">Financial Insight</h4>
              <p className="text-xs font-bold leading-relaxed opacity-90">
                {totalSpent > totalIdealSpent 
                  ? `理想的なペースを ¥${Math.floor(totalSpent - totalIdealSpent).toLocaleString()} 上回っています。後半戦の引き締めが必要です。`
                  : `非常に優秀なペースです！月末までこの調子なら、¥${Math.floor(remainingBudget * (1 - elapsedRate)).toLocaleString()} 以上の貯蓄が期待できます。`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-gray-100">
        <div className="flex justify-between items-center mb-8 px-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center text-sm italic">Hst</span>
            Spending History
          </h2>
          <Link href={`/household/spending?year=${year}&month=${month}`} className="text-xs font-black text-indigo-600 hover:tracking-widest transition-all uppercase tracking-wider">
            View All Transactions →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-50">
                <th className="px-6 py-4 text-left">Date</th>
                <th className="px-6 py-4 text-left">Category</th>
                <th className="px-6 py-4 text-left">Description</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {spendings.slice(0, 10).map((s) => (
                <tr key={s.id} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-5 text-sm font-bold text-gray-400">
                    {s.date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}
                  </td>
                  <td className="px-6 py-5">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                      {s.category.name}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-sm font-black text-gray-800">
                    {s.description || '---'}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="text-lg font-black text-gray-900 italic">¥{s.amount.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
              {spendings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="text-4xl mb-4 grayscale opacity-20">💸</div>
                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No Transactions Found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
