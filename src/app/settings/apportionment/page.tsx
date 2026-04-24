'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: number;
  name: string;
  businessRatio?: {
    ratio: number;
  } | null;
}

export default function ApportionmentSettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deductions, setDeductions] = useState({
    healthInsurance: 0,
    pension: 0,
    lifeInsuranceGeneral: 0,
    lifeInsuranceMedical: 0,
    lifeInsuranceKenmin: 0,
    earthquakeInsurance: 0,
    ideco: 0
  });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchAccounts();
    fetchDeductions();
  }, [currentYear]);

  const fetchDeductions = async () => {
    try {
      const res = await fetch(`/api/settings/tax-deduction?year=${currentYear}`);
      const data = await res.json();
      if (!data.error) setDeductions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/settings/apportionment');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      setError('データの読み込みに失敗しました');
    }
  };


  const handleUpdateRatio = async (accountId: number, ratio: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/settings/apportionment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, ratio }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      
      setSuccess('比率を更新しました');
      await fetchAccounts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDeductions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/tax-deduction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deductions, year: currentYear }),
      });
      if (res.ok) {
        setSuccess('所得控除設定を保存しました');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const targets = ['地代家賃', '水道光熱費', '通信費', '消耗品費', '接待交際費', '旅費交通費'];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">APPORTIONMENT / 家事按分設定</h2>
          <p className="text-sm text-gray-500 mt-1 font-bold">経費のうち「仕事で使った分」の割合を設定してください。</p>
        </div>
        <div className="text-xs font-mono text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest font-black">Tax Compliance System</div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-6 bg-indigo-600 flex justify-between items-center">
          <span className="text-white font-black uppercase text-xs tracking-widest">Apportionment Ratio List</span>
          {success && <span className="bg-green-400 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce">{success}</span>}
        </div>

        <div className="divide-y divide-gray-50">
          {accounts.filter(a => targets.includes(a.name)).map(account => (
            <div key={account.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors group">
              <div className="flex-1">
                <h3 className="text-lg font-black text-gray-800">{account.name}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Business Expense Category</p>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Personal</span>
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute left-0 top-0 h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${account.businessRatio?.ratio ?? 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black text-indigo-500 uppercase">Business</span>
                </div>

                <div className="relative w-24">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={account.businessRatio?.ratio ?? 100}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val !== (account.businessRatio?.ratio ?? 100)) {
                        handleUpdateRatio(account.id, val);
                      }
                    }}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-2 text-right font-black text-indigo-700 outline-none focus:border-indigo-500 transition-all pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
        <h4 className="flex items-center gap-2 text-indigo-800 font-black text-sm uppercase tracking-widest mb-2">
          <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">!</span>
          How it works
        </h4>
        <p className="text-xs text-indigo-600/80 font-bold leading-relaxed">
          設定した比率は、レポート画面の「決算サマリー」で自動的に計算に反映されます。<br />
          例：家賃が10万円で事業利用比率が50%の場合、5万円が経費として計上され、残りの5万円は「事業主貸」として処理されます。
        </p>
      </div>

      {/* 所得控除設定セクション */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <div className="p-6 bg-red-600 flex justify-between items-center text-white">
          <div>
            <span className="font-black uppercase text-xs tracking-widest block opacity-70">Tax Deductions Settings</span>
            <h3 className="text-xl font-black italic">所得控除設定 ({currentYear}年分)</h3>
          </div>
          <button 
            onClick={handleSaveDeductions}
            disabled={loading}
            className="bg-white text-red-600 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">社会保険料 (国民健康保険税)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={deductions.healthInsurance}
                  onChange={e => setDeductions({...deductions, healthInsurance: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-gray-800 outline-none focus:border-red-500 transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black">¥</span>
              </div>
            </div>
            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">社会保険料 (国民年金)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={deductions.pension}
                  onChange={e => setDeductions({...deductions, pension: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-gray-800 outline-none focus:border-red-500 transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black">¥</span>
              </div>
            </div>
            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">小規模企業共済掛金 / iDeCo</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={deductions.ideco}
                  onChange={e => setDeductions({...deductions, ideco: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-indigo-600 outline-none focus:border-red-500 transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black">¥</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">生命保険料 (一般)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={deductions.lifeInsuranceGeneral}
                  onChange={e => setDeductions({...deductions, lifeInsuranceGeneral: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-gray-800 outline-none focus:border-red-500 transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black">¥</span>
              </div>
            </div>
            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">生命保険料 (県民共済等)</label>
              <div className="relative border-2 border-red-100 rounded-2xl overflow-hidden">
                <input 
                  type="number" 
                  value={deductions.lifeInsuranceKenmin}
                  onChange={e => setDeductions({...deductions, lifeInsuranceKenmin: parseInt(e.target.value) || 0})}
                  className="w-full bg-red-50/30 p-4 font-black text-gray-800 outline-none focus:bg-white transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-300 font-black">¥</span>
              </div>
            </div>
            <div className="group">
              <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">地震保険料</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={deductions.earthquakeInsurance}
                  onChange={e => setDeductions({...deductions, earthquakeInsurance: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-black text-gray-800 outline-none focus:border-red-500 transition-all pl-12"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black">¥</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0">
          <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
            <p className="text-[10px] text-red-700 font-bold italic leading-relaxed">
              ※ ここで入力した数値は、通常の「仕訳入力」で記帳した控除額と合算してレポートに表示されます。<br/>
              ※ 年一括払いなど、毎月の記帳が不要な項目はこちらで一括設定すると便利です。
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
