'use client';

import { useState, useEffect } from 'react';

export default function TaxSummaryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchSummary();
  }, [year]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/tax-summary?year=${year}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center p-20 font-black text-indigo-400 animate-pulse">GENERATING FINAL TAX REPORT...</div>;

  if (!data || data.error) {
    return (
      <div className="max-w-4xl mx-auto p-20 text-center space-y-4">
        <div className="text-red-500 font-black text-2xl uppercase tracking-tighter">Report Generation Failed</div>
        <p className="text-gray-500 font-bold">{data?.error || '不明なエラーが発生しました。'}</p>
        <button onClick={fetchSummary} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-black text-xs">Retry</button>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* Premium Header */}
      <div className="bg-white rounded-[3rem] p-12 shadow-2xl border-b-8 border-indigo-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50 blur-3xl rounded-full -mr-32 -mt-32" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-indigo-900 text-white px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase">Official Summary</span>
              <span className="text-indigo-900 font-black text-xs uppercase tracking-widest italic">Personal Income Tax Return</span>
            </div>
            <h1 className="text-6xl font-black text-indigo-950 tracking-tighter uppercase leading-none italic">
              Final Tax Return <span className="text-indigo-400">/ 確定申告サマリー</span>
            </h1>
            <p className="text-gray-500 font-bold mt-4 max-w-2xl leading-relaxed">
              事業所得、給与所得、および所得控除を完全に集計しました。このまま確定申告書の各項目へ転記可能です。
            </p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-[2rem] border border-gray-100 shadow-inner">
            <select 
              value={year} 
              onChange={e => setYear(e.target.value)}
              className="bg-white border-2 border-indigo-200 rounded-2xl px-6 py-3 font-black text-indigo-900 outline-none focus:ring-4 focus:ring-indigo-100 transition-all text-lg"
            >
              <option value="2025">2025年分</option>
              <option value="2026">2026年分</option>
            </select>
            <button onClick={() => window.print()} className="bg-indigo-900 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-indigo-900/20">Print Report</button>
          </div>
        </div>
      </div>

      {/* THREE MAIN BLOCKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* BLOCK A: BUSINESS INCOME */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group">
          <div className="p-8 bg-gradient-to-br from-indigo-800 to-indigo-950 text-white relative">
            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-2">Block A / 第一表：所得金額</div>
            <h2 className="text-3xl font-black italic tracking-tighter">Business Income<br/><span className="text-xl opacity-80">事業所得</span></h2>
            <div className="absolute bottom-4 right-8 text-6xl opacity-10 font-black italic">A</div>
          </div>
          <div className="p-8 space-y-6 flex flex-col justify-between h-[380px]">
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b-2 border-dashed border-gray-100 pb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">売上金額 (Revenue)</span>
                <span className="text-xl font-black text-gray-800">¥{summary.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b-2 border-dashed border-gray-100 pb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase italic">源泉徴収税額 (Withholding)</span>
                <span className="text-sm font-black text-indigo-600">¥{summary.totalWithholdingTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b-2 border-dashed border-gray-100 pb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">必要経費合計 (Expenses)</span>
                <span className="text-xl font-black text-red-500">- ¥{summary.totalExpense.toLocaleString()}</span>
              </div>
            </div>
            <div className="pt-4 bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
              <div className="text-[10px] font-black text-indigo-400 uppercase mb-1">事業所得金額 (Net Profit)</div>
              <div className="text-4xl font-black text-indigo-900 tracking-tighter">¥{summary.netProfit.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* BLOCK B: SALARY INCOME */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group">
          <div className="p-8 bg-gradient-to-br from-purple-700 to-purple-900 text-white relative">
            <div className="text-[10px] font-black text-purple-200 uppercase tracking-[0.3em] mb-2">Block B / 第一表：給与</div>
            <h2 className="text-3xl font-black italic tracking-tighter">Salary Income<br/><span className="text-xl opacity-80">給与所得</span></h2>
            <div className="absolute bottom-4 right-8 text-6xl opacity-10 font-black italic">B</div>
          </div>
          <div className="p-8 space-y-6 flex flex-col justify-between h-[380px]">
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b-2 border-dashed border-gray-100 pb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase font-black underline">支払金額 (Gross)</span>
                <span className="text-xl font-black text-gray-800">¥{summary.salary.gross.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b-2 border-dashed border-gray-100 pb-2 text-red-500">
                <span className="text-[10px] font-black text-gray-400 uppercase italic">給与所得控除 (Deduction)</span>
                <span className="text-sm font-black">- ¥{summary.salary.deduction.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b-2 border-dashed border-gray-100 pb-2 text-indigo-600">
                <span className="text-[10px] font-black text-gray-400 uppercase">源泉徴収税額 (給与)</span>
                <span className="text-sm font-black">¥{summary.salary.withholdingTax.toLocaleString()}</span>
              </div>
            </div>
            <div className="pt-4 bg-purple-50 rounded-2xl p-6 border border-purple-100">
              <div className="text-[10px] font-black text-purple-400 uppercase mb-1">給与所得金額 (Net Salary)</div>
              <div className="text-4xl font-black text-purple-900 tracking-tighter">¥{summary.salary.net.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* BLOCK C: INCOME DEDUCTION */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden group">
          <div className="p-8 bg-gradient-to-br from-red-600 to-red-800 text-white relative">
            <div className="text-[10px] font-black text-red-200 uppercase tracking-[0.3em] mb-2">Block C / 第一表：所得から差し引かれる金額</div>
            <h2 className="text-3xl font-black italic tracking-tighter">Tax Deductions<br/><span className="text-xl opacity-80">所得控除</span></h2>
            <div className="absolute bottom-4 right-8 text-6xl opacity-10 font-black italic">C</div>
          </div>
          <div className="p-8 space-y-4 flex flex-col justify-between h-[380px]">
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              <div className="flex justify-between items-end border-b border-gray-100 pb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">社会保険料 (国保・年金)</span>
                <span className="text-sm font-black text-gray-800">¥{(summary.taxDeduction.healthInsurance + summary.taxDeduction.pension).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-gray-100 pb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">生命保険料 (一般・介護)</span>
                <span className="text-sm font-black text-gray-800">¥{(summary.taxDeduction.lifeInsuranceGeneral + summary.taxDeduction.lifeInsuranceMedical).toLocaleString()}</span>
              </div>
               <div className="flex justify-between items-end border-b border-gray-100 pb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">地震保険料</span>
                <span className="text-sm font-black text-gray-800">¥{summary.taxDeduction.earthquakeInsurance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-gray-100 pb-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">生命保険料 (県民共済等)</span>
                <span className="text-sm font-black text-gray-600 font-bold">¥{summary.taxDeduction.lifeInsuranceKenmin.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-gray-100 pb-1 text-indigo-600">
                <span className="text-[10px] font-bold text-indigo-400 uppercase italic">小規模企業共済掛金 / iDeCo</span>
                <span className="text-sm font-black">¥{summary.taxDeduction.ideco.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end border-b border-gray-100 pb-1 text-gray-400 italic">
                <span className="text-[8px] font-black uppercase">給与天引分 (社会保険料)</span>
                <span className="text-[10px] font-black">¥{summary.salary.socialInsurance.toLocaleString()}</span>
              </div>
            </div>
            <div className="pt-4 bg-red-50 rounded-2xl p-6 border border-red-100">
              <div className="text-[10px] font-black text-red-400 uppercase mb-1">所得控除額 合計</div>
              <div className="text-4xl font-black text-red-900 tracking-tighter">¥{(summary.taxDeduction.total + summary.salary.socialInsurance).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL CALCULATION BOX */}
      <div className="bg-black rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[500px] h-full bg-indigo-600/30 blur-[120px] rounded-full translate-x-1/2 group-hover:bg-indigo-500/40 transition-all duration-700" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.5em] text-indigo-300 italic">Calculation Finalized</span>
            </div>
            <h3 className="text-4xl font-black italic tracking-tighter">Taxable Total Income<br/><span className="text-indigo-400 italic">/ 総支給所得 - 全所得控除</span></h3>
            <p className="text-indigo-200 text-sm font-bold leading-relaxed opacity-70">
              日本の「所得税」計算の基礎となる数値です。<br/>
              ここに基礎控除（一律48万円）等を差し引いたのち、税率が適用されます。
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-10 border border-white/10 text-right">
            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 italic underline decoration-indigo-500 decoration-4 underline-offset-8">Final Taxable Value</div>
            <div className="text-7xl font-black tracking-tighter text-white tabular-nums italic">
              ¥{summary.totalIncome.toLocaleString()}
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <span className="px-4 py-2 bg-white/10 rounded-xl text-[10px] font-black uppercase italic tracking-widest text-indigo-300 border border-white/5">Auto Generated</span>
              <span className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase italic tracking-widest border border-white/10 shadow-lg shadow-indigo-900/40">Ready for filing</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown for Transfer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-gray-100">
        <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-gray-50">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 underline decoration-indigo-500 decoration-4 underline-offset-4">事業・経費明細 (転記用)</h4>
          <div className="space-y-4">
            {(data.expenses ?? []).map((exp: any) => (
              <div key={exp.id} className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span className="font-bold text-gray-700">{exp.name}</span>
                <span className="font-black text-gray-900">¥{exp.businessAmount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-gray-50 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6 underline decoration-red-500 decoration-4 underline-offset-4">所得控除の内訳 (転記用)</h4>
            <div className="space-y-4">
              <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span className="font-bold text-gray-700">社会保険料 (国保・年金)</span>
                <span className="font-black text-gray-900">¥{(summary.taxDeduction.healthInsurance + summary.taxDeduction.pension).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span className="font-bold text-gray-700">一般生命保険料</span>
                <span className="font-black text-gray-900">¥{summary.taxDeduction.lifeInsuranceGeneral.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span className="font-bold text-gray-700">介護医療保険料</span>
                <span className="font-black text-gray-900">¥{summary.taxDeduction.lifeInsuranceMedical.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span className="font-bold text-gray-700">地震保険料</span>
                <span className="font-black text-gray-900">¥{summary.taxDeduction.earthquakeInsurance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-50">
                <span className="font-bold text-gray-700">生命保険料 (県民共済等)</span>
                <span className="font-black text-gray-900">¥{summary.taxDeduction.lifeInsuranceKenmin.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-50 text-indigo-600 italic">
                <span className="font-bold">iDeCo / 小規模企業共済掛金</span>
                <span className="font-black">¥{summary.taxDeduction.ideco.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-b border-gray-50 text-gray-400">
                <span className="font-bold">給与天引分 (社会保険料)</span>
                <span className="font-black">¥{summary.salary.socialInsurance.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100">
            <p className="text-[10px] text-red-700 font-bold leading-relaxed italic">
              ※ 年末調整済みの給与がある場合、その社会保険料もここに合算されます。<br/>
              ※ 各控除証明書の金額を基に、確定申告書Bの該当欄へ転記してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
