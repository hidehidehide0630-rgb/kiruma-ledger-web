'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SeasonalIngredientList from '@/components/meals/SeasonalIngredientList';
import RecipeDetailModal from '@/components/meals/RecipeDetailModal';

interface Recipe {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  estimatedPrice: number;
}

interface CategoryRec {
  categoryId: number;
  name: string;
  remainingBudget: number;
  dailyRecommended: number;
  weeklyRecommended: number;
}

interface RecommendationResponse {
  daysRemainingInMonth: number;
  daysUntilSunday: number;
  recommendations: CategoryRec[];
}

export default function HouseholdSetupPage() {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState(15000);
  const [inventoryText, setInventoryText] = useState('');
  const [includeFavorites, setIncludeFavorites] = useState(true);
  const [recs, setRecs] = useState<CategoryRec[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingRec, setIsLoadingRec] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [selectedRecipeForModal, setSelectedRecipeForModal] = useState<Recipe | null>(null);
  const [mustIncludeRecipeIds, setMustIncludeRecipeIds] = useState<string[]>([]);

  // 予算推薦データの取得
  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        const response = await fetch('/api/household/recommendation');
        if (response.ok) {
          const data: RecommendationResponse = await response.json();
          setRecs(data.recommendations);
          
          // 今週の日曜日までの日数をデフォルトにセット
          setDays(data.daysUntilSunday);
          
          // 初回の推奨値をセット (全カテゴリの週間合計)
          const totalWeekly = data.recommendations.reduce((sum, r) => sum + r.weeklyRecommended, 0);
          setBudget(totalWeekly);
        }
      } catch (error) {
        console.error('Failed to fetch recommendation:', error);
      } finally {
        setIsLoadingRec(false);
      }
    };
    fetchRecommendation();
  }, []);

  // 日数が変わったときに予算を再計算（推奨値に基づき）
  useEffect(() => {
    if (recs.length > 0) {
      const totalDaily = recs.reduce((sum, r) => sum + r.dailyRecommended, 0);
      setBudget(totalDaily * days);
    }
  }, [days, recs]);

  // お気に入りレシピの取得
  useEffect(() => {
    const fetchFavorites = async () => {
      setIsLoadingFavorites(true);
      try {
        const response = await fetch('/api/household/recipes/favorites');
        if (response.ok) {
          const data = await response.json();
          setFavorites(data);
        }
      } catch (error) {
        console.error('Failed to fetch favorite recipes:', error);
      } finally {
        setIsLoadingFavorites(false);
      }
    };
    fetchFavorites();
  }, []);

  // 在庫読み込みは inventoryText のみ更新する。days / budget には絶対に副作用を与えない。
  const handleLoadInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const response = await fetch('/api/household/inventory');
      if (response.ok) {
        const items = await response.json();
        const text = items
          .map((i: any) => `${i.name}: ${i.quantity}${i.unit || ''}`)
          .join('\n');
        setInventoryText(text);
      }
    } catch (error) {
      console.error('Failed to load inventory:', error);
      alert('在庫の読み込みに失敗しました。');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const selectedFavoriteRecipes = favorites.filter(f => mustIncludeRecipeIds.includes(f.id));
      const response = await fetch('/api/household/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, budget, startDate: new Date(), inventoryText, includeFavorites, selectedFavorites: selectedFavoriteRecipes })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Non-JSON response:', text);
        throw new Error('サーバーから不正な形式の応答が返されました。しばらく待ってから再度お試しください。');
      }
      
      if (response.ok && data.success) {
        alert('献立が生成されました！');
        router.push('/household/meals');
      } else {
        const errorMsg = data.error || '不明なエラーが発生しました。';
        alert(`生成に失敗しました: ${errorMsg}`);
      }
    } catch (error: any) {
      console.error('Generate Error:', error);
      alert(`エラーが発生しました: ${error.message || '通信エラー'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRemoveFavorite = async (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このレシピをお気に入りから外しますか？')) return;
    
    try {
      const res = await fetch(`/api/household/recipes/${recipeId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: false })
      });
      if (res.ok) {
        setFavorites(prev => prev.filter(r => r.id !== recipeId));
        setMustIncludeRecipeIds(prev => prev.filter(id => id !== recipeId));
      } else {
        alert('解除に失敗しました。');
      }
    } catch (error) {
      console.error('Failed to remove favorite', error);
      alert('エラーが発生しました');
    }
  };

  const totalRecommendedDaily = recs.reduce((sum, r) => sum + r.dailyRecommended, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">献立生成セットアップ</h1>
        <p className="text-gray-500 text-lg">AIとデータベースが、あなたに最適な献立をご提案します。</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1">
          <label className="block text-sm font-bold text-gray-700 mb-2">生成する日数</label>
          <div className="flex items-center gap-4">
            <input 
              type="range" min="1" max="14" 
              value={days} 
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600"
            />
            <span className="text-2xl font-black text-gray-900 w-12">{days}<span className="text-sm">日分</span></span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-widest">※デフォルトで今週の日曜日までが設定されています</p>
        </div>
      </div>

      {recs.length > 0 && (
        <div className="flex justify-center">
          {recs.map(rec => (
            <div key={rec.categoryId} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow max-w-sm w-full">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🍱</span>
                <p className="text-gray-800 font-bold">{rec.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">今月の残高</p>
                  <p className="text-lg font-black text-gray-900">¥{rec.remainingBudget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">1日推奨額</p>
                  <p className="text-lg font-black text-emerald-600">¥{rec.dailyRecommended.toLocaleString()}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">今週（残り{days}日）の目安</p>
                <p className="text-base font-black text-pink-600">¥{(rec.dailyRecommended * days).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 旬の食材リストを表示 */}
      <SeasonalIngredientList />

      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xl space-y-6">
        <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-2">AIが自動計算した今週（残り{days}日間）の推奨予算</p>
          <div className="flex items-center justify-center gap-3">
            <input 
              type="number"
              value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value) || 0)}
              className="text-4xl font-black text-emerald-600 tracking-tighter italic bg-transparent border-none focus:ring-0 w-40 text-right"
            />
            <span className="text-2xl font-black text-emerald-600 tracking-tighter italic">円</span>
          </div>
          <p className="mt-3 text-xs text-gray-400">※過去の支出ペースから自動算出。必要に応じて微調整可能です。</p>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-end mb-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <span>🧊 冷蔵庫の在庫を入力（使い切り優先）</span>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black">MUST USE</span>
            </label>
            <button
              onClick={handleLoadInventory}
              disabled={isLoadingInventory}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 disabled:opacity-50 flex items-center gap-1"
            >
              {isLoadingInventory ? 'Loading...' : '🔄 冷蔵庫から読み込む'}
            </button>
          </div>
          <textarea
            value={inventoryText}
            onChange={(e) => setInventoryText(e.target.value)}
            placeholder={"例:\n卵: 2個\nキャベツ: 1/4玉\n鶏むね肉: 200g"}
            className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all text-sm font-medium placeholder:text-gray-300"
          />
          <p className="text-[10px] text-gray-400">※入力された食材は優先的に献立に組み込まれ、買い物予算からは除外されます。</p>
        </div>

        <div className="flex flex-col gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeFavorites"
              checked={includeFavorites}
              onChange={(e) => setIncludeFavorites(e.target.checked)}
              className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500 border-gray-300"
            />
            <label htmlFor="includeFavorites" className="text-sm font-bold text-amber-900 cursor-pointer">
              お気に入りレシピを考慮する
              <span className="block text-[10px] text-amber-700 font-medium mt-0.5">※過去に★をつけた献立から、予算と栄養バランスに合うものをAIが選びます。（確実に組み込みたい場合は下で選択してください）</span>
            </label>
          </div>

          {includeFavorites && (
            <div className="mt-2 border-t border-amber-200/50 pt-3">
              <h4 className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-2">
                <span>⭐ 現在登録されているお気に入り</span>
                <span className="text-[10px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-black">{favorites.length}件</span>
              </h4>
              {isLoadingFavorites ? (
                <p className="text-xs text-amber-700/60 animate-pulse">読み込み中...</p>
              ) : favorites.length === 0 ? (
                <p className="text-xs text-amber-700/60 italic bg-amber-100/50 p-3 rounded-lg border border-amber-100">お気に入りに登録されたレシピはまだありません。日々の献立画面から「★」をタップして登録できます。</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {favorites.map((recipe) => {
                    let parsedName = recipe.name;
                    let parsedSide = "";
                    let parsedSoup = "";
                    try {
                      const n = JSON.parse(recipe.name);
                      if (n.main) {
                        parsedName = n.main;
                        parsedSide = n.side || "";
                        parsedSoup = n.soup || "";
                      }
                    } catch (e) {}
                    const isSelected = mustIncludeRecipeIds.includes(recipe.id);

                    return (
                      <div 
                        key={recipe.id} 
                        className={`relative bg-white border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group ${isSelected ? 'border-pink-500 bg-pink-50/30' : 'border-amber-100 hover:border-pink-300'}`}
                        onClick={() => {
                          if (isSelected) {
                            setMustIncludeRecipeIds(prev => prev.filter(id => id !== recipe.id));
                          } else {
                            setMustIncludeRecipeIds(prev => [...prev, recipe.id]);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <p className="font-bold text-sm text-gray-800 leading-tight group-hover:text-pink-600 transition-colors">{parsedName}</p>
                            {(parsedSide || parsedSoup) && (
                              <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">
                                {parsedSide && `副菜: ${parsedSide}`} {parsedSoup && `スープ: ${parsedSoup}`}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0 pt-0.5">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500 border-gray-300 shadow-sm cursor-pointer"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                          <p className="text-xs font-black text-pink-500">¥{recipe.estimatedPrice.toLocaleString()}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleRemoveFavorite(recipe.id, e)}
                              className="text-[12px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-red-200"
                              title="お気に入りから外す"
                            >
                              🗑️
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipeForModal(recipe);
                              }}
                              className="text-[10px] font-bold bg-gray-100 hover:bg-pink-100 text-gray-600 hover:text-pink-700 px-3 py-1.5 rounded-lg transition-colors border border-gray-200 hover:border-pink-200"
                            >
                              詳細を見る
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedRecipeForModal && (
          <RecipeDetailModal 
            recipe={selectedRecipeForModal}
            isOpen={!!selectedRecipeForModal}
            onClose={() => setSelectedRecipeForModal(null)}
          />
        )}

        <div className="pt-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isLoadingRec}
            className={`w-full py-5 rounded-2xl text-white font-bold text-lg shadow-lg transform transition-all active:scale-95 flex items-center justify-center ${
              isGenerating || isLoadingRec
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-pink-600 to-rose-500 hover:from-pink-700 hover:to-rose-600'
            }`}
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AI献立エンジン起動中...
              </>
            ) : (
              '献立を生成する'
            )}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-4 items-start">
        <span className="text-2xl mt-1">💪</span>
        <div>
          <h4 className="font-bold text-amber-800 text-sm">Vitality Tip</h4>
          <p className="text-xs text-amber-700 leading-relaxed">
            現在、ボディメイク＆バイタリティモードが適用されています。
            勃起力の向上、胸筋・腹筋の強化、そして体形の絞りを同時に実現するため、高タンパク・低GI・血管拡張（NO産生）を意識した食材が優先されます。
          </p>
        </div>
      </div>
    </div>
  );
}
