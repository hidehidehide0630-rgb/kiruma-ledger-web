'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Ingredient {
  name: string;
  quantity: string;
  price?: number;
}

interface Recipe {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  estimatedPrice: number;
}

interface RecipeDetailModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

export default function RecipeDetailModal({ recipe, isOpen, onClose }: RecipeDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  let ingredients: any[] = [];
  try {
    const parsed = JSON.parse(recipe.ingredients);
    ingredients = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse ingredients', e);
  }

  // 名前と指示のパース
  let parsedName: any = { main: recipe.name, side: '', soup: '' };
  let parsedInstructions: any = { main: recipe.instructions, side: '', soup: '' };
  let isStructured = false;

  try {
    const n = JSON.parse(recipe.name);
    if (n.main) {
      parsedName = n;
      isStructured = true;
    }
  } catch (e) {}

  try {
    const ins = JSON.parse(recipe.instructions);
    if (ins.main) {
      parsedInstructions = ins;
    }
  } catch (e) {}

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      ></div>

      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
        <div className="bg-gradient-to-r from-pink-600 to-rose-600 p-8 sm:p-10 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <span className="text-xl">✕</span>
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">Full Menu Recipe</span>
            <span className="text-xs font-bold opacity-80 italic">Day Cost: ¥{recipe.estimatedPrice.toLocaleString()}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-tight">
            {isStructured ? parsedName.main : recipe.name}
          </h2>
          {isStructured && (
            <p className="mt-2 text-sm font-bold opacity-90 italic">
              + {parsedName.side} / {parsedName.soup}
            </p>
          )}
        </div>

        <div className="p-8 sm:p-10 overflow-y-auto max-h-[calc(90vh-180px)] space-y-10 custom-scrollbar">
          {/* Ingredients Section */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <span className="w-10 h-10 flex items-center justify-center bg-pink-50 text-pink-600 rounded-xl text-xl">🥬</span>
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Ingredients & Purchase Units</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {ingredients.length > 0 ? (
                ingredients.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-pink-100 transition-colors">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-gray-900 text-lg">{item.usageAmount || item.quantity}</span>
                        <span className="font-bold text-gray-500 text-sm">の {item.purchaseUnit || item.name}</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tight bg-indigo-50 px-2 py-0.5 rounded">
                          このレシピの原価: ¥{(item.proRatedPrice || 0).toLocaleString()}
                        </span>
                        {item.isFirstPurchase && (
                          <span className="text-[10px] font-black text-pink-600 italic bg-pink-50 px-2 py-0.5 rounded">
                            今日買うパック価格: ¥{(item.unitPrice || item.price || 0).toLocaleString()}
                          </span>
                        )}
                        {!item.isFirstPurchase && (item.unitPrice > 0 || item.price > 0) && (
                          <span className="text-[10px] font-bold text-emerald-600 italic bg-emerald-50 px-2 py-0.5 rounded">
                            ストック利用
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 font-bold italic p-4">No ingredients listed.</p>
              )}
            </div>
          </section>

          {/* Instructions Section */}
          <section className="space-y-8">
            <div className="flex items-center gap-4 mb-6">
              <span className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl text-xl">👨‍🍳</span>
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Cooking Instructions</h3>
            </div>
            
            {/* Main */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-pink-600 uppercase tracking-widest italic flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span> Main: {parsedName.main}
              </h4>
              <div className="space-y-6 pl-6 border-l-2 border-pink-100 relative">
                {parsedInstructions.main.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
                  const stepMatch = line.match(/^([0-9]+)\.\s*(.*)/);
                  const isStep = !!stepMatch;
                  const isVitalityBenefit = i < 2 && !isStep;
                  
                  if (isStep) {
                    const stepNum = stepMatch[1];
                    const content = stepMatch[2];
                    return (
                      <div key={i} className="relative group">
                        {/* Flowchart Dot/Badge */}
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 bg-white border-2 border-pink-500 rounded-full flex items-center justify-center shadow-sm group-hover:scale-125 transition-transform">
                          <div className="w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-pink-400 uppercase tracking-tighter">Step {stepNum}</span>
                          <p className="text-gray-700 font-bold leading-relaxed">{content}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className={`text-gray-600 font-medium leading-relaxed ${isVitalityBenefit ? 'text-indigo-600 font-black italic text-sm bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 shadow-sm mb-4' : ''}`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side */}
            {parsedName.side && (
              <div className="space-y-4">
                <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Side: {parsedName.side}
                </h4>
                <div className="space-y-4 pl-4 border-l-2 border-indigo-100 text-gray-600 font-medium leading-relaxed">
                   {parsedInstructions.side.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                     <div key={i}>{line}</div>
                   ))}
                </div>
              </div>
            )}

            {/* Soup */}
            {parsedName.soup && (
              <div className="space-y-4">
                <h4 className="text-sm font-black text-gray-600 uppercase tracking-widest italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Soup: {parsedName.soup}
                </h4>
                <div className="space-y-4 pl-4 border-l-2 border-gray-100 text-gray-600 font-medium leading-relaxed">
                   {parsedInstructions.soup.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                     <div key={i}>{line}</div>
                   ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">💡</span>
              <h4 className="font-black text-amber-900 tracking-tight">Zero Waste & Vitality</h4>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed font-bold opacity-80">
              この献立は1週間ですべての材料を使い切るように設計されています。常備調味料は、血管健康を促すために塩分控えめ・スパイス多めを推奨します。
            </p>
          </section>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-200"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

