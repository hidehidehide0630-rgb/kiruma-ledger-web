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
                  dailyEstimatedPrice: { type: SchemaType.INTEGER, description: "その日に食べた分だけのコスト（按分価格の合計）" },
                  ingredients: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        purchaseUnit: { type: SchemaType.STRING, description: "スーパーの販売単位（例：卵10個入パック、玉ねぎ1袋(3個入)、豚バラ300gトレイ）。" },
                        usageAmount: { type: SchemaType.STRING, description: "その日の使用量。必ず単位(g, 個, 本など)を付けること（例：2個、1/2個、150g）" },
                        unitPrice: { type: SchemaType.INTEGER, description: "販売単位（パック）あたりの価格。" },
                        proRatedPrice: { type: SchemaType.INTEGER, description: "その日の使用量に相当する価格（例：¥300の肉300gのうち150g使うなら150）。1円単位で計算せよ。" },
                        isFirstPurchase: { type: SchemaType.BOOLEAN, description: "このパックを『今日レジで買う』場合はtrue。既に買った物の残りを使い回す場合はfalse。" }
                      },
                      required: ["purchaseUnit", "usageAmount", "unitPrice", "proRatedPrice", "isFirstPurchase"]
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
あなたはプロの「家庭用購買マネージャー」兼「パーソナルシェフ」です。
社長（成人男性1人）の健康と資産を最大化するため、無駄のない調達・消費計画を立ててください。

【基本方針】
1. **[成人男性1人前]**: 
   - すべてのレシピは成人男性1人が満足できる分量（例：肉150-200g程度、野菜たっぷり）で構成してください。
   
2. **[分量の適正化]**:
   - 肉類は「200g〜500g程度のトレイ」が一般的です。業務用サイズは一人暮らしには過剰であり、絶対に禁止します。
   - 卵は「10個入パック」、野菜は「1個」または「1袋(2〜3個)」といった、通常のスーパーの単位を厳守してください。

3. **[按分価格の計算]**:
   - 'dailyEstimatedPrice' は、その日に**「食べた分だけ」**のコストを算出してください。
   - 例：¥300の「鶏むね肉300gトレイ」を買い、今日150g使う場合：
     - unitPrice: 300
     - proRatedPrice: 150
     - dailyEstimatedPriceの加算分: 150
   - これにより、1週間の 'dailyEstimatedPrice' の合計が、買い物総額と概ね一致するようにしてください。

4. **[在庫の捏造厳禁]**:
   - 'isFirstPurchase: false' (在庫利用) を指定できるのは、以下の【現在の在庫状況】にリストされている食材のみです。
   - 今回の献立プランの中で1日目に買ったものを2日目に使う場合、それは「在庫」ではなく「今回の購入品」です。

【出力ルール】
- purchaseUnit名は全日程で統一すること。
- 今回のプランで新しく買う食材は、その食材が登場する**最初の日だけ** 'isFirstPurchase: true' としてください。2日目以降にその残りを使う場合は 'isFirstPurchase: false' です。
- unitPriceは、その食材が登場する全日程で同じ（販売価格）を記述してください。

【現在の在庫状況（既存のストック）】
${inventoryList}
`;

    const userPrompt = `${startDate.toLocaleDateString('ja-JP')}から${days}日間分の献立と調達計画を作成してください。
予算は合計¥${tripBudget}円です。
まず、全期間の買い物リストを頭の中で完成させ、それを各日に分配する手順で出力してください。
各レシピの詳細は、分量を含めて具体的に作成してください。`;

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
