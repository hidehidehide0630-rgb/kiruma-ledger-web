import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function HouseholdSpendingHistoryPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; categoryId?: string };
}) {
  const today = new Date();
  const year = searchParams.year ? parseInt(searchParams.year) : today.getFullYear();
  const month = searchParams.month ? parseInt(searchParams.month) : today.getMonth() + 1;
  const categoryId = searchParams.categoryId ? parseInt(searchParams.categoryId) : undefined;

  // 日本時間(JST)での月初のUTC日時を計算
  const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+09:00`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`);

  const spendings = await prisma.householdSpending.findMany({
    where: {
      date: { 
        gte: monthStart,
        lt: monthEnd
      },
      categoryId: categoryId // undefinedの場合は無視される（Prismaの仕様）
    },
    include: {
      category: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  const categoryName = categoryId && spendings.length > 0 ? spendings[0].category.name : null;

  const totalAmount = spendings.reduce((sum, s) => sum + s.amount, 0);

  // 前月・次月の計算
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonthVal = month === 12 ? 1 : month + 1;
  const nextYearVal = month === 12 ? year + 1 : year;

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <Link href="/household" className="inline-flex items-center text-[10px] font-black text-pink-600 uppercase tracking-[0.2em] hover:opacity-70 mb-3 transition-opacity">
            <span className="mr-1">←</span> Back to Dashboard
          </Link>
          <h1 className="text-5xl font-black text-gray-900 tracking-tighter">
            {categoryName ? `${categoryName} Details` : 'Spending Details'}
          </h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-2 italic flex items-center">
             {categoryName ? `${categoryName} の支出履歴` : '支出履歴詳細'} 
             <span className="mx-3 opacity-30 text-gray-300">/</span> {year}年{month}月
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/50 ring-1 ring-black/5">
          <Link 
            href={`/household/spending?year=${prevYear}&month=${prevMonth}`}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-md transition-all active:scale-90"
          >
            <span className="text-gray-400 font-bold">◀</span>
          </Link>
          <div className="px-6 py-1 text-center min-w-[120px]">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-1">Current Period</p>
            <p className="text-lg font-black text-gray-800 leading-none">{year} / {month}</p>
          </div>
          <Link 
            href={`/household/spending?year=${nextYearVal}&month=${nextMonthVal}`}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-md transition-all active:scale-90"
          >
            <span className="text-gray-400 font-bold">▶</span>
          </Link>
        </div>
      </div>

      {/* Summary Stat Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-125"></div>
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
            <h3 className="text-[10px] font-black uppercase text-pink-400 tracking-[0.2em]">Total Monthly Expenditure</h3>
            <div className="flex items-baseline gap-4 mt-4">
              <span className="text-7xl font-black italic tracking-tighter">¥{totalAmount.toLocaleString()}</span>
              <span className="text-sm font-bold opacity-40 uppercase tracking-widest">Confirmed JPY</span>
            </div>
            <div className="mt-8 flex gap-6 border-t border-white/10 pt-6">
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase">Records</p>
                <p className="text-xl font-black">{spendings.length} items</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase">Daily Average</p>
                <p className="text-xl font-black italic">¥{Math.floor(totalAmount / 30).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Placeholder for AI Insight or Most Spent Category */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl mb-4 backdrop-blur-xl border border-white/10">
              💎
            </div>
            <h3 className="text-[10px] font-black uppercase text-indigo-200 tracking-[0.2em] mb-2">Top Spending Category</h3>
            <p className="text-2xl font-black">
              {spendings.length > 0 
                ? [...new Set(spendings.map(s => s.category.name))][0] // Simple placeholder for most spent
                : 'N/A'}
            </p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/30 overflow-hidden ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-10 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Timeline</th>
                <th className="px-6 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Category</th>
                <th className="px-6 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Description</th>
                <th className="px-10 py-6 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {spendings.map((s, idx) => (
                <tr key={s.id} className="hover:bg-white/80 transition-all duration-300 group">
                  <td className="px-10 py-6 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900">
                        {s.date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                        {s.date.toLocaleDateString('ja-JP', { weekday: 'long' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-xl shadow-inner border border-gray-100 group-hover:scale-110 transition-transform">
                        {s.category.icon || '📦'}
                      </div>
                      <span className="text-sm font-black text-gray-700 tracking-tight">{s.category.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-sm font-bold text-gray-500 leading-relaxed">
                      {s.description || <span className="opacity-20 italic">No description</span>}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right whitespace-nowrap">
                    <span className="text-2xl font-black italic text-gray-900 group-hover:text-pink-600 transition-colors">
                      ¥{s.amount.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
              
              {spendings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-10 py-32 text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-3xl mb-6 text-gray-300 shadow-inner">
                        📭
                      </div>
                      <p className="text-xs font-black text-gray-300 uppercase tracking-[0.3em] italic">No transaction data discovered</p>
                      <Link href="/entry?mode=expense" className="mt-8 px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg">
                        Record First Expense
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Footer / Back link */}
      <div className="flex justify-center pb-10">
        <Link href="/household" className="px-10 py-4 bg-white border border-gray-100 rounded-3xl text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
