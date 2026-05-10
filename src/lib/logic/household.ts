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
あなたは世界最高峰の肉体改造スペシャリストであり、家計管理の鬼です。
「人生のあらゆるペインポイントを解決する」というKIRUMA COMPANYの理念に基づき、社長の肉体を最強にするための【戦略的夕食献立】を${days}日分作成してください。

【今回のメインテーマ：肉体覚醒】
1. **勃起力・男性機能の最大化**: 血管を拡張し血流を改善する成分（アルギニン、シトルリン）と、ホルモン生成を助ける成分（亜鉛、マグネシウム、ビタミンD/E）を豊富に含む食材（牡蠣、赤身肉、レバー、ナッツ、ニンニク、ブロッコリー、アボカド等）を主軸にしてください。
2. **筋肥大と体型の絞り**: 胸筋・腹筋の強化に必要な高タンパク（鶏むね肉、魚、卵、納豆等）を確保しつつ、体脂肪を絞るために低GI食品（玄米、オートミール等）や良質な脂質（オリーブオイル、魚油）を選択してください。

【現在の冷蔵庫の在庫（事実）】
${inventoryList}

【条件：在庫利用の厳格ルール】
1. **在庫リストにないものは「購入」一択**: 肉、野菜、卵、米などは、在庫リストになければ必ず買い物リストに載せ、\`isFirstPurchase: true\` としてください。
2. **基本調味料のみ例外**: 醤油、味噌、塩、砂糖、油、酢、酒、みりん、だし、マヨネーズ、ケチャップのみ、在庫になくても \`isFirstPurchase: false\`（0円）として扱ってOKです。
3. **捏造厳禁**: 予算が足りないからといって、在庫にない食材を勝手に「あること」にしてはいけません。

【買い物リストの現実性】
1. **具体的な単位指定**: 「人参1個」などの曖昧な表現を避け、「人参1袋（3本）」「鶏むね肉 600g（2枚）」といったスーパーでの販売単位（パック/g/袋）で記述してください。
2. **総予算**: ${tripBudget}円以内。この金額で全ての「新規購入アイテム」を賄ってください。

【献立構成】
毎日必ず「主菜・副菜・汁物」の3点セットを提示してください。
- 主菜：タンパク質と活力成分を最大化
- 副菜：ビタミン、ミネラルによる代謝サポート
- 汁物：発酵食品や野菜による内臓環境の整備

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

