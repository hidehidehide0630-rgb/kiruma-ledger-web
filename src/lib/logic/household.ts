import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const prisma = new PrismaClient();

// ID生成ユーティリティ
const generateId = () => Math.random().toString(36).substring(2, 11);

export const HouseholdLogic = {
  /**
   * 献立と買い物リストを生成（プロの購買マネージャーロジック）
   */
  async generateMenu(days: number, targetBudget: number, startDate: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const genAI = new GoogleGenerativeAI(apiKey);
    // モデルは最新の gemini-3-flash-preview を使用
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            procurementStrategy: { type: SchemaType.STRING },
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
                        name: { type: SchemaType.STRING },
                        purchaseUnit: { type: SchemaType.STRING },
                        usageAmount: { type: SchemaType.STRING },
                        unitPrice: { type: SchemaType.INTEGER },
                        isFirstPurchase: { type: SchemaType.BOOLEAN }
                      },
                      required: ["name", "purchaseUnit", "usageAmount", "unitPrice", "isFirstPurchase"]
                    }
                  }
                },
                required: ["menu", "instructions", "dailyEstimatedPrice", "ingredients"]
              }
            }
          },
          required: ["dailyPlans", "procurementStrategy"]
        }
      }
    });

    const dailyBudgetGoal = Math.floor(targetBudget / days);

    // 現在の在庫を取得
    const inventory = await prisma.inventory.findMany();
    const isInventoryEmpty = inventory.length === 0;
    const inventoryList = isInventoryEmpty 
      ? "なし（家には何もありません）"
      : inventory.map(i => `${i.name}: ${i.quantity}${i.unit}`).join(", ");

    const prompt = `
あなたはKIRUMA COMPANYの専属エグゼクティブ・シェフ兼、プロの購買マネージャーです。
${days}日間の「朝食・昼食」の献立と、スーパーでの「買い物リスト」を作成してください。夕食は計算外です。

### 【重要】プロの購買マネージャーとしての思考ルール（最優先）
1. **販売単位での購入（パック買い）の徹底**:
   - スーパーで「生卵1個」や「鶏肉50g」は買えません。
   - 必ず「卵1パック(10個)」「鶏むね肉1枚(約300g)」「カット野菜1袋」などの現実的な販売単位で購入計画を立ててください。
   - 買い物リストに「生卵1個」のような非現実的な単位が出現することは許されません。

2. **「使い切り・在庫転用」のロジック**:
   - 購入した食材（例：卵10個）は、その日に全部使う必要はありません。
   - 1日目に「新規購入(isFirstPurchase: true)」として全額（例：250円）を計上。
   - 2日目以降にその残りを使う場合は「在庫利用(isFirstPurchase: false)」とし、金額は0円で計上してください。
   - 買い物リストの集約：同じ日に同じ材料を複数回買うような重複（「卵1個」と「卵2個」が別々に並ぶ等）は、マネージャーとして失格です。1つの「1パック」にまとめてください。

3. **献立作成の思考プロセス**:
   - 手順1：まず「主菜」を決める。
   - 手順2：その主菜で発生した「余った食材」を特定する。
   - 手順3：余った食材を「翌日の主菜」または「当日の副菜・汁物」に回して使い切る。
   - 副菜と汁物は、食材を使い切るための「手段」であり、必須ではありません。材料がなければ「なし」で構いません。

4. **栄養とターゲット**:
   - 目的：勃起力向上（亜鉛・ビタミンE）、筋肉強化（高タンパク）、体形の絞り（低GI）。
   - 食材：鶏むね肉、オートミール、卵、ブロッコリー、ナッツ、魚介類などを活用。
   - 毎日同じメニュー（鶏むね肉とオートミールのみ等）はセンスがありません。バリエーションを持たせてください。

5. **予算目標**:
   - 1日平均${dailyBudgetGoal}円（週合計${targetBudget}円）を厳守してください。
   - 数百円程度のオーバーは許容しますが、可能な限り3,000円前後に収めるプロの計算を見せてください。

### 【入力データ】
- 現在の在庫リスト: ${inventoryList}
${isInventoryEmpty ? '※現在は在庫がゼロです。すべて新規購入から始めてください。' : '※在庫にあるものは優先的に使い、無駄な買い足しを避けてください。'}

### 【出力フォーマット】
以下のJSON構造で出力してください。

{
  "procurementStrategy": "どのように食材を数日間で使い回し、重複を避けたかの戦略説明",
  "dailyPlans": [
    {
      "menu": { "main": "主菜名", "side": "副菜名（なければ「なし」）", "soup": "汁物名（なければ「なし」）" },
      "instructions": { "main": "主菜の作り方", "side": "副菜の作り方", "soup": "汁物の作り方" },
      "dailyEstimatedPrice": その日の「新規購入(isFirstPurchase: true)」の合計金額,
      "ingredients": [
        {
          "name": "食材名（例：卵）",
          "purchaseUnit": "販売単位（例：1パック(10個)）",
          "usageAmount": "その日の使用量（例：2個）",
          "unitPrice": 販売単位の価格（例：250）",
          "isFirstPurchase": この食材をこの日に「新しく買う」ならtrue、以前買った在庫を使うならfalse
        }
      ]
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();
    
    // JSON部分のみを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AIから有効なJSONが返されませんでした。");
    responseText = jsonMatch[0];
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("LLM JSON Parse Error:", e);
      throw new Error("AIの応答を解析できませんでした。もう一度お試しください。");
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
   * 合計金額の計算
   */
  calculateTotalCost(menu: any[]) {
    return menu.reduce((sum, item) => sum + (item.recipe?.estimatedPrice || 0), 0);
  }
};
