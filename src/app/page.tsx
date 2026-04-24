'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ReportData {
  accounts: any[];
  summary: any;
}

export default function Dashboard() {
  const [plData, setPlData] = useState<ReportData | null>(null);
  const [bsData, setBsData] = useState<ReportData | null>(null);
  const [auditReviews, setAuditReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 手動レビュー用
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plRes, bsRes, auditRes] = await Promise.all([
          fetch('/api/reports?type=pl'),
          fetch('/api/reports?type=bs'),
          fetch('/api/audits?unread=true')
        ]);
        
        if (plRes.ok) setPlData(await plRes.json());
        if (bsRes.ok) setBsData(await bsRes.json());
        if (auditRes.ok) setAuditReviews(await auditRes.json());
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const markAsRead = async (id: number) => {
    try {
      const res = await fetch('/api/audits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setAuditReviews(prev => prev.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Failed to mark as read', error);
    }
  };

  const handleManualAudit = async () => {
    if (!manualStartDate || !manualEndDate) {
      alert('開始日と終了日を指定してください。');
      return;
    }

    setIsAuditing(true);
    try {
      const res = await fetch('/api/audits/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: manualStartDate, endDate: manualEndDate })
      });
      
      if (res.ok) {
        alert('監査が完了しました。ダッシュボードを更新します。');
        // 監査結果を再取得
        const auditRes = await fetch('/api/audits?unread=true');
        if (auditRes.ok) setAuditReviews(await auditRes.json());
      } else {
        const data = await res.json();
        alert(`監査に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('Audit execution error:', error);
      alert('通信エラーが発生しました。');
    } finally {
      setIsAuditing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">読み込み中...</div>;
  }

  // P/L グラフデータ
  const plChartData = {
    labels: ['当期実績'],
    datasets: [
      {
        label: '収益',
        data: [plData?.summary?.revenue || 0],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
      {
        label: '費用',
        data: [plData?.summary?.expense || 0],
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
      },
      {
        label: '純利益',
        data: [plData?.summary?.netIncome || 0],
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
    ],
  };

  // B/S グラフデータ (資産構成)
  const bsAssetAccounts = bsData?.accounts.filter(a => a.type === 'ASSET' && a.balance > 0) || [];
  const bsPieData = {
    labels: bsAssetAccounts.map(a => a.name),
    datasets: [
      {
        data: bsAssetAccounts.map(a => a.balance),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
        {auditReviews.length > 0 && (
          <div className="animate-pulse bg-red-100 text-red-700 px-4 py-2 rounded-full text-sm font-bold border border-red-200">
            ⚠️ 未読の監査アラートがあります
          </div>
        )}
      </div>

      {auditReviews.map(review => (
        <div key={review.id} className={`p-4 rounded-xl border-l-4 shadow-sm flex justify-between items-center animate-in fade-in slide-in-from-top-2
          ${review.status === 'WARNING' ? 'bg-amber-50 border-amber-500 text-amber-800' : 'bg-rose-50 border-rose-500 text-rose-800'}`}>
          <div className="flex-1">
            <h4 className="font-black text-sm uppercase tracking-wider mb-1">
              取引監査アラート: {new Date(review.startDate).toLocaleDateString()} 〜 {new Date(review.endDate).toLocaleDateString()}
            </h4>
            <p className="text-sm font-bold mb-2">{review.summary}</p>
            
            {/* 詳細情報の表示 */}
            <div className="space-y-3 mt-2">
              {JSON.parse(review.details).map((item: any, idx: number) => (
                <div key={idx} className="bg-white/40 p-3 rounded-lg border border-current/10 text-xs">
                  <div className="font-bold mb-1 opacity-80">取引ID: {item.id}</div>
                  {item.assessment.map((a: any, aIdx: number) => (
                    <div key={aIdx} className="grid grid-cols-1 gap-1 mb-2 last:mb-0">
                      <div><span className="font-bold">🚩 箇所:</span> {a.point}</div>
                      <div><span className="font-bold">❌ 問題:</span> {a.issue}</div>
                      <div className="text-blue-900 bg-blue-500/10 p-1.5 rounded mt-1 border border-blue-200/50">
                        <span className="font-bold">💡 改善案:</span> {a.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button 
            onClick={() => markAsRead(review.id)}
            className="ml-4 px-4 py-2 bg-white/50 hover:bg-white rounded-lg text-xs font-bold transition-all border border-current opacity-70 hover:opacity-100"
          >
            確認しました
          </button>
        </div>
      ))}

      {/* 手動監査セクション */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <span className="text-2xl">📋</span> 取引の即時レビュー（手動実行）
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              指定した期間の取引をAIがチェックし、不備があればアラートを出します。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-white rounded-lg border border-blue-200 px-3 py-1.5">
              <span className="text-xs font-bold text-blue-400 mr-2 uppercase">From</span>
              <input 
                type="date" 
                value={manualStartDate}
                onChange={(e) => setManualStartDate(e.target.value)}
                className="text-sm outline-none bg-transparent text-blue-900 font-medium"
              />
            </div>
            <div className="flex items-center bg-white rounded-lg border border-blue-200 px-3 py-1.5">
              <span className="text-xs font-bold text-blue-400 mr-2 uppercase">To</span>
              <input 
                type="date" 
                value={manualEndDate}
                onChange={(e) => setManualEndDate(e.target.value)}
                className="text-sm outline-none bg-transparent text-blue-900 font-medium"
              />
            </div>
            <button
              onClick={handleManualAudit}
              disabled={isAuditing}
              className={`px-6 py-2 rounded-xl font-bold text-white transition-all shadow-md active:scale-95
                ${isAuditing ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}
            >
              {isAuditing ? 'AIレビュー実行中...' : 'レビュー実行'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* P/L サマリーカード */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">売上（収益・按分後）</h3>
          <p className="text-2xl font-bold text-blue-600">
            ¥{(plData?.summary?.revenue || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">経費（費用・按分後）</h3>
          <p className="text-2xl font-bold text-red-600">
            ¥{(plData?.summary?.expense || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500 mb-1">当期純利益（按分後）</h3>
          <p className={`text-2xl font-bold ${(plData?.summary?.netIncome || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ¥{(plData?.summary?.netIncome || 0).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* P/L グラフ */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">収益と費用の比較 (P/L)</h3>
          <div className="h-64">
            <Bar 
              data={plChartData} 
              options={{ maintainAspectRatio: false, responsive: true }} 
            />
          </div>
        </div>

        {/* B/S グラフ */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">資産の構成 (B/S)</h3>
          <div className="h-64 flex justify-center">
            {bsAssetAccounts.length > 0 ? (
              <Pie 
                data={bsPieData} 
                options={{ maintainAspectRatio: false, responsive: true }} 
              />
            ) : (
              <p className="text-gray-500 self-center">資産データがありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
