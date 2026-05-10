import { prisma } from '../prisma';

export interface RecipeCandidate {
  id: string;
  name: string;
  estimatedPrice: number;
  ingredients: string;
}

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface RecipeCandidate {
  id: string;
  name: string;
  estimatedPrice: number;
  ingredients: string;
}

// データベースを使わず、毎回新しいUUIDを生成するためのヘルパー
const generateId = () => Math.random().toString(36).substring(2, 15);

export const HouseholdLogic = {
  /**
   * 1回あたりの買い物予算を計算
   */
  calculateTripBudget(monthlyBudget: number, tripsPerMonth: number, reserveRate = 0.05) {
    const effectiveBudget = monthlyBudget * (1 - reserveRate);
    return Math.floor(effectiveBudget / tripsPerMonth);
  },

  /**
   * ハイブリッド献立生成（LLMを使用した一気通貫の販売単位・使い切り生成）
   */
  async generateMenu(params: {
    startDate: Date;
    days: number;
    tripBudget: number;
    vitalityMode?: boolean;
    budgetBuffer?: number; // 許容する超過金額
  }) {
    const { startDate, days, tripBudget, vitalityMode } = params;
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    // JSONを確実に出力させるため Gemini 3.1 Pro 相当などの最新モデルを使用
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            dailyPlans: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  recipeName: { type: SchemaType.STRING },
                  estimatedPrice: { type: SchemaType.INTEGER },
                  ingredients: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        name: { type: SchemaType.STRING },
                        quantity: { type: SchemaType.STRING },
                        price: { type: SchemaType.INTEGER }
                      },
                      required: ["name", "quantity", "price"]
                    }
                  }
                },
                required: ["recipeName", "estimatedPrice", "ingredients"]
              }
            }
          },
          required: ["dailyPlans"]
        }
      }
    });

    const prompt = `
あなたはプロの家計管理アドバイザーであり、シェフです。
以下の条件に従って、${days}日分の完璧な献立と買い物リストを生成してください。

【条件】
1. **総予算**: 約${tripBudget}円。これに収まるように購入する食材を決定してください。
2. **販売単位の考慮**: 食材は「スーパーで実際に販売されている単位（例：人参1袋3本、鶏もも肉1パック2枚）」で購入したと想定してください。
3. **完全使い切りパズル**: 
   - 買った食材は、${days}日間の献立内で**必ず全て使い切って**ください。冷蔵庫に端数を残さないでください。
   - 献立は1日1食（夕食など）を想定し、主菜・副菜・汁物を合わせた形でレシピ名を決めてください。
4. **価格の配分（超重要）**:
   - 各材料の \`price\` は、その販売単位の「購入価格」を意味します。
   - ただし、同じ販売単位の食材を複数日に分けて使う場合、**最初に登場する日にのみ購入価格（全額）を \`price\` として計上し、2日目以降に使う際の \`price\` は必ず 0 にしてください。**
   - これにより、全日数の \`price\` を足し合わせた金額が、レジでの総支払額（約${tripBudget}円）と完全に一致するようにしてください。
   - 食材の \`name\` は、「人参 (1袋3本)」のように、全てのレシピで**一言一句完全に同じ文字列**を使用してください。文字列が一致しないと同一食材とみなされません。
5. **常備品ルール**:
   - 米、塩、醤油、油、バターなどの基本調味料は「0円」として計算してください。これらもリストに含めて構いませんが、 \`price\` は常に 0 です。
${vitalityMode ? '6. **バイタリティモードON**: テストステロン値を高め、血管の健康（NO産生）を意識した食材（ニラ、牛肉、スイカ、キュウリ、牡蠣など）を優先的に組み込んでください。' : ''}

【出力形式】
JSONスキーマに従い、dailyPlans配列に${days}日分のレシピ情報を入れてください。
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("LLM JSON Parse Error:", e, responseText);
      throw new Error("Failed to generate menu. Invalid JSON.");
    }

    const dailyPlans = data.dailyPlans;
    const resultMenu: any[] = [];

    for (let i = 0; i < dailyPlans.length; i++) {
        const plan = dailyPlans[i];
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        // 新しいレシピとしてDBに保存するためのデータを組み立てる
        // 実際の保存処理は呼び出し元（route.ts）で行うため、ここではRecipeオブジェクトの形にして返す
        const recipeId = "generated_" + generateId();
        
        resultMenu.push({
            date: currentDate,
            recipe: {
                id: recipeId,
                name: plan.recipeName,
                estimatedPrice: plan.estimatedPrice,
                ingredients: JSON.stringify(plan.ingredients),
                instructions: "（AIによる自律生成献立のため、詳細な手順は省略されています。材料を使い切るように調理してください）",
                isFavorite: false
            },
        });
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
