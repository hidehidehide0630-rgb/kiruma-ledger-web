import React from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function MealManagementPage() {
  const today = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(today.getDate() + 14); // 2週間分表示

  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      date: { gte: today, lte: weekEnd }
    },
    include: { recipe: true },
    orderBy: { date: 'asc' }
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Meal Planner</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1 italic">
            🍳 献立・食事管理 <span className="mx-2">|</span> AIパーソナルシェフ
          </p>
        </div>
        <Link href="/household/setup" className="px-6 py-3 bg-pink-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-pink-100 hover:scale-[1.02] active:scale-95 transition-all">
          新しい献立を生成
        </Link>
      </div>

      {/* 今後の献立リスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {mealPlans.length > 0 ? (
          mealPlans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100 hover:border-pink-200 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] font-black uppercase text-pink-500 tracking-widest mb-1 italic">
                      {plan.date.toLocaleDateString('ja-JP', { weekday: 'long' })}
                    </p>
                    <p className="text-lg font-black text-gray-800 tracking-tighter">
                      {plan.date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-2xl">🍱</span>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-4 leading-tight">
                  {plan.recipe.name}
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                    <span>Estimated Cost</span>
                    <span className="text-gray-900 font-black italic">¥{plan.recipe.estimatedPrice.toLocaleString()}</span>
                  </div>
                  
                  {plan.recipe.ingredients && (
                    <div className="pt-4 border-t border-gray-50">
                      <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest mb-2">Key Ingredients</p>
                      <p className="text-xs text-gray-500 leading-relaxed truncate">
                        {String(plan.recipe.ingredients)}
                      </p>
                    </div>
                  )}
                </div>

                <button className="w-full mt-8 py-3 rounded-xl bg-gray-50 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-pink-600 hover:text-white transition-all">
                  View Recipe Details
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100">
            <div className="text-6xl mb-6 grayscale opacity-20">🍳</div>
            <h3 className="text-2xl font-black text-gray-300 tracking-tighter uppercase mb-4">No Meal Plans Found</h3>
            <p className="text-gray-400 max-w-md mx-auto mb-10 font-bold">
              AI献立エンジンがまだ稼働していません。予算と期間を設定して、あなたに最適な献立を生成しましょう。
            </p>
            <Link href="/household/setup" className="inline-block px-10 py-4 bg-gray-900 text-white rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-sm">
              Launch AI Generator
            </Link>
          </div>
        )}
      </div>

      {/* Vitality Focus Section */}
      <div className="bg-gradient-to-br from-gray-900 to-indigo-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="px-4 py-1.5 bg-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 border border-indigo-400/30">Health Optimization</span>
            <h2 className="text-4xl font-black mt-6 tracking-tighter leading-tight">
              テストステロン値を最大化する<br />「バイタリティ献立」
            </h2>
            <p className="mt-6 text-gray-400 font-bold leading-relaxed">
              BlueReturnのAIシェフは、単なる栄養バランスだけでなく、血管健康（NO産生）やホルモンバランスを考慮した食材を優先的に選定します。
              現在、亜鉛・マグネシウム・ビタミンDの最適化モードが有効です。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Energy Focus', value: 'High', color: 'bg-emerald-500' },
              { label: 'Vitality Score', value: '88/100', color: 'bg-indigo-500' },
              { label: 'NO Production', value: 'Optimized', color: 'bg-rose-500' },
              { label: 'Recovery', value: 'Targeted', color: 'bg-amber-500' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${stat.color}`}></div>
                  <p className="text-lg font-black italic">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
