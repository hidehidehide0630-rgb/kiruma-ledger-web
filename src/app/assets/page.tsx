'use client';

import { useState, useEffect } from 'react';

interface Asset {
  id: number;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  usefulLife: number;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [name, setName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [usefulLife, setUsefulLife] = useState('4'); // パソコンの一般的な耐用年数
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    const res = await fetch('/api/assets');
    const data = await res.json();
    setAssets(data);
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !purchasePrice || !usefulLife) return;

    setLoading(true);
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, purchaseDate, purchasePrice, usefulLife }),
      });
      if (!res.ok) throw new Error('登録に失敗しました');
      setName('');
      setPurchasePrice('');
      await fetchAssets();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter">FIXED ASSETS / 固定資産管理</h2>
          <p className="text-sm font-bold text-gray-400 mt-2 uppercase tracking-widest">Depreciation & Asset Tracking</p>
        </div>
        <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-amber-200">
          Blue Return Compliance
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Registration Form */}
        <form onSubmit={handleAddAsset} className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100 space-y-5 sticky top-8">
          <h3 className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4">Register New Asset</h3>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Asset Name / 品名</label>
            <input
              type="text"
              placeholder="例: Mac Studio"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 focus:border-indigo-500 outline-none font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Date / 購入日</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 focus:border-indigo-500 outline-none font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Price / 購入金額 (10万円以上)</label>
            <input
              type="number"
              placeholder="100000"
              value={purchasePrice}
              onChange={e => setPurchasePrice(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 focus:border-indigo-500 outline-none font-black text-indigo-600 text-lg"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Life / 耐用年数 (年)</label>
            <select
              value={usefulLife}
              onChange={e => setUsefulLife(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-3 focus:border-indigo-500 outline-none font-bold"
            >
              <option value="4">4年 (パソコン等)</option>
              <option value="5">5年 (周辺機器等)</option>
              <option value="6">6年 (車両等)</option>
              <option value="10">10年 (家具等)</option>
              <option value="15">15年 (建物附属設備等)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-100 transition-all uppercase tracking-widest text-xs"
          >
            {loading ? 'Adding...' : 'Register Asset / 資産登録'}
          </button>
        </form>

        {/* List */}
        <div className="md:col-span-2 space-y-6">
          {assets.length === 0 ? (
            <div className="bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 p-20 text-center">
              <span className="text-gray-300 font-black uppercase tracking-widest text-sm">No Assets Registered</span>
            </div>
          ) : (
            assets.map(asset => {
              const annualDep = Math.floor(asset.purchasePrice / asset.usefulLife);
              return (
                <div key={asset.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 flex flex-col md:flex-row items-stretch">
                  <div className="p-8 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-xl font-black text-gray-800 tracking-tight">{asset.name}</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(asset.purchaseDate).toLocaleDateString('ja-JP')} 購入</p>
                      </div>
                      <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full border border-indigo-100">
                        {asset.usefulLife} YEARS
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <div className="text-[10px] font-black text-gray-400 uppercase mb-1 leading-none">Original Cost / 取得価額</div>
                        <div className="text-2xl font-black text-gray-900">¥{asset.purchasePrice.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-indigo-400 uppercase mb-1 leading-none">Annual Depr. / 年間償却額</div>
                        <div className="text-2xl font-black text-indigo-600">¥{annualDep.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 px-8 py-8 md:w-48 flex flex-col justify-center border-t md:border-t-0 md:border-l border-indigo-100">
                    <div className="text-[10px] font-black text-indigo-400 uppercase mb-2">Progress</div>
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-2xl font-black text-indigo-700 leading-none">{(100 / asset.usefulLife).toFixed(0)}</span>
                      <span className="text-xs font-black text-indigo-400 mb-0.5">% / Year</span>
                    </div>
                    <div className="w-full h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-1000"
                        style={{ width: `${100 / asset.usefulLife}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
