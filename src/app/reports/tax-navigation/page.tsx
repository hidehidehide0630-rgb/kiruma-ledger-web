'use client';

import { useState, useEffect } from 'react';

export default function TaxNavigationPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [checks, setChecks] = useState<Record<string, boolean>>({});

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

  const toggleCheck = (id: string) => {
    setChecks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple visual feedback could be added here
  };

  if (loading) return <div className="text-center p-20 font-black text-amber-400 animate-pulse">LOADING NAVIGATION DATA...</div>;
  if (!data || data.error) return <div className="p-20 text-center text-red-500 font-bold">Error loading data.</div>;

  const { summary, expenses } = data;

  const Step = ({ number, title, children }: { number: number, title: string, children: React.ReactNode }) => (
    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden mb-8">
      <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-xl">
          {number}
        </div>
        <h2 className="text-xl font-black italic tracking-tighter uppercase">{title}</h2>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  );

  const Item = ({ id, label, value, note }: { id: string, label: string, value: string | number, note?: string }) => (
    <div className={`p-4 rounded-xl border transition-all flex items-center gap-4 ${checks[id] ? 'bg-green-50 border-green-200 opacity-60' : 'bg-gray-50 border-gray-100'}`}>
      <input 
        type="checkbox" 
        id={id} 
        checked={!!checks[id]} 
        onChange={() => toggleCheck(id)}
        className="w-6 h-6 rounded-lg text-green-600 border-gray-300 focus:ring-green-500 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-xs font-black text-gray-400 uppercase tracking-widest cursor-pointer">
          {label}
        </label>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-gray-800 tabular-nums">
            {typeof value === 'number' ? `¥${value.toLocaleString()}` : value}
          </span>
          <button 
            onClick={() => copyToClipboard(typeof value === 'number' ? value.toString() : value)}
            className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-400 hover:text-amber-600"
            title="数値をコピー"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </button>
        </div>
        {note && <p className="text-[10px] text-gray-500 mt-1 font-bold italic">{note}</p>}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32">
      <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-amber-900 tracking-tighter italic uppercase leading-none">
            Tax Navigation <span className="text-amber-500">/ 確定申告サイト案内</span>
          </h1>
          <p className="text-amber-700 text-xs font-bold mt-2 italic underline decoration-amber-300 decoration-2">
            この画面を見ながら国税庁サイトへ入力してください
          </p>
        </div>
        <select 
          value={year} 
          onChange={e => setYear(e.target.value)}
          className="bg-white border-2 border-amber-200 rounded-xl px-4 py-2 font-black text-amber-900 outline-none"
        >
          <option value="2025">2025年</option>
          <option value="2026">2026年</option>
        </select>
      </div>

      <Step number={1} title="決算書の選択">
        <div className="space-y-4">
          <p className="text-sm font-bold text-gray-600 leading-relaxed">
            国税庁サイトの「申告する決算書・収支内訳書の選択」画面で以下のボタンを選んでください。
          </p>
          <div className="p-6 bg-blue-600 rounded-2xl text-white font-black text-center shadow-lg border-b-4 border-blue-800 animate-pulse">
            青色申告決算書
          </div>
          <Item id="step1-1" label="選択" value="青色申告決算書を選択" note="本アプリの複式簿記データを使用するため" />
        </div>
      </Step>

      <Step number={2} title="青色申告決算書の入力">
        <div className="space-y-4">
          <p className="text-sm font-bold text-gray-600">
            [BLOCK A] から各項目を転記してください。
          </p>
          <Item id="step2-revenue" label="売上金額" value={summary.totalRevenue} />
          <Item id="step2-withholding" label="源泉徴収税額" value={summary.totalWithholdingTax} />
          
          <div className="pt-4">
            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3 italic">経費項目の入力 (Expense Lines)</h3>
            <div className="grid grid-cols-1 gap-2">
              {expenses.filter((e: any) => e.businessAmount > 0 || e.name === '減価償却費').map((exp: any) => (
                <Item key={exp.id} id={`step2-exp-${exp.id}`} label={exp.name} value={exp.businessAmount} />
              ))}
            </div>
          </div>
        </div>
      </Step>

      <Step number={3} title="給与所得の入力">
        <div className="space-y-4">
          <p className="text-sm font-bold text-gray-600">
            [給与所得の入力] ボタンから [BLOCK B] の内容を転記してください。
          </p>
          <Item id="step3-gross" label="支払金額 (Gross Salary)" value={summary.salary.gross} />
          <Item id="step3-withholding" label="源泉徴収税額" value={summary.salary.withholdingTax} />
        </div>
      </Step>

      <Step number={4} title="所得控除の入力">
        <div className="space-y-4">
          <p className="text-sm font-bold text-gray-600">
            [BLOCK C] から社会保険料および生命保険料を転記してください。
          </p>
          <Item id="step4-social" label="社会保険料控除 (国保・年金等)" value={summary.taxDeduction.healthInsurance + summary.taxDeduction.pension} />
          <Item id="step4-life" label="一般生命保険料・共済" value={summary.taxDeduction.lifeInsuranceGeneral + summary.taxDeduction.lifeInsuranceKenmin} />
          <Item id="step4-medical" label="介護医療保険料" value={summary.taxDeduction.lifeInsuranceMedical} />
          <Item id="step4-earthquake" label="地震保険料" value={summary.taxDeduction.earthquakeInsurance} />
          <Item id="step4-ideco" label="小規模企業共済 / iDeCo" value={summary.taxDeduction.ideco} />
        </div>
      </Step>

      <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-2xl border-t-4 border-indigo-400">
        <h3 className="text-xl font-black italic tracking-tighter mb-4">You're Ready! 🚀</h3>
        <p className="text-indigo-200 text-xs font-bold leading-relaxed mb-6">
          すべてのチェックが入りましたら、最後に確定申告書の確認を行い送信して完了です。<br/>
          来年も BlueReturn でお会いしましょう！
        </p>
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-full py-4 bg-white text-indigo-950 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-400 transition-all shadow-xl"
        >
          Back to Top
        </button>
      </div>
    </div>
  );
}
