import { prisma } from '../prisma';

export interface RecipeCandidate {
  id: string;
  name: string;
  estimatedPrice: number;
  ingredients: string;
}

export const HouseholdLogic = {
  /**
   * 1回あたりの買い物予算を計算
   */
  calculateTripBudget(monthlyBudget: number, tripsPerMonth: number, reserveRate = 0.05) {
    const effectiveBudget = monthlyBudget * (1 - reserveRate);
    return Math.floor(effectiveBudget / tripsPerMonth);
  },

  /**
   * ハイブリッド献立生成（簡易版：DB連携）
   */
  async generateMenu(params: {
    startDate: Date;
    days: number;
    tripBudget: number;
    vitalityMode?: boolean;
  }) {
    const { startDate, days, tripBudget, vitalityMode } = params;
    
    // DBから全レシピを取得
    const allRecipes = await prisma.recipe.findMany();
    
    const dailyBudget = Math.floor(tripBudget / days);
    const resultMenu: any[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        // 予算内の候補をフィルタリングし、がっつり系（高単価）を優先するため価格降順にソート
        let candidates = allRecipes
            .filter(r => !usedIds.has(r.id) && r.estimatedPrice <= dailyBudget)
            .sort((a, b) => b.estimatedPrice - a.estimatedPrice);
        
        // 候補がない場合は全レシピから最安値（に近いもの）を取得
        if (candidates.length === 0) {
            candidates = allRecipes.filter(r => !usedIds.has(r.id));
            candidates.sort((a, b) => a.estimatedPrice - b.estimatedPrice);
        }

        // 上位候補（高単価なもの）からランダムに1つ選択
        if (candidates.length > 0) {
            const selected = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
            resultMenu.push({
                date: currentDate,
                recipe: selected,
            });
            usedIds.add(selected.id);
        }
    }

    return resultMenu;
  },

  /**
   * 買い物リストの合計金額を計算
   */
  calculateTotalCost(menu: any[]) {
    return menu.reduce((sum, item) => sum + (item.recipe?.estimatedPrice || 0), 0);
  }
};
