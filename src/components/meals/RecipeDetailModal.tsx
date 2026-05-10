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

  let ingredients: Ingredient[] = [];
  try {
    const parsed = JSON.parse(recipe.ingredients);
    ingredients = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse ingredients', e);
  }

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-600 p-8 sm:p-10 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <span className="text-xl">✕</span>
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">Recipe Details</span>
            <span className="text-xs font-bold opacity-80 italic">¥{recipe.estimatedPrice.toLocaleString()}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter leading-tight">
            {recipe.name}
          </h2>
        </div>

        <div className="p-8 sm:p-10 overflow-y-auto max-h-[calc(90vh-180px)] space-y-10 custom-scrollbar">
          {/* Ingredients Section */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <span className="w-10 h-10 flex items-center justify-center bg-pink-50 text-pink-600 rounded-xl text-xl">🥬</span>
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Ingredients</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ingredients.length > 0 ? (
                ingredients.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-pink-100 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-700">{item.name}</span>
                      {item.price && (
                        <span className="text-[10px] font-black text-pink-600 italic">
                          ¥{item.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-pink-500 bg-white px-3 py-1 rounded-full shadow-sm">{item.quantity}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 font-bold italic p-4">No ingredients listed.</p>
              )}
            </div>
          </section>

          {/* Instructions Section */}
          <section>
            <div className="flex items-center gap-4 mb-6">
              <span className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl text-xl">👨‍🍳</span>
              <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">Cooking Instructions</h3>
            </div>
            <div className="space-y-6">
              {recipe.instructions.split('\n').map((step, idx) => (
                <div key={idx} className="flex gap-5 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform">
                    {idx + 1}
                  </div>
                  <p className="text-gray-600 font-medium leading-relaxed pt-1">
                    {step.replace(/^\d+[\.\s]+/, '')}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Tips Section (Mock) */}
          <section className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">💡</span>
              <h4 className="font-black text-amber-900 tracking-tight">Vitality Tip</h4>
            </div>
            <p className="text-sm text-amber-800 leading-relaxed font-bold opacity-80">
              このレシピには血流改善を助ける成分が含まれています。調理の最後にオリーブオイルを少量足すと、脂溶性ビタミンの吸収率がさらに高まります。
            </p>
          </section>
        </div>

        {/* Footer */}
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
