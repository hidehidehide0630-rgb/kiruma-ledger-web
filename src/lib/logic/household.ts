import { prisma } from '../prisma';
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
                      side: { type: SchemaType.STRING, description: "主菜の余り食材で構成すること。食材がない場合は『なし』で良い" },
                      soup: { type: SchemaType.STRING, description: "主菜の余り食材で構成すること。食材がない場合は『なし』で良い" }
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
                  dailyEstimatedPrice: { type: SchemaType.INTEGER, description: "その日にレジで支払う合計金額（isFirstPurchaseがtrueの食材のunitPriceの合計）" },
                  ingredients: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        purchaseUnit: { type: SchemaType.STRING, description: "スーパーの販売単位（例：卵10個入パック、玉ねぎ1袋(3個入)、豚バラ300gトレイ）。全日程で名前を統一すること。" },
                        usageAmount: { type: SchemaType.STRING, description: "その日の使用量（例：2個、1/2個、150g）" },
                        unitPrice: { type: SchemaType.INTEGER, description: "販売単位あたりの価格。" },
                        isFirstPurchase: { type: SchemaType.BOOLEAN, description: "このパックを『今日レジで買う』場合はtrue。既に買った物の残りを使い回す場合はfalse。" }
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
      : inventory.map(i => `${i.name}: ${i.quantity}`).join(', ');

    const systemPrompt = `
あなたはプロの「家庭用購買マネージャー」です。
社長の健康と資産を最大化するため、無駄のない調達・消費計画を立ててください。

【基本方針：一般家庭の常識を守る】
1. **[分量の適正化]**:
   - 肉類は「200g〜500g程度のトレイ」が一般的です。**「鶏むね肉2kg」といった業務用サイズは、一人暮らしの朝昼食には過剰であり、絶対に禁止します。**
   - 卵は「10個入パック」、野菜は「1個」または「1袋(2〜3個)」といった、通常のスーパーの単位を厳守してください。

2. **[在庫の捏造厳禁]**:
   - **'isFirstPurchase: false' (在庫利用) を指定できるのは、以下の【現在の在庫状況】にリストされている食材のみです。**
   - 今回の献立プランの中で1日目に買ったものを2日目に使う場合、それは「在庫」ではなく「今回の購入品」です。
   - **DB上の在庫にないものを「在庫利用」として出力することは、事実の捏造であり、絶対に許されません。**

3. **[調達と分配]**:
   - ${days}日間で使う食材を、まず新規購入リスト（今回の買い物）として確定させます。
   - 予算（合計¥${tripBudget}）は「今回の新規購入」の合計額で計算してください。
   - 副菜・汁物は、主菜の余り食材（例：玉ねぎの残り、卵の残り）から構成し、新規に食材を増やすのは最小限にしてください。

【出力ルール】
- purchaseUnit名は全日程で統一すること。
- **今回のプランで新しく買う食材は、その食材が登場する全日程において 'isFirstPurchase: true' とし、unitPriceを同一にしてください。**（フロントエンド側で重複を排除して集計します。AI側で勝手に在庫扱いしてはいけません。）
- 既存在庫（冷蔵庫にあるもの）を使う時だけ 'isFirstPurchase: false' にし、unitPriceは0にしてください。

【現在の在庫状況（既存のストック）】
${inventoryList}
`;

    const userPrompt = `${startDate.toLocaleDateString('ja-JP')}から${days}日間分の献立と調達計画を作成してください。
予算は合計¥${tripBudget}円（1日あたり約¥${Math.floor(tripBudget / days)}円）です。
まず、全期間の買い物リストを頭の中で完成させ、それを各日に分配する手順で出力してください。`;

    const result = await model.generateContent([systemPrompt, userPrompt]);
    let responseText = result.response.text();
    
    try {
      // JSON部分のみを抽出（```json ... ``` や前後の雑多なテキストを排除）
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const cleanJson = jsonMatch[0];
      const parsedData = JSON.parse(cleanJson);

      return parsedData.dailyPlans.map((plan: any, index: number) => {
        const planDate = new Date(startDate);
        planDate.setDate(startDate.getDate() + index);
        return {
          date: planDate,
          recipe: {
            id: "gen_" + generateId(),
            name: JSON.stringify(plan.menu),
            estimatedPrice: plan.dailyEstimatedPrice,
            ingredients: JSON.stringify(plan.ingredients),
            instructions: JSON.stringify(plan.instructions)
          }
        };
      });
    } catch (e) {
      console.error("AI Response Parse Error:", e);
      console.error("Raw Response Text:", responseText);
      throw e;
    }
  },

  /**
   * 買い物リストの合計金額を計算
   */
  calculateTotalCost(menu: any[]) {
    return menu.reduce((sum, item) => sum + (item.recipe?.estimatedPrice || 0), 0);
  }
};
