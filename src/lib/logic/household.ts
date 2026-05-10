import { prisma } from '../prisma';

export interface RecipeCandidate {
  id: string;
  name: string;
  estimatedPrice: number;
  ingredients: string;
}

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

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
    budgetBuffer?: number;
  }) {
    const { startDate, days, tripBudget, vitalityMode } = params;
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
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
                  menu: {
                    type: SchemaType.OBJECT,
                    properties: {
                      main: { type: SchemaType.STRING },
                      side: { type: SchemaType.STRING },
                      soup: { type: SchemaType.STRING }
                    },
                    required: ["main", "side", "soup"]
                  },
                  instructions: {
                    type: SchemaType.OBJECT,
                    properties: {
                      main: { type: SchemaType.STRING },
                      side: { type: SchemaType.STRING },
                      soup: { type: SchemaType.STRING }
                    },
                    required: ["main", "side", "soup"]
                  },
                  dailyEstimatedPrice: { type: SchemaType.INTEGER },
                  ingredients: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        purchaseUnit: { type: SchemaType.STRING },
                        usageAmount: { type: SchemaType.STRING },
                        unitPrice: { type: SchemaType.INTEGER },
                        isFirstPurchase: { type: SchemaType.BOOLEAN }
                      },
                      required: ["purchaseUnit", "usageAmount", "unitPrice", "isFirstPurchase"]
                    }
                  }
                },
                required: ["menu", "instructions", "dailyEstimatedPrice", "ingredients"]
              }
            }
          },
          required: ["dailyPlans"]
        }
      }
    });

    // 現在の在庫を取得
    const inventory = await prisma.inventory.findMany();
    const inventoryList = inventory.length > 0 
      ? inventory.map(i => `${i.name}: ${i.quantity}${i.unit || ''}`).join(', ')
      : "なし";

    const prompt = `
あなたはプロの家計管理アドバイザーであり、シェフです。
以下の条件に従って、${days}日分の「完璧なフルコース献立」と「現実的な買い物リスト」を生成してください。

【現在の冷蔵庫の在庫】
${inventoryList}

【条件】
1. **総予算**: 約${tripBudget}円。レジでの支払総額をこの予算内に収めてください。
2. **販売単位（購入単位）の徹底**: 
   - 買い物リストには「スーパーで実際に売られている単位（例：人参 1袋3本、豚バラ肉 1パック300g）」で記載してください。
3. **完全使い切りパズル**: 
   - 買った食材は、${days}日間の献立内で**必ず全て使い切って**ください。冷蔵庫に端数を残さないでください。
4. **献立の構成**: 
   - 毎日、必ず「主菜（Main）」「副菜（Side）」「汁物（Soup）」の3点構成にしてください。
5. **在庫利用の厳格ルール**:
   - 上記の【現在の冷蔵庫の在庫】リストに存在しない食材を、勝手に「在庫がある」として扱うことを厳禁します。
   - 在庫にない食材を献立に使う場合は、必ず \`isFirstPurchase: true\` として買い物リストに載せ、金額を計上してください。
   - 同じ袋・パックを${days}日間の中で使い回す場合は、最初に出現する日だけ \`isFirstPurchase: true\` とし、2回目以降は \`false\` にしてください。
6. **支払い金額の計算**:
   - \`unitPrice\` は販売単位の価格です。
   - \`isFirstPurchase\` が \`true\` の場合のみ、その日の \`dailyEstimatedPrice\` に加算されます。
7. **調理指示**:
   - 各料理（主菜・副菜・汁物）の作り方を \`instructions\` に含めてください。
8. **常備品**:
   - 米、基本調味料（塩、醤油、味噌、油等）は 0円としてリストに含めてOKです（在庫リストになくても可）。
${vitalityMode ? '9. **バイタリティモードON**: テストステロンと血管健康を最大化する食材を主軸にしてください。' : ''}

【出力】
JSON形式で出力してください。
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    responseText = responseText.replace(/^```(json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("LLM JSON Parse Error:", e);
      throw new Error("AIの応答解析に失敗しました。再試行してください。");
    }

    const dailyPlans = data.dailyPlans || [];
    const resultMenu: any[] = [];

    for (let i = 0; i < dailyPlans.length; i++) {
        const plan = dailyPlans[i];
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        const recipeId = "generated_" + generateId();
        
        const structuredName = JSON.stringify(plan.menu);
        const structuredInstructions = JSON.stringify(plan.instructions);

        resultMenu.push({
            date: currentDate,
            recipe: {
                id: recipeId,
                name: structuredName,
                estimatedPrice: Math.floor(Number(plan.dailyEstimatedPrice) || 0),
                ingredients: JSON.stringify(plan.ingredients),
                instructions: structuredInstructions,
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

