'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ManualEntry {
  category: 'INCOME' | 'EXPENSE' | 'EXCLUDE';
  title: string;
  menu: string;
  link: string;
  items: string;
  notes: string;
  tags: string[];
}

const MANUAL_DATA: ManualEntry[] = [
  // 収入
  {
    category: 'INCOME',
    title: '業務委託の入金',
    menu: '売上入力',
    link: '/sales',
    items: '額面（16万）、振込額（14.5万強）',
    notes: '差額は「源泉所得税」として自動計上されます。',
    tags: ['業務委託', '売上', '源泉所得税', '振込']
  },
  {
    category: 'INCOME',
    title: 'AEON等のバイト代',
    menu: '給与入力',
    link: '/salaries',
    items: '総支給額、所得税、社会保険料',
    notes: '住民税は入力不要。事業の売上とは分離されます。',
    tags: ['バイト', '給与', '住民税', '社会保険']
  },
  {
    category: 'INCOME',
    title: '社員化後の給与',
    menu: '給与入力',
    link: '/salaries',
    items: '額面、所得税、社会保険料（健保・厚生年金）',
    notes: '厚生年金などは「社会保険料」欄に合算してOK。',
    tags: ['正社員', '給与', '厚生年金', '社会保険']
  },
  // 支出
  {
    category: 'EXPENSE',
    title: 'カフェ代（打合せ）',
    menu: '仕訳入力 (会議費)',
    link: '/journal',
    items: '会議費 (按分不要)',
    notes: '自分の分のみ。プライベートは除外。',
    tags: ['カフェ', '打ち合わせ', '会議費', '喫茶']
  },
  {
    category: 'EXPENSE',
    title: 'PC周辺機器・ソフト代',
    menu: '仕訳入力 (消耗品費)',
    link: '/journal',
    items: '消耗品費 (按分不要)',
    notes: '10万円未満のもの。',
    tags: ['PC', 'マウス', 'キーボード', 'ソフト', '消耗品']
  },
  {
    category: 'EXPENSE',
    title: '10万円以上のPC・家電',
    menu: '固定資産登録',
    link: '/assets',
    items: '減価償却 (按分不要)',
    notes: '減価償却メニューへ。耐用年数を確認。',
    tags: ['PC', '家電', '10万円', '固定資産', '減価償却']
  },
  {
    category: 'EXPENSE',
    title: '家賃・電気・ガス代',
    menu: '仕訳入力',
    link: '/journal',
    items: '各該当科目 (按分必要：全額入力)',
    notes: 'アプリが年末に一括で事業分を算出します。',
    tags: ['家賃', '電気', 'ガス', '水道光熱費', '按分']
  },
  {
    category: 'EXPENSE',
    title: 'ネット代・スマホ代',
    menu: '仕訳入力 (通信費)',
    link: '/journal',
    items: '通信費 (按分必要：全額入力)',
    notes: '仕事利用分を％で後ほど計算。',
    tags: ['ネット', 'スマホ', '通信費', 'プロバイダ', '按分']
  },
  {
    category: 'EXPENSE',
    title: '国民健康保険・国民年金',
    menu: '仕訳入力',
    link: '/journal',
    items: '所得控除：国民健康保険/年金 (按分不要)',
    notes: '「所得控除：」で始まる科目を選択してください。月払い・年一括どちらも対応。',
    tags: ['国保', '国民年金', '社会保険料控除', '所得控除']
  },
  {
    category: 'EXPENSE',
    title: '生命保険料・iDeCo',
    menu: '仕訳入力',
    link: '/journal',
    items: '所得控除：生命保険料/iDeCo (按分不要)',
    notes: '控除証明書や振込額に基づき、「所得控除：」科目で入力してください。',
    tags: ['生命保険', 'iDeCo', '小規模企業共済', '所得控除']
  },
  // 入力不要
  {
    category: 'EXCLUDE',
    title: 'NISA (ニーサ)',
    menu: '入力不要',
    link: '#',
    items: '非課税対象',
    notes: '運用益も非課税のため、確定申告にも帳簿にも不要です。',
    tags: ['NISA', '投資', '非課税']
  },
  {
    category: 'EXCLUDE',
    title: '住民税',
    menu: '入力不要',
    link: '#',
    items: '経費・控除対象外',
    notes: '事業の経費にも所得控除にもなりません。',
    tags: ['住民税', '税金']
  },
  {
    category: 'EXCLUDE',
    title: 'ふるさと納税',
    menu: '入力不要 (外部入力)',
    link: '#',
    items: '寄付金控除',
    notes: '国税庁サイト等で直接入力するため、本アプリでの集計は不要です。',
    tags: ['ふるさと納税', '奇付金控除']
  },
  {
    category: 'EXCLUDE',
    title: '所得税の還付金',
    menu: '入力不要',
    link: '#',
    items: '不課税',
    notes: '利益ではないため売上に入れないでください。事業用口座なら「事業主借」処理。',
    tags: ['還付金', '所得税']
  },
  {
    category: 'EXCLUDE',
    title: 'タバコ・私用の食事',
    menu: '入力不可',
    link: '#',
    items: '家事私費',
    notes: '事業に関係ない私費は絶対に帳簿に載せないでください。',
    tags: ['タバコ', '私費', '酒']
  }
];

export default function ManualPage() {
  const [search, setSearch] = useState('');

  const filtered = MANUAL_DATA.filter(entry => 
    entry.title.includes(search) || 
    entry.notes.includes(search) || 
    entry.tags.some(tag => tag.includes(search)) ||
    entry.menu.includes(search)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      {/* Search Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2.5rem] p-10 shadow-2xl shadow-amber-900/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -mr-20 -mt-20 shrink-0" />
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner">📖</div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
              Recording Reference <span className="text-amber-200">/ 記帳マニュアル</span>
            </h1>
          </div>
          <p className="text-amber-50 font-bold max-w-2xl leading-relaxed">
            「これって何費？」「このお金はどう入れる？」を解決。
            キーワード検索で、正しいメニューと処理方法を確認できます。
          </p>
          <div className="relative max-w-xl">
            <input 
              type="text" 
              placeholder="例: タバコ, 電気代, ふるさと納税..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/95 backdrop-blur shadow-xl border-none rounded-2xl px-6 py-4 text-amber-900 font-black placeholder:text-amber-300 outline-none focus:ring-4 focus:ring-amber-300 transition-all"
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl">🔍</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {/* Income Section */}
        <section className="space-y-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
            <span className="h-[2px] w-8 bg-green-500 rounded-full" />
            Incomes / 収入
          </h2>
          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">事象</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">メニュー</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">項目</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">注意点</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.filter(e => e.category === 'INCOME').map((entry, i) => (
                  <tr key={i} className="hover:bg-green-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-800 text-lg">{entry.title}</div>
                    </td>
                    <td className="px-8 py-6">
                      <Link href={entry.link} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-black transition-all">
                        {entry.menu}
                      </Link>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-gray-600 leading-relaxed">{entry.items}</td>
                    <td className="px-8 py-6 text-sm font-bold text-gray-400 italic">{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Expense Section */}
        <section className="space-y-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
            <span className="h-[2px] w-8 bg-red-400 rounded-full" />
            Expenses / 支出
          </h2>
          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">買ったもの</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">メニュー</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">按分</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.filter(e => e.category === 'EXPENSE').map((entry, i) => (
                  <tr key={i} className="hover:bg-red-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="font-black text-gray-800 text-lg">{entry.title}</div>
                    </td>
                    <td className="px-8 py-6">
                      <Link href={entry.link} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white text-[10px] font-black rounded-xl hover:bg-black transition-all">
                        {entry.menu}
                      </Link>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${entry.items.includes('按分必要') ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                        {entry.items.includes('按分必要') ? '必要' : '不要'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-gray-400 italic">{entry.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Exclusion List (Input Not Needed) */}
        <section className="space-y-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
            <span className="h-[2px] w-8 bg-gray-400 rounded-full" />
            Exclusion List / 入力不要なもの
          </h2>
          <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.filter(e => e.category === 'EXCLUDE').map((entry, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start justify-between group overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gray-50 rounded-full -mr-10 -mt-10 group-hover:bg-red-50 transition-colors" />
                  <div className="relative z-10 pr-4">
                    <h4 className="font-black text-gray-800 text-lg mb-1">{entry.title}</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase mb-2 italic">Reason: {entry.items}</p>
                    <p className="text-xs text-gray-500 font-bold leading-relaxed">{entry.notes}</p>
                  </div>
                  <div className="shrink-0 pt-1">
                    <span className="bg-gray-200 text-gray-500 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                      {entry.menu}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <p className="font-black text-gray-400 uppercase tracking-widest text-xl">No match found</p>
          </div>
        )}
      </div>

      <div className="bg-indigo-950 rounded-3xl p-8 border border-white/10 flex flex-col md:flex-row items-center justify-between shadow-2xl gap-8">
        <div className="flex items-center gap-6">
          <div className="text-4xl animate-pulse">💡</div>
          <div>
            <h4 className="text-white font-black uppercase text-sm italic tracking-widest">Entry Guide Note</h4>
            <div className="text-indigo-300 text-xs font-bold mt-1 space-y-2">
              <div className="p-4 bg-indigo-900/50 border border-indigo-500/30 rounded-xl text-indigo-100">
                <p className="font-black text-[10px] uppercase tracking-widest text-indigo-400 mb-1 italic underline">How to Record Deductions</p>
                国民健康保険・年金・生命保険料などは、通常の「仕訳入力」から入力してください。勘定科目に<span className="text-amber-400 font-black">「所得控除：〇〇」</span>という専用の科目を用意しています。これらを選ぶだけで、レポートには自動的に所得控除として集計されます。
              </div>
            </div>
          </div>
        </div>
        <Link href="/" className="px-8 py-4 bg-white text-indigo-950 font-black rounded-2xl text-xs hover:bg-indigo-50 transition-all uppercase italic shrink-0 shadow-lg">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
