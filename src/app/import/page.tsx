'use client';

import { useState } from 'react';

type DraftEntry = {
  accountId: number;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  accountName: string;
};

type DraftTransaction = {
  id: number;
  date: string;
  description: string;
  entries: DraftEntry[];
};

export default function CsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [drafts, setDrafts] = useState<DraftTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/csv-import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('CSVの解析に失敗しました');

      const data = await res.json();
      setDrafts(data);
      if (data.length === 0) {
        setError('有効な取引データが見つかりませんでした');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (drafts.length === 0) return;
    setImporting(true);
    setError('');

    try {
      // 1件ずつAPIを叩く（一括登録APIを作っていないため）
      let successCount = 0;
      for (const draft of drafts) {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: draft.date,
            description: draft.description,
            entries: draft.entries
          }),
        });
        if (res.ok) successCount++;
      }

      setSuccess(`${successCount}件の取引をインポートしました！`);
      setDrafts([]);
      setFile(null);
      // alertの代わり
    } catch (err: any) {
      setError('インポート中にエラーが発生しました');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800">CSVインポート</h2>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <p className="text-sm text-gray-600 mb-4">
          銀行やクレジットカードの利用履歴CSVをアップロードすると、概要（摘要）のキーワードから勘定科目を自動推測して仕訳のドラフトを作成します。
          <br/>
          （※対応形式: 「日付」「摘要」「支払金額」「入金金額」が含まれるCSV）
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md border border-red-100">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md border border-green-100">{success}</div>}

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100 cursor-pointer"
          />
          <button
            onClick={handlePreview}
            disabled={!file || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:bg-gray-400 whitespace-nowrap"
          >
            {loading ? '解析中...' : 'プレビュー生成'}
          </button>
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">インポートプレビュー ({drafts.length}件)</h3>
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:bg-gray-400"
            >
              {importing ? 'インポート中...' : '全て登録する'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">日付</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">摘要</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">推測された仕訳</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{draft.date}</td>
                    <td className="px-4 py-3 text-gray-900">{draft.description}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-1">
                          {draft.entries.filter(e => e.entryType === 'DEBIT').map((e, i) => (
                            <div key={`d-${i}`} className="flex justify-between text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">
                              <span>(借) {e.accountName}</span>
                              <span>¥{e.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 space-y-1">
                          {draft.entries.filter(e => e.entryType === 'CREDIT').map((e, i) => (
                            <div key={`c-${i}`} className="flex justify-between text-rose-700 bg-rose-50 px-2 py-1 rounded text-xs">
                              <span>(貸) {e.accountName}</span>
                              <span>¥{e.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
