'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface CategoryRec {
  categoryId: number;
  name: string;
  remainingBudget: number;
  dailyRecommended: number;
}

interface RecommendationResponse {
  daysRemaining: number;
  recommendations: CategoryRec[];
}

export default function HouseholdSetupPage() {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [budget, setBudget] = useState(15000);
  const [recs, setRecs] = useState<CategoryRec[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingRec, setIsLoadingRec] = useState(true);

  // 予算推薦データの取得
  useEffect(() => {
    const fetchRecommendation = async () => {
      try {
        const response = await fetch('/api/household/recommendation');
        if (response.ok) {
          const data: RecommendationResponse = await response.json();
          setRecs(data.recommendations);
          
          // 初回の推奨値をセット (全カテゴリの合計)
          const totalDaily = data.recommendations.reduce((sum, r) => sum + r.dailyRecommended, 0);
          setBudget(totalDaily * days);
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/household/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days, budget, startDate: new Date() })
      });
      
      if (response.ok) {
        alert('献立が生成されました！');
        router.push('/household');
      } else {
        alert('生成に失敗しました。');
      }
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました。');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalRecommendedDaily = recs.reduce((sum, r) => sum + r.dailyRecommended, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">献立生成セットアップ</h1>
        <p className="text-gray-500 text-lg">AIとデータベースが、あなたに最適な1週間の献立をご提案します。</p>
      </div>

      {recs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recs.map(rec => (
            <div key={rec.categoryId} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{rec.categoryId === 11 ? '☕' : '🍲'}</span>
                <p className="text-gray-800 font-bold">{rec.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">今月の残高</p>
                  <p className="text-lg font-black text-gray-900">¥{rec.remainingBudget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">1日推奨額</p>
                  <p className="text-lg font-black text-emerald-600">¥{rec.dailyRecommended.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-xl space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">生成日数</label>
          <div className="flex gap-2">
            {[3, 7, 10, 14].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                  days === d 
                  ? 'border-pink-600 bg-pink-50 text-pink-700 font-bold' 
                  : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                }`}
              >
                {d}日間
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <label className="block text-sm font-bold text-gray-700">この期間の総予算 (円)</label>
            {recs.length > 0 && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                推奨合計: ¥{(totalRecommendedDaily * days).toLocaleString()}
              </span>
            )}
          </div>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full px-4 py-4 rounded-xl border-2 border-gray-100 focus:border-pink-500 focus:ring-0 text-2xl font-mono transition-all outline-none"
            placeholder="例: 15000"
          />
          <p className="mt-2 text-xs text-gray-400">※朝食・昼食、および夕食の合算予算です。</p>
        </div>

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
        <span className="text-2xl mt-1">💡</span>
        <div>
          <h4 className="font-bold text-amber-800 text-sm">Vitality Tip</h4>
          <p className="text-xs text-amber-700 leading-relaxed">
            現在、バイタリティモードがデフォルトでONになっています。
            テストステロン値を高め、血管の健康（NO産生）を意識した食材（ニラ、牛肉、スイカ、キュウリ等）が優先的に選出されます。
          </p>
        </div>
      </div>
    </div>
  );
}
