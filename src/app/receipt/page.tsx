'use client';

import { useState, useRef, useEffect } from 'react';
import AccountHelpChip from '@/components/AccountHelpChip';

type Account = {
  id: number;
  name: string;
};

type Wallet = {
  id: number;
  name: string;
  accountId: number;
  account: { name: string };
};

type DebitEntry = {
  accountId: number | '';
  amount: number | '';
  reason: string;
  isPersonal: boolean;
};

export default function ReceiptOcr() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 仕訳ステート
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | ''>(''); // 貸方（レシート総額）
  const [selectedWalletId, setSelectedWalletId] = useState<number | ''>('');
  const [debitEntries, setDebitEntries] = useState<DebitEntry[]>([
    { accountId: '', amount: '', reason: '', isPersonal: false }
  ]);

  useEffect(() => {
    // 勘定科目と決済手段を並列取得
    Promise.all([
      fetch('/api/accounts').then(res => res.json()),
      fetch('/api/wallets').then(res => res.json())
    ]).then(([accData, walletData]) => {
      setAccounts(accData);
      setWallets(walletData);
      // デフォルトで最初のWalletを選択（通常「現金」など）
      if (walletData.length > 0) {
        setSelectedWalletId(walletData[0].id);
      }
    }).catch(err => console.error('Failed to load initial data', err));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setDate('');
      setTotalAmount('');
      setDescription('');
      setDebitEntries([{ accountId: '', amount: '', reason: '', isPersonal: false }]);
      setError('');
      setSuccess('');
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析に失敗しました');

      if (data.date) setDate(data.date);
      if (data.totalAmount) setTotalAmount(data.totalAmount);
      if (data.description) setDescription(data.description);
      
      if (data.suggestedEntries && data.suggestedEntries.length > 0) {
        const newEntries: DebitEntry[] = data.suggestedEntries.map((se: any) => {
          const acc = accounts.find(a => a.name === (se.accountName || se.guessedAccount));
          return {
            accountId: acc ? acc.id : '',
            amount: se.amount,
            reason: se.reason,
            isPersonal: !!se.isPersonal // AIからの判定を反映
          };
        });
        setDebitEntries(newEntries);
      }
      
      setSuccess('AIが各品目を解析し、スプリット仕訳を作成しました。');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addDebitEntry = () => {
    setDebitEntries([...debitEntries, { accountId: '', amount: '', reason: '', isPersonal: false }]);
  };

  const removeDebitEntry = (index: number) => {
    if (debitEntries.length <= 1) return;
    const newEntries = [...debitEntries];
    newEntries.splice(index, 1);
    setDebitEntries(newEntries);
  };

  const updateDebitEntry = (index: number, field: keyof DebitEntry, value: any) => {
    const newEntries = [...debitEntries];
    (newEntries[index] as any)[field] = value;
    
    // 「私物」チェック時は科目を「事業主貸」に固定
    if (field === 'isPersonal' && value === true) {
      const drawingAcc = accounts.find(a => a.name === '事業主貸');
      if (drawingAcc) newEntries[index].accountId = drawingAcc.id;
    }
    
    setDebitEntries(newEntries);
  };

  const calculateDebitSum = () => {
    return debitEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const wallet = wallets.find(w => w.id === Number(selectedWalletId));
    if (!date || !wallet || !totalAmount) {
      setError('必須項目を入力してください');
      return;
    }

    if (calculateDebitSum() !== Number(totalAmount)) {
      setError(`貸借バランスが一致しません（借方合計: ¥${calculateDebitSum()}, レシート総額: ¥${totalAmount}）`);
      return;
    }

    setSubmitting(true);
    try {
      const entries = [
        ...debitEntries.map(de => ({
          accountId: Number(de.accountId),
          entryType: 'DEBIT',
          amount: Number(de.amount)
        })),
        {
          accountId: wallet.accountId, // 決済手段に応じた科目 (事業主借など)
          entryType: 'CREDIT',
          amount: Number(totalAmount)
        }
      ];

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, description, entries, receiptImagePath: file?.name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '登録に失敗しました');
      }

      setSuccess('スプリット仕訳を登録しました！');
      // リセット
      setFile(null);
      setPreviewUrl(null);
      setDebitEntries([{ accountId: '', amount: '', reason: '', isPersonal: false }]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const creditBalanceWarning = calculateDebitSum() !== (Number(totalAmount) || 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">インテリジェント・スプリット</h2>
        <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Multi-Entry Support</div>
      </header>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左: レシート画像と解析ボタン */}
          <div className="lg:col-span-4 space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-all group relative overflow-hidden">
              <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="absolute inset-0 opacity-0 cursor-pointer" />
              <svg className="h-10 w-10 text-gray-400 group-hover:text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="mt-2 text-sm text-gray-500 font-medium">レシートをアップロード</span>
            </div>

            {previewUrl && (
              <div className="rounded-xl overflow-hidden border shadow-sm aspect-[3/4] bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Receipt" className="w-full h-full object-contain" />
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || loading}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all
                ${file && !loading ? 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02]' : 'bg-gray-300'}`}
            >
              {loading ? 'AIが品目を分析中...' : '品目別に解析する'}
            </button>
          </div>

          {/* 右: スプリット仕訳フォーム */}
          <div className="lg:col-span-8 space-y-6">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium animate-pulse">{error}</div>}
            {success && <div className="p-4 bg-green-50 text-green-600 rounded-xl border border-green-100 text-sm font-bold">{success}</div>}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 基本情報セクション */}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">取引日</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 rounded-lg border-gray-300 focus:ring-indigo-500 text-sm" required />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">決済手段 (貸方科目へ自動反映)</label>
                  <select 
                    value={selectedWalletId} 
                    onChange={e => setSelectedWalletId(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border-gray-300 focus:ring-indigo-500 text-sm bg-indigo-50 font-bold text-indigo-800"
                  >
                    {wallets.map(w => (
                      <option key={w.id} value={w.id}>{w.name} (→ {w.account.name})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">摘要</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2.5 rounded-lg border-gray-300 focus:ring-indigo-500 text-sm" placeholder="店名など" />
                </div>
              </div>

              {/* 借方スプリットセクション */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">借方 (内訳 / スプリット)</h3>
                  <button type="button" onClick={addDebitEntry} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center">
                    <span className="text-lg mr-1">+</span> 経費行を追加
                  </button>
                </div>

                <div className="space-y-3">
                  {debitEntries.map((entry, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border transition-all flex flex-wrap gap-4 items-center ${entry.isPersonal ? 'bg-pink-50 border-pink-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">勘定科目</label>
                          {entry.accountId && <AccountHelpChip accountName={accounts.find(a => a.id === Number(entry.accountId))?.name || ''} />}
                        </div>
                        <select
                          value={entry.accountId}
                          onChange={e => updateDebitEntry(idx, 'accountId', Number(e.target.value))}
                          className="w-full p-2 rounded-lg border-gray-300 text-xs font-medium"
                          disabled={entry.isPersonal} // 私物の場合は事業主貸固定
                        >
                          <option value="">選択...</option>
                          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                      </div>
                      
                      <div className="w-32">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">金額 (税込)</label>
                        <input
                          type="number"
                          value={entry.amount}
                          onChange={e => updateDebitEntry(idx, 'amount', Number(e.target.value))}
                          className="w-full p-2 rounded-lg border-gray-300 text-sm font-bold text-right"
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center mt-4">
                        <input
                          type="checkbox"
                          checked={entry.isPersonal}
                          onChange={e => updateDebitEntry(idx, 'isPersonal', e.target.checked)}
                          className="h-4 w-4 text-pink-600 rounded cursor-pointer"
                        />
                        <label className="ml-2 text-xs font-bold text-pink-600">私物</label>
                      </div>

                      <button type="button" onClick={() => removeDebitEntry(idx)} className="text-gray-400 hover:text-red-500 mt-4 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>

                      {entry.reason && <p className="w-full text-[10px] text-gray-500 italic mt-1 border-t pt-1 border-gray-100">{entry.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* サマリーセクション */}
              <div className="bg-indigo-900 text-white p-6 rounded-2xl flex flex-wrap justify-between items-center shadow-inner">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold opacity-60 uppercase">レシート総額 (貸方)</span>
                    <span className="bg-indigo-700 px-2 py-0.5 rounded text-[10px]">自動算出</span>
                  </div>
                  <div className="flex items-center text-3xl font-black italic">
                    <span className="text-xl mr-1 NOT-ITALIC font-normal">¥</span>
                    <input
                      type="number"
                      value={totalAmount}
                      onChange={e => setTotalAmount(Number(e.target.value))}
                      className="bg-transparent border-none text-white focus:ring-0 p-0 text-3xl font-black w-40 italic"
                    />
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold opacity-60 uppercase mb-1">現在の借方合計</div>
                  <div className={`text-2xl font-bold flex items-center justify-end ${creditBalanceWarning ? 'text-rose-400' : 'text-green-400'}`}>
                    {creditBalanceWarning ? '⚠️ ' : '✅ '} ¥{calculateDebitSum().toLocaleString()}
                  </div>
                  {creditBalanceWarning && (
                    <div className="text-[10px] font-bold text-rose-300 mt-1">総額と一致させてください (差額: ¥{Math.abs(Number(totalAmount || 0) - calculateDebitSum()).toLocaleString()})</div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || creditBalanceWarning}
                className={`w-full py-5 rounded-2xl font-black text-lg shadow-2xl transition-all uppercase tracking-widest
                  ${!submitting && !creditBalanceWarning ? 'bg-green-500 hover:bg-green-600 hover:scale-[1.01] active:scale-95 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
              >
                {submitting ? '仕訳を電帳法準拠で記録中...' : '帳簿を保存する'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
