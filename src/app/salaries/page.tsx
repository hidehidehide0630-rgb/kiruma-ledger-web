'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalaryPage() {
  const router = useRouter();
  const [salaries, setSalaries] = useState<any[]>([]);
  const [yearlySummary, setYearlySummary] = useState<any>({
    totalAmount: 0,
    totalSocialInsurance: 0,
    totalWithholdingTax: 0,
    isConfirmed: false
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // フォームステート
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    socialInsurance: '',
    withholdingTax: '',
    isYearEndAdjusted: false,
    description: ''
  });

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salRes, sumRes] = await Promise.all([
        fetch(`/api/salaries?year=${currentYear}`),
        fetch(`/api/salaries/yearly-summary?year=${currentYear}`)
      ]);
      const salData = await salRes.json();
      const sumData = await sumRes.json();
      setSalaries(salData);
      setYearlySummary(sumData);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch('/api/salaries', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { ...formData, id: editingId } : formData)
      });
      if (res.ok) {
        setFormData({
          ...formData,
          amount: '',
          socialInsurance: '',
          withholdingTax: '',
          isYearEndAdjusted: false,
          description: ''
        });
        setEditingId(null);
        fetchData();
      }
    } catch (error) {
      console.error('Submit failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('この給与データを削除しますか？')) return;
    
    try {
      const res = await fetch(`/api/salaries?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('削除に失敗しました。');
      }
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  const handleEdit = (salary: any) => {
    setEditingId(salary.id);
    setFormData({
      date: new Date(salary.date).toISOString().split('T')[0],
      amount: salary.amount.toString(),
      socialInsurance: salary.socialInsurance.toString(),
      withholdingTax: salary.withholdingTax.toString(),
      isYearEndAdjusted: salary.isYearEndAdjusted,
      description: salary.description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      socialInsurance: '',
      withholdingTax: '',
      isYearEndAdjusted: false,
      description: ''
    });
  };

  const handleSummaryUpdate = async (updatedFields: any) => {
    const newSummary = { ...yearlySummary, ...updatedFields, year: currentYear };
    try {
      const res = await fetch('/api/salaries/yearly-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSummary)
      });
      if (res.ok) {
        setYearlySummary(newSummary);
      }
    } catch (error) {
      console.error('Summary update failed', error);
    }
  };

  if (loading) return <div className="p-20 text-center text-white font-black animate-pulse">LOADING...</div>;

  return (
    <div className="min-h-screen bg-[#050510] text-gray-200 p-8 space-y-12 pb-24">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">
            Salary Management <span className="text-emerald-500">/ 給与所得管理</span>
          </h1>
          <p className="text-gray-500 font-bold mt-2">OPTIMIZED FOR EMPLOYEES & SECONDARY INCOME</p>
        </div>
        <div className="px-4 py-2 bg-emerald-950/30 border-2 border-emerald-500/50 rounded-xl text-emerald-400 font-black text-xs italic">
          YEAR: {currentYear}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Monthly Entry Form */}
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-[#0a0a1a] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-10 -mt-10" />
            <h2 className="text-xl font-black text-white mb-6 uppercase flex items-center gap-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              {editingId ? 'Edit Salary Record / 給与明細を編集' : 'Monthly Slip Input / 月次給与明細入力'}
            </h2>
            
            <form onSubmit={handleSalarySubmit} className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Date / 支給日</label>
                <input 
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-emerald-500 transition-all"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Employer / 勤務先・内容</label>
                <input 
                  type="text"
                  placeholder="e.g. 株式会社サンプル"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-emerald-500 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Gross Amount / 額面給与</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500 font-black">¥</span>
                  <input 
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-white font-black text-xl focus:outline-none focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Soc. Insurance / 社会保険料</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black">¥</span>
                  <input 
                    type="number"
                    value={formData.socialInsurance}
                    onChange={(e) => setFormData({...formData, socialInsurance: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-gray-200 font-black focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="健康・厚生・雇用合算"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Withholding Tax / 源泉徴収税</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black">¥</span>
                  <input 
                    type="number"
                    value={formData.withholdingTax}
                    onChange={(e) => setFormData({...formData, withholdingTax: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-4 text-gray-200 font-black focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input 
                  type="checkbox"
                  id="yearEnd"
                  checked={formData.isYearEndAdjusted}
                  onChange={(e) => setFormData({...formData, isYearEndAdjusted: e.target.checked})}
                  className="w-6 h-6 rounded-lg accent-emerald-500"
                />
                <label htmlFor="yearEnd" className="text-sm font-black text-gray-300 cursor-pointer">
                  Year-end Adjusted / 年末調整済み
                </label>
              </div>

              <button 
                type="submit"
               className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-900/20 transform active:scale-95 transition-all mt-4 uppercase text-sm tracking-widest disabled:opacity-50"
              >
                {submitting ? 'Processing...' : editingId ? 'Update Salary Slip / 更新する' : 'Record Salary Slip / 給与明細を記録する'}
              </button>

              {editingId && (
                <button 
                  type="button"
                  onClick={cancelEdit}
                  className="col-span-2 border-2 border-white/10 text-gray-400 font-black py-4 rounded-2xl hover:bg-white/5 transition-all uppercase text-xs tracking-widest mb-4"
                >
                  Cancel Edit / 編集をキャンセル
                </button>
              )}
            </form>
          </section>

          {/* History List */}
          <section className="bg-[#0a0a1a] border border-white/5 rounded-3xl p-8 overflow-hidden">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Recent Records / 最近の記録</h3>
            <div className="space-y-3">
              {salaries.length === 0 ? (
                <p className="text-gray-600 italic font-bold py-10 text-center">No records found for {currentYear}</p>
              ) : (
                salaries.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors group relative">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center font-black text-emerald-500">
                        {new Date(s.date).getMonth() + 1}
                      </div>
                      <div>
                        <div className="font-black text-white">{s.description || 'Salary Slip'}</div>
                        <div className="text-[10px] font-bold text-gray-500">{new Date(s.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 text-right">
                      {s.isYearEndAdjusted && (
                        <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md uppercase">Adjusted</span>
                      )}
                      <div>
                        <div className="text-lg font-black text-white">¥{s.amount.toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-gray-500 text-left">Soc: ¥{s.socialInsurance.toLocaleString()} / Tax: ¥{s.withholdingTax.toLocaleString()}</div>
                      </div>
                       <button 
                        onClick={() => handleEdit(s)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-emerald-500 transition-all transform hover:scale-110"
                        title="Edit record"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-500 hover:text-red-500 transition-all transform hover:scale-110"
                        title="Delete record"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right: Year-end Confirmation Mode */}
        <div className="space-y-8">
          <section className={`rounded-3xl p-8 border-2 transition-all ${
            yearlySummary.isConfirmed 
              ? 'bg-indigo-900/40 border-indigo-500 shadow-xl shadow-indigo-900/30' 
              : 'bg-[#0a0a1a] border-white/5 grayscale saturate-50 opacity-80'
          }`}>
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-black text-white uppercase leading-none">
                Final Certificate Mode<br/>
                <span className="text-indigo-400 text-sm italic">源泉徴収票・確定モード</span>
              </h2>
              <div 
                onClick={() => handleSummaryUpdate({ isConfirmed: !yearlySummary.isConfirmed })}
                className={`w-14 h-8 rounded-full cursor-pointer p-1 transition-all ${yearlySummary.isConfirmed ? 'bg-indigo-500' : 'bg-gray-700'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-lg transform transition-all ${yearlySummary.isConfirmed ? 'translate-x-6' : ''}`} />
              </div>
            </div>

            <p className="text-[10px] font-bold text-gray-400 mb-6 leading-relaxed">
              年末にもらう「源泉徴収票」の値を入力します。有効にすると、月次の合計ではなくこちらの確定値が優先されます。
            </p>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Total Gross / 支払金額</label>
                <input 
                  type="number"
                  disabled={!yearlySummary.isConfirmed}
                  value={yearlySummary.totalAmount || ''}
                  onChange={(e) => handleSummaryUpdate({ totalAmount: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white font-black text-xl focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Total Insurance / 社会保険料等の金額</label>
                <input 
                  type="number"
                  disabled={!yearlySummary.isConfirmed}
                  value={yearlySummary.totalSocialInsurance || ''}
                  onChange={(e) => handleSummaryUpdate({ totalSocialInsurance: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-gray-200 font-black focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Final W-Tax / 源泉徴収税額</label>
                <input 
                  type="number"
                  disabled={!yearlySummary.isConfirmed}
                  value={yearlySummary.totalWithholdingTax || ''}
                  onChange={(e) => handleSummaryUpdate({ totalWithholdingTax: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-gray-200 font-black focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-30"
                />
              </div>
            </div>

            {yearlySummary.isConfirmed && (
              <div className="mt-8 flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                <span className="text-xl">🛡️</span>
                <span className="text-[10px] font-black text-indigo-300 leading-tight uppercase">
                  Confirmed: Only these values will be used for tax calculation.
                </span>
              </div>
            )}
          </section>

          {/* Quick Summary */}
          <section className="bg-white/5 rounded-3xl p-6 border border-white/5">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Salary Summary / 給与所得現況</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-xs font-bold text-gray-500">Current Total:</span>
                <span className="text-sm font-black text-white">¥{(yearlySummary.isConfirmed ? yearlySummary.totalAmount : salaries.reduce((acc, s) => acc + s.amount, 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-bold text-gray-500">Records:</span>
                <span className="text-sm font-black text-white">{salaries.length} Slips</span>
              </div>
            </div>
            <button 
              onClick={() => router.push('/reports/tax-summary')}
              className="w-full mt-6 py-3 bg-white text-black font-black text-[10px] uppercase rounded-xl hover:bg-gray-200 transition-colors"
            >
              View Full Report / レポートで確認
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
