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
あなたはKIRUMA COMPANYの専属シェフ兼、厳格な会計士です。
「捏造は解雇」という絶対的なルールの下、${days}日分の献立と買い物リストを作成してください。

【思考の絶対優先順位】
1. **在庫リスト（事実）の確認**:
   ${inventoryList}
   ここにあるものだけが「在庫利用（isFirstPurchase: false / 0円）」にできます。
2. **価格の計上**:
   在庫リストにない食材は、たとえ予算を数千円オーバーしようとも、**必ず価格を付けて買い物リストに載せてください。**
   「在庫を捏造して0円にする」行為はシステムで自動検知され、即座にエラーとなります。正直に価格を出してください。
3. **主菜ファースト**:
   ${days}日分のメインディッシュをまず決めてください。副菜と汁物は、主菜の余り物で賄える場合のみ提案してください（マストではありません）。

【予算と単位】
- 目標予算: ${tripBudget}円（+最大500円の超過はOK）。
- 単位: 「鶏もね肉 1枚(約300g)」「卵 1パック(10個)」など、現実の買い物と同じ形式。

【肉体覚醒テーマ】
- 男性機能最大化（亜鉛、シトルリン等）
- 筋肥大・体脂肪の絞り

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

