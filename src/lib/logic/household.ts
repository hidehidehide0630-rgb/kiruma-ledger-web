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
あなたはプロの「購買マネージャー」兼「パーソナルシェフ」です。
社長の健康と資産を最大化するため、無駄のない調達・消費計画を立ててください。

【基本方針：購買マネージャーの思考手順】
1. **[フェーズ1：調達計画]**
   - まず、${days}日間全体で必要な食材を「スーパーの販売単位（パック/袋/トレイ）」でリストアップします。
   - 「生卵1個」のようなバラ売りは現実のスーパーに存在しません。必ず「卵10個入パック」のように、レジを通す単位で考えてください。
   - ${days}日間の総予算（¥${tripBudget}）を絶対に守ってください。

2. **[フェーズ2：主菜の決定]**
   - 高タンパク・低糖質な主菜を${days}日分決め、フェーズ1の食材を割り当てます。

3. **[フェーズ3：余剰食材の活用（副菜・汁物）]**
   - 主菜で使い切れなかった食材（例：玉ねぎ1/2個、卵の残り、キャベツの残り）を特定します。
   - 副菜と汁物は、**その「余り食材」のみを使用して構成してください。**
   - 副菜や汁物のために新しく食材を買うのは、「予算に大幅な余裕がある場合」かつ「主菜との栄養バランスに不可欠な場合」のみです。余りがないなら副菜・汁物は「なし」でも構いません。

4. **[フェーズ4：JSON出力]**
   - 1つの食材（purchaseUnit）につき、'isFirstPurchase: true' になるのは全期間で「1回だけ」です。
   - 翌日以降に同じ食材を使う場合は、必ず 'isFirstPurchase: false' とし、金額が重複して計上されないようにしてください。
   - purchaseUnitの名前は、全日程で一字一句違わずに統一してください（集計のため）。

【NG例（これを出したら失格）】
- 1日目：卵10個入パック(isFirstPurchase: true)
- 2日目：卵10個入パック(isFirstPurchase: true) ← 重複購入は無能です。2日目は false にしなさい。
- 買い物リストに「生卵1個」「玉ねぎ1/2個」「鶏むね肉 120g」といったバラ売り単位が出現すること。これらは「パック」や「g数指定のトレイ」で購入し、使用量として管理しなさい。

【社長の要望】
- メインターゲット: 勃起力向上、筋力強化、低糖質、高タンパク。
- 朝食・昼食のみ。夕食は無視。
- 毎日同じ「鶏むね肉とオートミール」のような単調なレシピは避け、センスのある提案をすること。

【現在の在庫状況（既存のストック）】
${inventoryList}
`;

    const userPrompt = `${startDate.toLocaleDateString('ja-JP')}から${days}日間分の献立と調達計画を作成してください。
予算は合計¥${tripBudget}円（1日あたり約¥${Math.floor(tripBudget / days)}円）です。
まず、全期間の買い物リストを頭の中で完成させ、それを各日に分配する手順で出力してください。`;

    const result = await model.generateContent([systemPrompt, userPrompt]);
    let responseText = result.response.text();
    
    responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsedData = JSON.parse(responseText);

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
  },

  /**
   * 買い物リストの合計金額を計算
   */
  calculateTotalCost(menu: any[]) {
    return menu.reduce((sum, item) => sum + (item.recipe?.estimatedPrice || 0), 0);
  }
};
