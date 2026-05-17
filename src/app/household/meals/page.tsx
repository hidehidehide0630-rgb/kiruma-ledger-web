import RecipeViewButton from '@/components/meals/RecipeViewButton';
import ConfirmPurchaseButton from '@/components/meals/ConfirmPurchaseButton';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import SeasonalIngredientList from '@/components/meals/SeasonalIngredientList';
import QuickInventoryAdd from '@/components/meals/QuickInventoryAdd';
import FavoriteButton from '@/components/meals/FavoriteButton';
import CopyShoppingListButton from '@/components/meals/CopyShoppingListButton';

export const dynamic = 'force-dynamic';

export default async function MealManagementPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 生成APIで今日以降の献立は毎回再構築されるため、未来日全てを表示対象とする
  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      date: { gte: today }
    },
    include: { recipe: true },
    orderBy: { date: 'asc' }
  });

  const inventory = await prisma.inventory.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  const batchMissions = await prisma.batchMission.findMany({
    where: {
      date: { gte: today }
    },
    orderBy: { date: 'asc' }
  });

  // 数量文字列から「値+単位」を抽出（例: "150g" → {value:150, unit:"g"}）
  const parseQuantity = (str: string): { value: number; unit: string } | null => {
    if (!str) return null;
    const m = str.trim().match(/^([\d.]+)\s*(.*)$/);
    if (!m) return null;
    const value = parseFloat(m[1]);
    if (isNaN(value)) return null;
    return { value, unit: m[2].trim().toLowerCase().replace(/パック|袋/g, '') };
  };

  // purchaseUnit から販売単位の容量を抽出（例: "鶏むね肉(300g)" → {value:300, unit:"g"}）
  const parsePackCapacity = (purchaseUnit: string): { value: number; unit: string } | null => {
    const m = purchaseUnit.match(/[(（]([\d.]+)\s*([^)）]+)[)）]/);
    if (!m) return null;
    const value = parseFloat(m[1]);
    if (isNaN(value)) return null;
    return { value, unit: m[2].trim().toLowerCase().replace(/パック|袋/g, '') };
  };

  // 買い物リストと合計金額の集計
  // 買い物リストは2つのソースから集計する（責務分離アーキテクチャ）:
  //   1. mealPlans（dailyPlans）: 主菜の食材
  //   2. batchMissions: 副菜・スープの食材
  // 集計キーは「基本名（最初の括弧以降を切り捨て）」で正規化し、同一食材を1件にまとめる。
  // ネストした括弧（例: "枝豆(1袋(250g))"）にも対応するため、最初の `(` の位置で切る方式を採用。
  const stripParen = (s: string) => {
    if (!s) return '';
    const idx = s.search(/[(（]/);
    return (idx >= 0 ? s.substring(0, idx) : s).trim();
  };

  const shoppingListMap = new Map<string, {
    displayName: string; // 表示用（最も情報量の多い purchaseUnit を採用）
    usages: string[];    // 重複保持で配列
    unitPrice: number;
    isNewPurchase: boolean;
  }>();

  mealPlans.forEach(plan => {
    if (plan.recipe?.ingredients) {
      try {
        const parsed = JSON.parse(plan.recipe.ingredients);
        if (Array.isArray(parsed)) {
          parsed.forEach((i: any) => {
            const rawName = i.purchaseUnit || i.name || '不明な材料';
            const baseName = stripParen(rawName) || rawName;
            const usage = i.usageAmount || i.quantity || '';
            const price = i.unitPrice || i.price || 0;
            const isFirst = i.isFirstPurchase === true;

            if (!shoppingListMap.has(baseName)) {
              shoppingListMap.set(baseName, {
                displayName: rawName,
                usages: [],
                unitPrice: price,
                isNewPurchase: false
              });
            }
            const item = shoppingListMap.get(baseName)!;
            // 表示名は括弧情報を含む方（長い方）を優先
            if (rawName.length > item.displayName.length) {
              item.displayName = rawName;
            }
            // 「適量」は数量加算の邪魔になるので、他に数量があれば省く
            if (usage && !(usage.trim() === '適量' && item.usages.length > 0)) {
              item.usages.push(usage);
            }
            if (isFirst) item.isNewPurchase = true;
            if (price > 0 && item.unitPrice === 0) item.unitPrice = price;
          });
        }
      } catch (e) {
        // Parse error
      }
    }
  });

  // Batch Missions（副菜・スープ）の食材も買い物リストに統合
  batchMissions.forEach(mission => {
    if (mission.ingredients) {
      try {
        const parsed = JSON.parse(mission.ingredients);
        if (Array.isArray(parsed)) {
          parsed.forEach((i: any) => {
            const rawName = i.purchaseUnit || i.name || '不明な材料';
            const baseName = stripParen(rawName) || rawName;
            const usage = i.usageAmount || i.quantity || '';
            const price = i.unitPrice || i.price || 0;
            const isFirst = i.isFirstPurchase === true;

            if (!shoppingListMap.has(baseName)) {
              shoppingListMap.set(baseName, {
                displayName: rawName,
                usages: [],
                unitPrice: price,
                isNewPurchase: false
              });
            }
            const item = shoppingListMap.get(baseName)!;
            if (rawName.length > item.displayName.length) {
              item.displayName = rawName;
            }
            if (usage && !(usage.trim() === '適量' && item.usages.length > 0)) {
              item.usages.push(usage);
            }
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
  const shoppingList = Array.from(shoppingListMap.entries()).map(([, data]) => {
    // 各日の使用量を合算
    const parsedUsages = data.usages.map(u => parseQuantity(u)).filter((p): p is { value: number; unit: string } => p !== null);
    const packCap = parsePackCapacity(data.displayName);

    let totalValue = 0;
    let summable = false;
    let displayUsage = data.usages.join(' + ');

    // 単位が揃っていれば合算可能
    if (parsedUsages.length > 0 && parsedUsages.every(p => p.unit === parsedUsages[0].unit)) {
      summable = true;
      totalValue = parsedUsages.reduce((sum, p) => sum + p.value, 0);
      if (data.usages.length > 1) {
        displayUsage = `${data.usages.join(' + ')} (合計 ${totalValue}${parsedUsages[0].unit})`;
      }
    }

    // 販売単位を超えていれば追加パック購入が必要
    let packsNeeded = 1;
    let overflow = false;
    if (summable && packCap && packCap.unit === parsedUsages[0].unit && totalValue > packCap.value) {
      packsNeeded = Math.ceil(totalValue / packCap.value);
      overflow = true;
    }

    const finalPrice = data.isNewPurchase ? data.unitPrice * packsNeeded : 0;
    totalCost += finalPrice;

    return {
      name: data.displayName,
      quantity: displayUsage,
      totalPrice: finalPrice,
      packsNeeded,
      overflow,
      packCapacity: packCap ? `${packCap.value}${packCap.unit}` : null,
      totalValueDisplay: summable ? `${totalValue}${parsedUsages[0].unit}` : null,
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
        // 「鶏むね肉(300g) 使用150g」のように販売単位＋実使用量を表示
        return parsed.map((i: any) => {
          const name = i.purchaseUnit || i.name || '不明';
          const usage = i.usageAmount || i.quantity || '';
          // 販売単位表記から余計な (xxx) を取り除いて基本名のみに（ネスト括弧対応）
          const baseName = stripParen(name) || name;
          return usage ? `${baseName} ${usage}` : baseName;
        }).join('、');
      }
      return rawIngredients;
    } catch (e) {
      return rawIngredients;
    }
  };

  // instructions テキストから【メニュー名】パターンを抽出
  const extractMenuNames = (rawInstructions: string): string[] => {
    if (!rawInstructions) return [];
    const matches = rawInstructions.match(/【([^】]+)】/g);
    if (!matches) return [];
    return matches.map(m => m.replace(/[【】]/g, '').trim()).filter(Boolean);
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
              <div className="flex gap-2">
                <CopyShoppingListButton shoppingItems={shoppingList} />
                <ConfirmPurchaseButton shoppingItems={shoppingList} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto pr-2">
              {shoppingList.map((item, idx) => (
                <div key={idx} className={`bg-white border px-4 py-2 rounded-xl shadow-sm flex flex-col gap-1 transition-colors min-w-[140px] ${item.overflow ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-pink-300'}`}>
                  <div className="flex justify-between items-center gap-4">
                    <span className="font-bold text-gray-700 text-xs">
                      {item.name}
                      {item.packsNeeded > 1 && (
                        <span className="ml-1 text-red-600 font-black">× {item.packsNeeded}パック</span>
                      )}
                    </span>
                    <span className="text-[11px] font-black text-pink-600 italic">
                      {item.isFromInventory ? '在庫利用' : `¥${item.totalPrice.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                      使用: {item.quantity}
                    </span>
                    {item.overflow && (
                      <span className="text-[9px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                        ⚠ 販売単位{item.packCapacity}超過（総量{item.totalValueDisplay}）
                      </span>
                    )}
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
            {batchMissions.map((mission) => {
              const menuNames = extractMenuNames(mission.instructions);
              return (
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

                  <h4 className="text-lg font-black text-gray-800 mb-2 leading-tight">
                    {menuNames.length > 0 ? menuNames.join(' / ') : mission.name}
                  </h4>
                  {menuNames.length > 0 && (
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4 italic">
                      {mission.name}
                    </p>
                  )}
                  
                  <div className="space-y-3">
                    {(() => {
                      // 新フォーマット（構造化JSON）優先、失敗時は旧フォーマット（改行区切り文字列）にフォールバック
                      try {
                        const items = JSON.parse(mission.ingredients || '[]');
                        if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'object') {
                          return items.map((it: any, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-200"></span>
                              <span className="text-sm font-bold text-gray-600">
                                {it.purchaseUnit} {it.usageAmount}
                              </span>
                            </div>
                          ));
                        }
                      } catch (e) { /* fallthrough */ }
                      return mission.ingredients?.split('\n').map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-200"></span>
                          <span className="text-sm font-bold text-gray-600">{item}</span>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="mt-6 pt-6 border-t border-indigo-50">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Instructions</p>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      {mission.instructions}
                    </p>
                  </div>
                </div>
              </div>
              );
            })}
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
                  <div className="flex flex-col gap-2 items-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl shadow-inner border border-gray-100 group-hover:rotate-12 transition-transform">
                      🍱
                    </div>
                    {plan.recipe && (
                      <FavoriteButton 
                        recipeId={plan.recipe.id} 
                        initialIsFavorite={plan.recipe.isFavorite} 
                      />
                    )}
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
