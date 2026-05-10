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

    const totalBudgetWithBuffer = tripBudget + 500;

    const prompt = `
あなたはKIRUMA COMPANYの専属シェフ兼、プロの購買マネージャーです。
「捏造は即解雇」という絶対的なルールの下、${days}日分の昼食メインの献立と買い物リストを作成してください。

【今回の最優先テーマ】
- 勃起力の向上・改善（亜鉛、アルギニン、シトルリン、ビタミンEを重視）
- 胸筋・腹筋の強化（高タンパク、低脂質）
- 体形の絞り（低GI食品、適正カロリー）

【献立生成の思考プロセス（厳守）】
1. **メインディッシュの選定**: 上記テーマを達成するための主菜を${days}日分決めます。
2. **食材の効率化**: 主菜で購入した食材を極力使い切るように計画します。
3. **副菜・汁物（任意）**: 主菜で余った食材がある場合、または極めて低コストで済む場合にのみ、副菜や汁物を追加してください。マストではありません。

【最重要事項：捏造の禁止】
- **予算内に収めるために在庫リストを捏造することは、システムを破壊する『重大な違反行為』です。**
- 在庫リスト（${inventoryList}）にない食材を「在庫利用（isFirstPurchase: false / 0円）」にすることは、いかなる理由があっても厳禁です。
- 予算が足りない場合は、**迷わず、躊躇なく、予算を大幅にオーバーしてでも「新規購入（isFirstPurchase: true）」として価格を計上してください。** 予算オーバーは100%許容されますが、捏造は0.1%も許容されません。

【予算のガイドライン】
- 今回の目安予算: ${totalBudgetWithBuffer}円。
- **この金額はあくまで『目安』です。** 超過しても全く問題ありません。正直な買い物リストを作ることがあなたの唯一の任務です。
- 1週間で3000円程度（1日400-500円）あれば、健康的な食事は十分に可能です。計算を放棄せず、論理的に導き出してください。

【食材と単位】
- 単位: 「鶏むね肉 1枚(約300g)」「卵 1パック(10個)」など、現実の買い物単位で出力してください。

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
    console.log("🛡️ HARNESS: Starting inventory validation...");
    const dailyPlans = data.dailyPlans || [];
    const inventoryNames = inventory.map(i => i.name);
    const staples = ["塩", "砂糖", "醤油", "味噌", "油", "酢", "酒", "みりん", "米", "水", "マヨネーズ", "ケチャップ", "胡椒", "唐辛子", "ニンニク", "生姜"];

    for (const plan of dailyPlans) {
      for (const ingredient of plan.ingredients) {
        if (!ingredient.isFirstPurchase) {
          const name = ingredient.purchaseUnit;
          const isStaple = staples.some(s => name.includes(s));
          const isInInventory = inventoryNames.some(i => name.includes(i));
          
          if (!isStaple && !isInInventory) {
            console.error(`🛡️ HARNESS FAILURE: Hallucinated Inventory Detected -> ${name}`);
            throw new Error(`AIが在庫を捏造しました（${name}）。在庫リストにない食材を「在庫利用」として計上することは禁止されています。`);
          }
        }
      }
    }
    console.log("🛡️ HARNESS: Validation passed. No hallucinations detected.");
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

