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
あなたはプロの家計管理アドバイザーであり、超合理的なシェフです。
以下の条件に従って、${days}日分の「完璧なフルコース献立」と「現実的な買い物リスト」を生成してください。

【現在の冷蔵庫の在庫（事実）】
${inventoryList}

【条件：在庫利用の死守ルール】
1. **在庫リストが「なし」の場合、いかなる食材（肉、野菜、魚等）も「在庫利用」とすることは絶対に許されません。**
2. 全ての食材は、必ず買い物リストに載せ、\`isFirstPurchase: true\` とし、\`unitPrice\` を計上してください。
3. **例外は基本調味料のみ**: 塩、砂糖、醤油、味噌、油、酢、酒、みりん、米、水、マヨネーズ、ケチャップのみ 0円（在庫利用扱い）としてOKです。これ以外の「卵」「玉ねぎ」「豚肉」などは、在庫リストになければ必ず「購入」扱いにしてください。
4. 在庫リストにある食材（${inventoryList}）を献立に使う場合のみ、\`isFirstPurchase: false\` として計上してください。

【その他の条件】
1. **総予算**: 約${tripBudget}円。レジでの支払総額をこの予算内に収めてください。
2. **販売単位の徹底**: スーパーで売られている単位（例：人参 1袋3本、肉 1パック）で計上すること。
3. **完全使い切り**: 買った食材は${days}日間で必ず使い切り、端数を残さないこと。
4. **献立構成**: 毎日必ず「主菜・副菜・汁物」の3点構成にすること。
5. **調理指示**: 各料理の具体的な作り方を \`instructions\` に含めること。
${vitalityMode ? '6. **バイタリティモードON**: テストステロンと血管健康を最大化する食材を主軸にしてください。' : ''}

【重要】
予算が厳しくても、在庫を捏造して帳尻を合わせることは「不正」です。予算オーバーしそうな場合は、豪華な食材を避け、安い食材（もやし、鶏むね肉、豆腐等）を駆使して予算内に収めてください。

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

    // --- 🛡️ HARNESS: 捏造検知バリデーション ---
    const dailyPlans = data.dailyPlans || [];
    const inventoryNames = inventory.map(i => i.name);
    const staples = ["塩", "砂糖", "醤油", "味噌", "油", "酢", "酒", "みりん", "米", "水", "マヨネーズ", "ケチャップ"];

    for (const plan of dailyPlans) {
      for (const ingredient of plan.ingredients) {
        // 在庫利用（isFirstPurchase: false）と判断された場合
        if (!ingredient.isFirstPurchase) {
          const name = ingredient.purchaseUnit;
          // 基本調味料でもなく、かつ在庫リストにも存在しない場合、それは捏造。
          const isStaple = staples.some(s => name.includes(s));
          const isInInventory = inventoryNames.some(i => name.includes(i));
          
          if (!isStaple && !isInInventory) {
            console.error(`🛡️ HARNESS FAILURE: Hallucinated Inventory Detected -> ${name}`);
            throw new Error(`AIが在庫を捏造しました（${name}）。予算設定を見直すか、もう一度お試しください。`);
          }
        }
      }
    }
    // ----------------------------------------

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

