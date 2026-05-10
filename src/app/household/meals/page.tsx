import RecipeViewButton from '@/components/meals/RecipeViewButton';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

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

  // 買い物リストと合計金額の集計
  let totalCost = 0;
  const shoppingListMap = new Map<string, string[]>();

  mealPlans.forEach(plan => {
    totalCost += plan.recipe.estimatedPrice;
    
    if (plan.recipe.ingredients) {
      try {
        const parsed = JSON.parse(plan.recipe.ingredients);
        if (Array.isArray(parsed)) {
          parsed.forEach((i: any) => {
            const name = i.name || i.ingredientId || '不明な材料';
            const qty = i.quantity || '';
            if (!shoppingListMap.has(name)) {
              shoppingListMap.set(name, []);
            }
            if (qty) shoppingListMap.get(name)?.push(qty);
          });
        }
      } catch (e) {
        // JSONパースに失敗した場合はカンマ等で分割
        const items = plan.recipe.ingredients.split(/[、,]/).map(s => s.trim()).filter(Boolean);
        items.forEach(item => {
          if (!shoppingListMap.has(item)) {
            shoppingListMap.set(item, []);
          }
        });
      }
    }
  });

  const shoppingList = Array.from(shoppingListMap.entries()).map(([name, quantities]) => {
    return {
      name,
      quantity: quantities.length > 0 ? quantities.join(' + ') : '適量'
    };
  });

  // 食材表示用のヘルパー
  const formatIngredients = (rawIngredients: string) => {
    if (!rawIngredients) return '材料情報なし';
    try {
      const parsed = JSON.parse(rawIngredients);
      if (Array.isArray(parsed)) {
        return parsed.map((i: any) => i.name || i.ingredientId).join('、');
      }
      return rawIngredients;
    } catch (e) {
      // JSONパースに失敗した場合、JSON構造を簡易的に除去して表示を試みる
      return rawIngredients.replace(/[\[\]\{\}"']|name:|quantity:/g, '').replace(/,/g, '、').trim();
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">Meal Planner</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1 italic opacity-60">
            🍳 献立・食事管理 <span className="mx-2">|</span> AI Personal Chef
          </p>
        </div>
        <Link href="/household/setup" className="px-8 py-3.5 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
          New Menu
        </Link>
      </div>

      {/* 買い物リスト＆合計金額サマリー */}
      {mealPlans.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-8 items-start">
          <div className="md:w-1/3 w-full bg-gray-50 p-6 rounded-[2rem] border border-gray-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
            <div className="relative z-10">
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase mb-2">Total Budget</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">For 14 Days</p>
              <p className="text-5xl font-black text-pink-600 tracking-tighter italic">
                ¥{totalCost.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="md:w-2/3 w-full">
            <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase mb-6 flex items-center gap-2">
              <span className="text-2xl">🛒</span> Shopping List
            </h3>
            <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto pr-2">
              {shoppingList.map((item, idx) => (
                <div key={idx} className="bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 hover:border-pink-300 transition-colors">
                  <span className="font-bold text-gray-700">{item.name}</span>
                  <span className="text-[10px] font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 今後の献立リスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {mealPlans.length > 0 ? (
          mealPlans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 hover:border-pink-200 transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] font-black uppercase text-pink-500 tracking-widest italic">
                        {plan.date.toLocaleDateString('ja-JP', { weekday: 'long' })}
                      </p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 tracking-tighter">
                      {plan.date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </p>
                    <div className="mt-3">
                      <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-lg uppercase tracking-tighter border border-indigo-100">
                        Vitality Booster
                      </span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-gray-100 group-hover:rotate-12 transition-transform">
                    🥩
                  </div>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-6 leading-tight tracking-tight min-h-[3rem]">
                  {plan.recipe.name}
                </h3>

                <div className="space-y-5 flex-grow">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest">Est. Cost</span>
                    <span className="text-gray-900 font-black text-lg italic tracking-tighter">¥{plan.recipe.estimatedPrice.toLocaleString()}</span>
                  </div>
                  
                  <div className="pt-5 border-t border-gray-50">
                    <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest mb-3 italic">Key Ingredients</p>
                    <p className="text-sm font-bold text-gray-500 leading-relaxed line-clamp-2">
                      {formatIngredients(plan.recipe.ingredients)}
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-4">
                  <RecipeViewButton recipe={plan.recipe} />
                </div>
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
