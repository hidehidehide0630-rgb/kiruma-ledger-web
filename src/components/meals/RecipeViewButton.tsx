'use client';

import React, { useState } from 'react';
import RecipeDetailModal from './RecipeDetailModal';

interface Recipe {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  estimatedPrice: number;
}

interface RecipeViewButtonProps {
  recipe: Recipe;
}

export default function RecipeViewButton({ recipe }: RecipeViewButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="w-full mt-8 py-3 rounded-xl bg-gray-50 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-pink-600 hover:text-white transition-all shadow-sm hover:shadow-lg active:scale-95"
      >
        View Recipe Details
      </button>

      <RecipeDetailModal 
        recipe={recipe}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
