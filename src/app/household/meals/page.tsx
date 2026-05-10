import RecipeViewButton from '@/components/meals/RecipeViewButton';
import ConfirmPurchaseButton from '@/components/meals/ConfirmPurchaseButton';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import SeasonalIngredientList from '@/components/meals/SeasonalIngredientList';
import QuickInventoryAdd from '@/components/meals/QuickInventoryAdd';

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

  const inventory = await prisma.inventory.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  const batchMissions = await prisma.batchMission.findMany({
    where: {
      date: { gte: today, lte: weekEnd }
    },
    orderBy: { date: 'asc' }
  });

  // 買い物リストと合計金額の集計
  const shoppingListMap = new Map<string, { 
    usageAmount: Set<string>, 
    unitPrice: number, 
    isNewPurchase: boolean 
  }>();

  mealPlans.forEach(plan => {
    if (plan.recipe?.ingredients) {
      try {
        const parsed = JSON.parse(plan.recipe.ingredients);
        if (Array.isArray(parsed)) {
          parsed.forEach((i: any) => {
            const name = i.purchaseUnit || i.name || '不明な材料';
            const usage = i.usageAmount || i.quantity || '';
            const price = i.unitPrice || i.price || 0;
            const isFirst = i.isFirstPurchase === true;

            if (!shoppingListMap.has(name)) {
              shoppingListMap.set(name, { 
                usageAmount: new Set(), 
                unitPrice: price, 
                isNewPurchase: false 
              });
            }
            const item = shoppingListMap.get(name)!;
            if (usage) item.usageAmount.add(usage);
            if (isFirst) item.isNewPurchase = true;
            if (price > 0 && item.unitPrice === 0) item.unitPrice = price;
          });
        }
      } catch (e) {
        // Parse error
      }
    }
  });

  let totalCost = 0;
  const shoppingList = Array.from(shoppingListMap.entries()).map(([name, data]) => {
    const finalPrice = data.isNewPurchase ? data.unitPrice : 0;
    totalCost += finalPrice;
    
    return {
      name,
      quantity: Array.from(data.usageAmount).join(' / '),
      totalPrice: finalPrice,
      isFromInventory: !data.isNewPurchase
    };
  });

  // 献立表示用のヘルパー
  const renderMenu = (rawName: string) => {
    try {
      const menu = JSON.parse(rawName);
      return (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="bg-pink-100 text-pink-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Main</span>
            <span className="text-gray-900 font-bold leading-tight">{menu.main}</span>
          </div>
          <div className="flex items-start gap-2 opacity-80">
            <span className="bg-indigo-100 text-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Side</span>
            <span className="text-gray-700 font-bold text-sm leading-tight">{menu.side}</span>
          </div>
          <div className="flex items-start gap-2 opacity-60">
            <span className="bg-gray-100 text-gray-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Soup</span>
            <span className="text-gray-600 font-bold text-sm leading-tight">{menu.soup}</span>
          </div>
        </div>
      );
    } catch (e) {
      return <h3 className="text-xl font-black text-gray-900 mb-6 leading-tight tracking-tight min-h-[3rem]">{rawName}</h3>;
    }
  };

  const formatIngredients = (rawIngredients: string) => {
    if (!rawIngredients) return '材料情報なし';
    try {
      const parsed = JSON.parse(rawIngredients);
      if (Array.isArray(parsed)) {
        return parsed.map((i: any) => i.purchaseUnit || i.name).join('、');
      }
      return rawIngredients;
    } catch (e) {
      return rawIngredients;
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
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">For {mealPlans.length} Days</p>
              <p className="text-5xl font-black text-pink-600 tracking-tighter italic">
                ¥{totalCost.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="md:w-2/3 w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase flex items-center gap-2">
                <span className="text-2xl">🛒</span> Shopping List
              </h3>
              <ConfirmPurchaseButton shoppingItems={shoppingList} />
            </div>
            <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto pr-2">
              {shoppingList.map((item, idx) => (
                <div key={idx} className="bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm flex flex-col gap-1 hover:border-pink-300 transition-colors min-w-[120px]">
                  <div className="flex justify-between items-center gap-4">
                    <span className="font-bold text-gray-700 text-xs">{item.name}</span>
                    <span className="text-[11px] font-black text-pink-600 italic">
                      {item.isFromInventory ? '在庫利用' : `¥${item.totalPrice.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                      使用: {item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 冷蔵庫（在庫）状況 */}
      <div className="bg-gray-50 rounded-[2.5rem] p-8 border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase flex items-center gap-2">
            <span className="text-2xl">🧊</span> Refrigerator Stock (現在庫)
          </h3>
          <Link href="/household/inventory" className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline">
            Manage Stock Manually →
          </Link>
        </div>
        
        {inventory.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {inventory.map((item) => (
              <div key={item.id} className="bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm flex items-center gap-3 group hover:border-indigo-300 transition-colors">
                <span className="text-xs font-bold text-gray-700">{item.name}</span>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                  残り: {item.quantity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 font-bold italic text-sm">在庫データがありません。手動で追加するか、献立を確定してください。</p>
        )}
        
        <QuickInventoryAdd />
        
        <p className="mt-4 text-[10px] text-gray-400 font-bold italic">
          ※献立を確定すると、買い物リストの内容が自動でここに追加されます。
        </p>
      </div>

      {/* 作り置きミッション (Batch Missions) */}
      {batchMissions.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-[2.5rem] p-8 border border-indigo-100 shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-200">
              🔥
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Batch Cooking Missions</h3>
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">週2回の「攻め」の作り置き</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {batchMissions.map((mission) => (
              <div key={mission.id} className="bg-white p-6 rounded-[2rem] border border-indigo-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="text-6xl italic font-black">Day {mission.day}</span>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase italic">
                      Mission Day {mission.day}
                    </span>
                    <span className="text-sm font-black text-gray-900 tracking-tight">
                      {mission.date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  
                  <h4 className="text-lg font-black text-gray-800 mb-4 leading-tight">
                    {mission.name}
                  </h4>
                  
                  <div className="space-y-3">
                    {mission.ingredients?.split('\n').map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-200"></span>
                        <span className="text-sm font-bold text-gray-600">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t border-indigo-50">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Instructions</p>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      {mission.instructions}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 旬の食材リスト */}
      <SeasonalIngredientList />

      {/* 今後の献立リスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {mealPlans.length > 0 ? (
          mealPlans.map((plan) => (
            <div key={plan.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 hover:border-pink-200 transition-all group relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[10px] font-black uppercase text-pink-500 tracking-widest italic">
                        {plan.date.toLocaleDateString('ja-JP', { weekday: 'long' })}
                      </p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 tracking-tighter">
                      {plan.date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl shadow-inner border border-gray-100 group-hover:rotate-12 transition-transform">
                    🍱
                  </div>
                </div>

                <div className="mb-6 flex-grow">
                  {renderMenu(plan.recipe?.name || '無題のレシピ')}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest italic">この日の食費 (按分)</span>
                    <span className="text-gray-900 font-black text-lg italic tracking-tighter">¥{(plan.recipe?.estimatedPrice || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-gray-50">
                    <p className="text-[9px] font-black uppercase text-gray-300 tracking-widest mb-2 italic">Ingredients Used</p>
                    <p className="text-xs font-bold text-gray-500 leading-relaxed line-clamp-2">
                      {formatIngredients(plan.recipe?.ingredients || '')}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  {plan.recipe && <RecipeViewButton recipe={plan.recipe} />}
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
