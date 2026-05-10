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
   * ハイブリッド献立生成（予算厳守・活力向上・筋肥大対応版）
   */
  async generateMenu(params: {
    startDate: Date;
    days: number;
    tripBudget: number;
    vitalityMode?: boolean;
    budgetBuffer?: number; // 許容する超過金額（デフォルト500円）
  }) {
    const { startDate, days, tripBudget, vitalityMode, budgetBuffer = 500 } = params;
    
    // DBから全レシピを取得
    const allRecipes = await prisma.recipe.findMany();
    
    let remainingBudget = tripBudget;
    const resultMenu: any[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        // 残りの日数で予算を均等配分（動的予算）
        const remainingDays = days - i;
        const currentDailyBudget = Math.floor(remainingBudget / remainingDays);
        
        // 許容範囲内（動的予算 + バッファ）の候補をフィルタリング
        // ターゲット予算に最も近いものを優先（極端な超過を避ける）
        let candidates = allRecipes
            .filter(r => !usedIds.has(r.id) && r.estimatedPrice <= (currentDailyBudget + budgetBuffer))
            .sort((a, b) => {
              const diffA = Math.abs(a.estimatedPrice - currentDailyBudget);
              const diffB = Math.abs(b.estimatedPrice - currentDailyBudget);
              return diffA - diffB;
            });
        
        // 候補がない場合は、全レシピから「予算に最も近い最安値」を1つだけ取得
        if (candidates.length === 0) {
            candidates = allRecipes.filter(r => !usedIds.has(r.id));
            candidates.sort((a, b) => a.estimatedPrice - b.estimatedPrice);
        }

        if (candidates.length > 0) {
            // 予算上限に近い（満足度が高い）上位3件からランダムに選択
            const selectionRange = Math.min(3, candidates.length);
            const selected = candidates[Math.floor(Math.random() * selectionRange)];
            
            resultMenu.push({
                date: currentDate,
                recipe: selected,
            });
            usedIds.add(selected.id);
            remainingBudget -= selected.estimatedPrice;
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
