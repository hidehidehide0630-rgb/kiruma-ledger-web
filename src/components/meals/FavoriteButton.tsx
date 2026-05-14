'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface FavoriteButtonProps {
  recipeId: string;
  initialIsFavorite: boolean;
}

export default function FavoriteButton({ recipeId, initialIsFavorite }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/household/recipes/${recipeId}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !isFavorite })
      });

      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);
      } else {
        console.error('Failed to toggle favorite');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={isLoading}
      className={`p-2 rounded-full transition-all transform active:scale-90 ${
        isFavorite 
          ? 'bg-amber-100 text-amber-500 shadow-inner' 
          : 'bg-gray-50 text-gray-300 hover:text-gray-400'
      }`}
      title={isFavorite ? 'お気に入りから外す' : 'お気に入りに追加'}
    >
      <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={isFavorite ? 0 : 2} />
    </button>
  );
}
