'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountHelpChip from '@/components/AccountHelpChip';

// --- Types ---
interface Account {
  id: number;
  name: string;
  code: string | null;
  type: string;
}

interface Wallet {
  id: number;
  name: string;
  accountId: number;
  account: { name: string; type: string };
}

interface EntryRow {
  id: number;
  accountId: number | '';
  amount: number | '';
  isPersonal: boolean;
}

// --- Implementation ---
function EntryPortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as 'expense' | 'income' | 'advanced') || 'expense';
  
  const [mode, setMode] = useState<'expense' | 'income' | 'advanced'>(initialMode);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  
  // Masters
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [hhCategories, setHhCategories] = useState<any[]>([]);
  
  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form States - Expense
  const [amount, setAmount] = useState<string>('');
  const [hhCategoryId, setHhCategoryId] = useState<string>('');
  const [syncToBusiness, setSyncToBusiness] = useState(false);
  const [businessAccountCode, setBusinessAccountCode] = useState('500'); // 通信費などのデフォルト

  // Form States - Income (Sales)
  const [grossAmount, setGrossAmount] = useState<string>('');
  const [netAmount, setNetAmount] = useState<string>('');
  const [incomeWalletId, setIncomeWalletId] = useState<number | ''>('');

  // Form States - Advanced (Journal)
  const [debitEntries, setDebitEntries] = useState<EntryRow[]>([
    { id: 1, accountId: '', amount: '', isPersonal: false }
  ]);
  const [selectedWalletId, setSelectedWalletId] = useState<number | ''>('');
  const [nextId, setNextId] = useState(2);

  useEffect(() => {
    let isMounted = true;
    async function fetchMasters() {
      try {
        const [accRes, walletRes, catRes] = await Promise.all([
          fetch('/api/accounts'),
          fetch('/api/wallets'),
          fetch('/api/household/categories')
        ]);
        
        if (!accRes.ok || !walletRes.ok || !catRes.ok) {
          throw new Error('マスターデータの同期に失敗しました');
        }

        const [accData, walletData, catData] = await Promise.all([
          accRes.json(),
          walletRes.json(),
          catRes.json()
        ]);
        
        if (isMounted) {
          setAccounts(accData);
          setWallets(walletData);
          setHhCategories(catData);
          
          if (walletData.length > 0) {
            setSelectedWalletId(walletData[0].id);
            const depositWallet = walletData.find((w: any) => w.name.includes('普通預金'));
            setIncomeWalletId(depositWallet?.id || walletData[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load masters', err);
          setError(`初期データの読み込みに失敗しました: ${err.message}`);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchMasters();
    return () => { isMounted = false; };
  }, []);

  // --- Handlers ---
  const handleAddRow = () => {
    setDebitEntries([...debitEntries, { id: nextId, accountId: '', amount: '', isPersonal: false }]);
    setNextId(nextId + 1);
  };

  const handleUpdateEntry = (id: number, field: keyof EntryRow, value: any) => {
    setDebitEntries(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'expense') {
        const res = await fetch('/api/household/spending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            amount: Number(amount),
            description,
            categoryId: Number(hhCategoryId),
            syncToBusiness,
            businessAccountCode
          })
        });
        if (!res.ok) throw new Error('保存に失敗しました');
        setSuccess('支出を記録しました');
      } 
      else if (mode === 'income') {
        const gross = Number(grossAmount);
        const net = Number(netAmount);
        const tax = gross - net;
        const wallet = wallets.find(w => w.id === Number(incomeWalletId));
        const salesAcc = accounts.find(a => a.name === '売上高');
        const drawingAcc = accounts.find(a => a.name === '事業主貸');
        
        if (!wallet || !salesAcc || !drawingAcc) throw new Error('必要な勘定科目が見つかりません');

        const entries = [
          { accountId: wallet.accountId, amount: net, entryType: 'DEBIT' },
          { accountId: salesAcc.id, amount: gross, entryType: 'CREDIT' }
        ];
        if (tax > 0) {
          entries.push({ accountId: drawingAcc.id, amount: tax, entryType: 'DEBIT', tag: '源泉徴収税' });
        }

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, description, entries })
        });
        if (!res.ok) throw new Error('売上の保存に失敗しました');
        setSuccess('売上を記録しました');
      }
      else if (mode === 'advanced') {
        const wallet = wallets.find(w => w.id === Number(selectedWalletId));
        if (!wallet) throw new Error('決済手段を選択してください');
        
        const total = debitEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const entries = [
          ...debitEntries.map(e => ({ accountId: Number(e.accountId), amount: Number(e.amount), entryType: 'DEBIT' })),
          { accountId: wallet.accountId, amount: total, entryType: 'CREDIT' }
        ];

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, description, entries })
        });
        if (!res.ok) throw new Error('仕訳の保存に失敗しました');
        setSuccess('仕訳を記録しました');
      }

      // Reset form (except common fields)
      setAmount('');
      setGrossAmount('');
      setNetAmount('');
      setDescription('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Universal Entry Portal</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mt-1 italic">🔱 統合入力センター</p>
        </div>
        
        {/* Mode Selector */}
        <div className="flex bg-gray-200/50 p-1.5 rounded-2xl backdrop-blur-xl border border-white/50 shadow-inner">
          {(['expense', 'income', 'advanced'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                mode === m 
                  ? 'bg-white text-indigo-600 shadow-sm scale-100' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'
              }`}
            >
              {m === 'expense' ? '💸 支出' : m === 'income' ? '💰 収入' : '⚖️ 詳細'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 rounded-r-2xl font-bold animate-in slide-in-from-top-2">{error}</div>}
      {success && <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 rounded-r-2xl font-bold animate-in slide-in-from-top-2">{success}</div>}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Common Section */}
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-white/20 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Date / 取引日</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-100/50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl p-4 font-bold outline-none transition-all"
            />
          </div>
          <div className="md:col-span-8">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Description / 摘要</label>
            <input 
              type="text" 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="何の内容ですか？"
              className="w-full bg-gray-100/50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl p-4 font-bold outline-none transition-all"
            />
          </div>
        </div>

        {/* Mode Specific Section */}
        <div className="transition-all duration-500">
          {mode === 'expense' && (
            <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-white/20 space-y-8 animate-in zoom-in-95">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-[10px] font-black uppercase text-pink-500 tracking-tighter mb-2 block">Amount / 金額</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">¥</span>
                    <input 
                      type="number" 
                      value={amount} 
                      onChange={e => setAmount(e.target.value)}
                      className="w-full bg-pink-50/30 border-2 border-transparent focus:border-pink-400 focus:bg-white rounded-2xl p-6 pl-12 text-3xl font-black text-pink-600 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-tighter mb-2 block">Category / カテゴリ (家計)</label>
                  <select 
                    value={hhCategoryId}
                    onChange={e => setHhCategoryId(e.target.value)}
                    className="w-full bg-gray-100/50 border-2 border-transparent focus:border-pink-400 focus:bg-white rounded-2xl p-6 font-bold outline-none transition-all h-[84px]"
                  >
                    <option value="">選択してください</option>
                    {hhCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Sync Section */}
              <div className={`p-8 rounded-[2rem] border-2 transition-all duration-500 ${syncToBusiness ? 'border-indigo-500 bg-indigo-50/50 shadow-lg' : 'border-gray-100 bg-gray-50/50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm">💼</div>
                    <div>
                      <h3 className="font-black text-gray-800">Business Sync</h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-tight">事業経費として自動計上</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={syncToBusiness} onChange={e => setSyncToBusiness(e.target.checked)} className="sr-only peer" />
                    <div className="w-14 h-8 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                  </label>
                </div>
                {syncToBusiness && (
                  <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4">
                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-tighter block">Business Account / 経費科目</label>
                    <select 
                      value={businessAccountCode}
                      onChange={e => setBusinessAccountCode(e.target.value)}
                      className="w-full bg-white border-none rounded-2xl p-4 font-bold text-indigo-700 shadow-sm"
                    >
                      {accounts.filter(a => a.type === 'EXPENSE').map(a => <option key={a.id} value={a.code || ''}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'income' && (
            <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-white/20 space-y-8 animate-in zoom-in-95">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <div>
                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-tighter mb-2 block">Gross Amount / 額面金額</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">¥</span>
                      <input 
                        type="number" 
                        value={grossAmount} 
                        onChange={e => setGrossAmount(e.target.value)}
                        className="w-full bg-indigo-50/30 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl p-6 pl-12 text-3xl font-black text-indigo-900 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-green-500 tracking-tighter mb-2 block">Net Amount / 振込金額</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">¥</span>
                      <input 
                        type="number" 
                        value={netAmount} 
                        onChange={e => setNetAmount(e.target.value)}
                        className="w-full bg-green-50/30 border-2 border-transparent focus:border-green-400 focus:bg-white rounded-2xl p-6 pl-12 text-3xl font-black text-green-600 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300/60 mb-2">Withholding Tax / 源泉徴収税</p>
                    <p className="text-5xl font-black italic">¥{(Number(grossAmount) - Number(netAmount)).toLocaleString()}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-indigo-300/60 tracking-tighter block">Deposit Account / 入金先</label>
                    <select 
                      value={incomeWalletId}
                      onChange={e => setIncomeWalletId(Number(e.target.value))}
                      className="w-full bg-white/10 border border-white/20 backdrop-blur-md rounded-xl p-3 font-bold text-white outline-none"
                    >
                      {wallets.map(w => <option key={w.id} value={w.id} className="text-gray-900">{w.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === 'advanced' && (
            <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-white/20 space-y-8 animate-in zoom-in-95">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Debit / 借方内訳</h3>
                <button type="button" onClick={handleAddRow} className="bg-indigo-600 text-white px-6 py-2 rounded-full text-xs font-black hover:scale-105 transition-all shadow-lg active:scale-95">
                  + Add Line
                </button>
              </div>

              <div className="space-y-3">
                {debitEntries.map((entry) => (
                  <div key={entry.id} className="group bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 flex items-center gap-6 hover:border-indigo-200 transition-all shadow-sm">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-gray-300 uppercase mb-1 block">Account</label>
                      <select
                        value={entry.accountId}
                        onChange={e => handleUpdateEntry(entry.id, 'accountId', Number(e.target.value))}
                        className="w-full bg-transparent border-none p-0 font-bold text-gray-800 outline-none"
                      >
                        <option value="">選んでください</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="w-40 text-right">
                      <label className="text-[9px] font-black text-gray-300 uppercase mb-1 block">Amount</label>
                      <div className="flex items-center justify-end">
                        <span className="text-gray-400 font-bold mr-1 italic">¥</span>
                        <input
                          type="number"
                          value={entry.amount}
                          onChange={e => handleUpdateEntry(entry.id, 'amount', Number(e.target.value))}
                          className="bg-transparent border-none p-0 text-xl font-black text-right outline-none w-full"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-gray-100 flex items-end justify-between">
                <div className="w-64">
                  <label className="text-[10px] font-black uppercase text-indigo-500 tracking-tighter mb-2 block">CREDIT / 決済手段</label>
                  <select 
                    value={selectedWalletId} 
                    onChange={e => setSelectedWalletId(Number(e.target.value))}
                    className="w-full bg-indigo-50 border-none rounded-2xl p-4 font-bold text-indigo-700 outline-none shadow-sm"
                  >
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase italic">Total Balance</p>
                  <p className="text-4xl font-black text-indigo-600">¥{debitEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-6 rounded-[2rem] bg-gray-900 text-white font-black text-2xl tracking-tighter shadow-2xl hover:bg-black hover:scale-[1.01] active:scale-95 transition-all disabled:bg-gray-300 disabled:shadow-none mt-10 uppercase"
        >
          {isSaving ? 'Processing...' : 'Record Transaction'}
        </button>
      </form>
    </div>
  );
}

export default function EntryPortal() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EntryPortalContent />
    </Suspense>
  );
}
