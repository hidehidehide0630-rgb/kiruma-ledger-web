'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Account = {
  id: number;
  name: string;
};

type JournalEntry = {
  id: number;
  accountId: number;
  account: Account;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
};

type Transaction = {
  id: number;
  date: string;
  description: string;
  journalEntries: JournalEntry[];
};

export default function TransactionsList() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // 検索・フィルタリング用ステート
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [query, setQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (query) params.append('q', query);
      if (minAmount) params.append('minAmount', minAmount);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        setTransactions(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('本当にこの取引を削除しますか？\n(電子帳簿保存法に対応するため、データは論理削除されます)')) {
      return;
    }

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTransactions(transactions.filter(t => t.id !== id));
      } else {
        alert('削除に失敗しました');
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">取引一覧</h2>

      {/* 検索フィルター */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">終了日</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500" 
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">摘要検索</label>
          <input 
            type="text" 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            placeholder="店名などを入力"
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 w-48" 
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">最低金額</label>
          <input 
            type="number" 
            value={minAmount} 
            onChange={e => setMinAmount(e.target.value)}
            placeholder="下限"
            className="px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 w-24" 
          />
        </div>
        <button 
          onClick={fetchTransactions}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors"
        >
          検索
        </button>
        <button 
          onClick={() => {
            setStartDate(''); setEndDate(''); setQuery(''); setMinAmount('');
            setTimeout(fetchTransactions, 0);
          }}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm font-medium transition-colors"
        >
          クリア
        </button>
      </div>

      {/* トランザクション一覧テーブル */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">条件に一致する取引がありません。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">日付</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">摘要</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">借方</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">貸方</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map(t => {
                  const debits = t.journalEntries.filter(e => e.entryType === 'DEBIT');
                  const credits = t.journalEntries.filter(e => e.entryType === 'CREDIT');
                  
                  // 行数を合わせるため最大数を取得
                  const maxRows = Math.max(debits.length, credits.length);
                  const rows = Array.from({ length: maxRows });

                  return rows.map((_, i) => (
                    <tr key={`${t.id}-${i}`} className={i === 0 ? "border-t border-gray-200" : "border-t-0"}>
                      {i === 0 ? (
                        <>
                          <td className="px-6 py-2 whitespace-nowrap text-gray-900" rowSpan={maxRows}>
                            {new Date(t.date).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-6 py-2 text-gray-900" rowSpan={maxRows}>
                            {t.description}
                          </td>
                        </>
                      ) : null}
                      <td className="px-6 py-1 whitespace-nowrap text-right">
                        {debits[i] ? (
                          <div className="flex justify-between items-center text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                            <span>{debits[i].account.name}</span>
                            <span className="font-medium">¥{debits[i].amount.toLocaleString()}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-1 whitespace-nowrap text-right">
                        {credits[i] ? (
                          <div className="flex justify-between items-center text-rose-700 bg-rose-50 px-2 py-1 rounded">
                            <span>{credits[i].account.name}</span>
                            <span className="font-medium">¥{credits[i].amount.toLocaleString()}</span>
                          </div>
                        ) : null}
                      </td>
                      {i === 0 ? (
                        <td className="px-6 py-2 whitespace-nowrap text-center text-sm" rowSpan={maxRows}>
                          {/* 電帳法対応のため削除は物理削除ではなく論理削除APIを呼ぶ */}
                          <button 
                            onClick={() => router.push(`/journal?id=${t.id}`)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            編集
                          </button>
                          <button 
                            onClick={() => handleDelete(t.id)}
                            className="text-red-500 hover:text-red-700 font-medium ml-4"
                          >
                            削除
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
