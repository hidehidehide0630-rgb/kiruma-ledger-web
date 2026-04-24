'use client';

import { useState, useEffect } from 'react';

type ReportTab = 'PL' | 'BS' | 'LEDGER';

export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<ReportTab>('PL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  
  const [accounts, setAccounts] = useState<{id: number, name: string}[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 勘定科目リストを取得（元帳用）
  useEffect(() => {
    fetch('/api/accounts')
      .then(res => res.json())
      .then(d => setAccounts(d))
      .catch(e => console.error(e));
  }, []);

  const fetchReport = async () => {
    if (activeTab === 'LEDGER' && !accountId) {
      setError('総勘定元帳を表示するには勘定科目を選択してください');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({ type: activeTab.toLowerCase() });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (activeTab === 'LEDGER' && accountId) params.append('accountId', accountId);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (!res.ok) throw new Error('レポートの取得に失敗しました');
      
      const responseData = await res.json();
      setData(responseData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // タブ切り替え時にデータリセットするか必要に応じて自動フェッチ
  useEffect(() => {
    setData(null);
    if (activeTab !== 'LEDGER') {
      fetchReport();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800">各種帳票</h2>

      {/* タブナビゲーション */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('PL')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'PL' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            損益計算書 (P/L)
          </button>
          <button
            onClick={() => setActiveTab('BS')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'BS' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            貸借対照表 (B/S)
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === 'LEDGER' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            総勘定元帳 (Account Ledger)
          </button>
        </nav>
      </div>

      {/* フィルタ領域 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">期首日</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">期末日</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500" 
          />
        </div>
        
        {activeTab === 'LEDGER' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">勘定科目</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 w-48"
            >
              <option value="">選択してください</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <button 
          onClick={fetchReport}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
        >
          集計する
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
      
      {/* P/L 表示エリア */}
      {activeTab === 'PL' && data && data.type === 'pl' && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 bg-indigo-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">損益計算書報告書</h3>
            <div className="text-right">
              <span className="text-sm text-gray-500">当期純利益</span>
              <p className={`text-2xl font-bold ${data.summary.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ¥{(data.summary.netIncome ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 費用 */}
            <div>
              <h4 className="text-lg font-semibold border-b-2 border-red-200 pb-2 mb-4 text-gray-700">費用 (Expenses)</h4>
              <ul className="space-y-2">
                {data.accounts.filter((a: any) => a.type === 'EXPENSE' && a.balance !== 0).map((a: any) => (
                  <li key={a.accountId} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-medium">¥{(a.balance ?? 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between pt-4 mt-4 border-t-2 border-gray-200">
                <span className="font-bold text-gray-800">費用合計</span>
                <span className="font-bold text-red-600">¥{(data.summary.expense ?? 0).toLocaleString()}</span>
              </div>
            </div>
            
            {/* 収益 */}
            <div>
              <h4 className="text-lg font-semibold border-b-2 border-blue-200 pb-2 mb-4 text-gray-700">収益 (Revenues)</h4>
              <ul className="space-y-2">
                {data.accounts.filter((a: any) => a.type === 'REVENUE' && a.balance !== 0).map((a: any) => (
                  <li key={a.accountId} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-medium">¥{(a.balance ?? 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between pt-4 mt-4 border-t-2 border-gray-200">
                <span className="font-bold text-gray-800">収益合計</span>
                <span className="font-bold text-blue-600">¥{(data.summary.revenue ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B/S 表示エリア */}
      {activeTab === 'BS' && data && data.type === 'bs' && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 bg-teal-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-800">貸借対照表報告書</h3>
            <div className="text-right">
              <span className="text-sm text-gray-500">資産合計</span>
              <p className="text-2xl font-bold text-teal-700">
                ¥{(data.summary.asset ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 資産 */}
            <div>
              <h4 className="text-lg font-semibold border-b-2 border-teal-200 pb-2 mb-4 text-gray-700">資産 (Assets)</h4>
              <ul className="space-y-2">
                {data.accounts.filter((a: any) => a.type === 'ASSET' && a.balance !== 0).map((a: any) => (
                  <li key={a.accountId} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-medium">¥{(a.balance ?? 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* 負債と純資産 */}
            <div>
              <h4 className="text-lg font-semibold border-b-2 border-orange-200 pb-2 mb-4 text-gray-700">負債 (Liabilities)</h4>
              <ul className="space-y-2 mb-6">
                {data.accounts.filter((a: any) => a.type === 'LIABILITY' && a.balance !== 0).map((a: any) => (
                  <li key={a.accountId} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-medium">¥{(a.balance ?? 0).toLocaleString()}</span>
                  </li>
                ))}
              </ul>

              <h4 className="text-lg font-semibold border-b-2 border-purple-200 pb-2 mb-4 text-gray-700">純資産 (Equity)</h4>
              <ul className="space-y-2 mb-6">
                {data.accounts.filter((a: any) => a.type === 'EQUITY' && a.balance !== 0).map((a: any) => (
                  <li key={a.accountId} className="flex justify-between py-1 border-b border-dashed border-gray-200">
                    <span className="text-gray-700">{a.name}</span>
                    <span className="font-medium">¥{(a.balance ?? 0).toLocaleString()}</span>
                  </li>
                ))}
                {/* 期中損益（当期純利益） */}
                <li className="flex justify-between py-1 border-b border-dashed border-gray-200">
                  <span className="text-gray-700 text-sm">( 当期純利益 )</span>
                  <span className="font-medium text-sm">¥{(data.summary.netIncome ?? 0).toLocaleString()}</span>
                </li>
              </ul>
              
              <div className="flex justify-between pt-4 mt-4 border-t-2 border-gray-200">
                <span className="font-bold text-gray-800">負債・純資産合計</span>
                <span className="font-bold text-orange-600">¥{(data.summary.totalLiabilitiesAndEquity ?? 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-3 text-center text-sm">
            {data.summary.asset === data.summary.totalLiabilitiesAndEquity ? (
              <span className="text-green-600 font-bold">✓ 借方(資産)と貸方(負債・純資産)が一致しています</span>
            ) : (
              <span className="text-red-600 font-bold">⚠️ 貸借が一致していません。期首残高の未設定などが原因の可能性があります。</span>
            )}
          </div>
        </div>
      )}

      {/* 総勘定元帳 表示エリア */}
      {activeTab === 'LEDGER' && data && data.type === 'ledger' && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
            <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded">
              {data.account.type}
            </span>
            <h3 className="text-xl font-bold text-gray-800">{data.account.name} 元帳</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">日付</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">摘要</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">相手勘定</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">借方</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">貸方</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 border-l border-gray-200">残高</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">指定期間での仕訳がありません</td>
                  </tr>
                ) : (
                  data.entries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-gray-900">
                        {new Date(entry.date).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-3 text-gray-900">{entry.description}</td>
                      <td className="px-6 py-3 text-gray-500">{entry.targetAccountName}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-right text-indigo-600">
                        {entry.debit > 0 ? `¥${(entry.debit ?? 0).toLocaleString()}` : ''}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right text-rose-600">
                        {entry.credit > 0 ? `¥${(entry.credit ?? 0).toLocaleString()}` : ''}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right font-medium border-l border-gray-200">
                        ¥{(entry.balance ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {loading && <div className="text-center p-8 text-gray-500">データを読み込み中...</div>}
    </div>
  );
}
