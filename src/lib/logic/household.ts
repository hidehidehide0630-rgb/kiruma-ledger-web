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
                        purchaseUnit: { type: SchemaType.STRING, description: "スーパーで買う時の名称（例：人参 1袋3本）" },
                        usageAmount: { type: SchemaType.STRING, description: "このレシピで使う分量（例：1/2本）" },
                        unitPrice: { type: SchemaType.INTEGER, description: "販売単位の税込価格（例：198）" },
                        isFirstPurchase: { type: SchemaType.BOOLEAN, description: "この食材をこの期間中に初めて購入し、レジで支払う日であればtrue" }
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

    const prompt = `
あなたはプロの家計管理アドバイザーであり、シェフです。
以下の条件に従って、${days}日分の「完璧なフルコース献立」と「現実的な買い物リスト」を生成してください。

【条件】
1. **総予算**: 約${tripBudget}円。レジでの支払総額をこの予算内に収めてください。
2. **販売単位（購入単位）の徹底**: 
   - 買い物リストには「スーパーで実際に売られている単位（例：人参 1袋3本、豚バラ肉 1パック300g）」で記載してください。
   - レシピで使う分量がその一部（例：人参1/2本）であっても、買い物リストには販売単位（1袋）を記載します。
3. **完全使い切りパズル**: 
   - 買った食材は、${days}日間の献立内で**必ず全て使い切って**ください。冷蔵庫に端数を残さないでください。
   - 1週間後に冷蔵庫が空になるのがゴールです。
4. **献立の構成**: 
   - 毎日、必ず「主菜（Main）」「副菜（Side）」「汁物（Soup）」の3点構成にしてください。
   - 同じ食材を複数の料理（例：主菜と汁物の両方に玉ねぎを使う）に割り振って、効率よく使い切ってください。
5. **支払い金額の計算（重要）**:
   - \`unitPrice\` は販売単位の価格です。
   - \`isFirstPurchase\` が \`true\` の場合のみ、その日の \`dailyEstimatedPrice\` に加算されます。
   - 同じ販売単位（例：同じ人参の袋）を複数日に分けて使う場合、2日目以降のレシピでは \`isFirstPurchase\` を \`false\` にし、価格計上されないようにしてください。
   - 合計の \`dailyEstimatedPrice\` を足したものが、全体の支払額となります。
6. **調理指示**:
   - 各料理（主菜・副菜・汁物）の簡単な作り方を \`instructions\` に含めてください。
7. **常備品**:
   - 米、基本調味料は 0円としてリストに含めてください。
${vitalityMode ? '8. **バイタリティモードON**: テストステロンと血管健康を最大化する食材（ニラ、赤身肉、ブロッコリー、アボカド等）を主軸にしてください。' : ''}

【出力】
JSON形式で、各日の menu (main, side, soup), instructions, ingredients の詳細を出力してください。
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // MarkdownのJSONブロック記法が含まれている場合、それを取り除く
    responseText = responseText.replace(/^```(json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("LLM JSON Parse Error:", e);
      console.error("Raw response text:", responseText);
      throw new Error("Failed to generate menu. Invalid JSON.");
    }

    const dailyPlans = data.dailyPlans;
    const resultMenu: any[] = [];

    for (let i = 0; i < dailyPlans.length; i++) {
        const plan = dailyPlans[i];
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);

        const recipeId = "generated_" + generateId();
        
        // UIでの表示用に名前を構造化
        const structuredName = JSON.stringify(plan.menu);
        const structuredInstructions = JSON.stringify(plan.instructions);

        resultMenu.push({
            date: currentDate,
            recipe: {
                id: recipeId,
                name: structuredName,
                estimatedPrice: plan.dailyEstimatedPrice,
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

