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
      model: 'gemini-1.5-flash',
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
    const isInventoryEmpty = inventory.length === 0;
    const inventoryList = isInventoryEmpty 
      ? "なし（現在冷蔵庫は空です）"
      : inventory.map(i => `${i.name}: ${i.quantity}${i.unit || ''}`).join(', ');

    // ユーザーの要望に基づき、朝食・昼食の予算のみを考慮。
    // 週3000円程度という目標を達成可能なことを強調する。
    const dailyBudgetGoal = 428; // 3000 / 7
    const targetBudget = dailyBudgetGoal * days;

    const prompt = `
あなたはKIRUMA COMPANYの専属シェフ兼、プロの精密な購買マネージャーです。
${days}日分の【朝食・昼食】の献立と買い物リストを作成してください。夕食は一切考慮しないでください。

【今回の最優先テーマ】
- 勃起力の向上・改善（亜鉛、アルギニン、シトルリン、ビタミンEを重視）
- 胸筋・腹筋の強化（高タンパク、低脂質）
- 体形の絞り（低GI食品、適正カロリー）
- **レシピの多様性**: 毎日同じ食材（例：毎日鶏むね肉とオートミールのみ）にならないよう、肉、魚、大豆製品などを日替わりでローテーションし、調理法や味付けもバリエーション豊かにしてください。

【献立生成の思考プロセス（※この順序で思考すること）】
1. **メインディッシュ（主菜）の選定**: 上記テーマを達成し、かつ${days}日間で合計${targetBudget}円程度に収まる主菜を先にすべて決めます。
2. **在庫の照合**: 決めた主菜に必要な食材を、以下の在庫リストと照合します。
3. **副菜・汁物（任意/使い切り）**: 主菜の材料が余る場合、または予算に余裕がある場合にのみ、余った食材を使い切るための副菜や汁物を追加してください。主菜の材料が余らない場合は副菜や汁物は「なし」で構いません（マストではありません）。
4. **買い物リストの確定**: 在庫にないものはすべて「新規購入」としてリストアップします。

【食材と購入ルール（捏造厳禁）】
- 在庫リスト: ${inventoryList}
${isInventoryEmpty ? '- **重要**: 現在の在庫は「なし（空）」です。いかなる食材も「在庫利用」として扱うことはできません。すべての食材は新規購入（isFirstPurchase: true）としてください。' : '- 在庫リストにない食材を「在庫利用」として扱うことは、データの整合性を破壊する「捏造」であり、絶対に許されません。在庫にないものは必ず「isFirstPurchase: true」とし、その日の合計金額に計上してください。'}
- 1週間で約3000円（1日あたり約${dailyBudgetGoal}円）という目標は、旬の野菜や特売になりやすい食材を活用すれば十分に達成可能です。プロの計算能力を見せてください。

【食材と単位（超重要）】
- 単位: 2kgなどの巨大な業務用単位は絶対に避け、「鶏むね肉 1パック(約300g)」「卵 1パック(10個)」など、一般的なスーパーマーケットで売られている現実的な単位で購入計画を立ててください。

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

