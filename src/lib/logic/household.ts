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

    // マスター食材リストを取得
    const masters = await prisma.ingredientMaster.findMany();
    const currentMonth = startDate.getMonth() + 1;
    const mastersPrompt = masters.map(m => 
      `- ${m.name} (${m.category}, 旬:${m.seasonalMonths.join(',')}月): ${m.vitalityBenefit}, 基準価格:¥${m.basePrice}/${m.unit}, 活力食材:${m.isVitality}`
    ).join('\n');
    
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
            weeklyBatchMissions: {
              type: SchemaType.ARRAY,
              description: "週2回（1日目と5日目）にまとめて作る副菜のミッション。主菜の余り食材を活用せよ。不要なら空配列で良い。",
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  day: { type: SchemaType.INTEGER, description: "実施する日（1または5）" },
                  missionName: { type: SchemaType.STRING },
                  instructions: { type: SchemaType.STRING },
                  ingredients: { type: SchemaType.STRING }
                },
                required: ["day", "missionName", "instructions", "ingredients"]
              }
            },
            dailyPlans: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  menu: {
                    type: SchemaType.OBJECT,
                    properties: {
                      main: { type: SchemaType.STRING },
                      side: { type: SchemaType.STRING, description: "作り置き（weeklyBatchMissions）から提供すること。" },
                      soup: { type: SchemaType.STRING, description: "主菜の余り食材で即座に作れるもの。食材がない場合は『なし』で良い" }
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
                        purchaseUnit: { type: SchemaType.STRING, description: "スーパーの販売単位。マスターデータの名称を優先せよ。" },
                        usageAmount: { type: SchemaType.STRING, description: "その日の使用量。必ず単位(g, 個, 本など)を付けること" },
                        unitPrice: { type: SchemaType.INTEGER, description: "販売単位（パック）あたりの価格。マスターデータを参照せよ。" },
                        proRatedPrice: { type: SchemaType.INTEGER, description: "その日の使用量に相当する価格。1円単位で正確に計算せよ。" },
                        isFirstPurchase: { type: SchemaType.BOOLEAN, description: "今回の買い物リストに載せるべき『購入品（またはその使い回し）』ならtrue。DBの在庫リストにあるものを利用する場合のみfalse。" }
                      },
                      required: ["purchaseUnit", "usageAmount", "unitPrice", "proRatedPrice", "isFirstPurchase"]
                    }
                  }
                },
                required: ["menu", "instructions", "dailyEstimatedPrice", "ingredients"]
              }
            }
          },
          required: ["dailyPlans", "weeklyBatchMissions"]
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
# Role
あなたは「午後の爆発的な活力（剛起）」と「筋力強化（バキバキ）」を専門とする、超攻撃的なスポーツ管理栄養士です。

# Goal
ユーザーが「バキバキの肉体」と「最強の血流（勃起力）」を手に入れるための、戦略的・自律的な昼飯メニュー（7日間）を生成してください。

# 季節性活力戦略（Seasonal Vitality）
1. **[旬の優先]**: 以下の【マスター食材リスト】から、現在の月（${currentMonth}月）が旬に含まれる食材を最優先で採用せよ。旬の食材は安価で栄養価が最大化されている。
2. **[活力食材の義務化]**: 'isVitality: true' の食材を主菜に必ず組み込むこと。

# 週次バランス（Weekly Logistics）
1. **[肉魚比率 4:3]**: 週7日のうち、主菜は「肉4日：魚3日」の黄金比率を厳守せよ。
2. **[作り置きミッション (Batch Cooking)]**: 
   - 副菜は毎日作らず、Day 1（月〜木分）とDay 5（金〜日分）の2回に分けて「まとめて作る（Batch Mission）」ロジックで構成せよ。
   - 副菜の食材は、主菜で買った食材の「余り（端数）」のみで完結させること。副菜のために新規食材を買うことは原則禁止（調味料は除く）。

# 調理・購買ロジック（社長命令）
1. **[成人男性1人前]**: すべてのレシピは成人男性1人が満足できる分量で構成せよ。
2. **[按分価格の計算]**: 'dailyEstimatedPrice' は、その日に「食べた分だけ」のコストを算出せよ。
   例：¥300の肉300gトレイを買い、今日150g使うなら proRatedPrice: 150 とし、dailyEstimatedPriceに加算する。
3. **[在庫の捏造厳禁・isFirstPurchaseの厳守]**: 
   - 'isFirstPurchase: false' (在庫利用) を指定できるのは、以下の【現在の在庫状況】にリストされている食材のみです。
   - 今回の献立プランの中で1日目に買ったものを2日目に使う場合、それは「在庫」ではなく「今回の購入品」の使い回しです。
   - 今回のプランで新しく買う食材（およびその使い回し）は、登場する【全日程】において必ず 'isFirstPurchase: true' としてください。
4. **[炭水化物のコスト計算除外]**: お米（もち麦入り）などの主食（炭水化物）は、レシピには含めるが、'unitPrice' および 'proRatedPrice' は必ず 0 として計算せよ。

# 調理手順の記述ルール（Recipe Standard）
1. **[構造化]**: \`instructions.main\` の冒頭2行には、必ず「剛起・バキバキの根拠（栄養学的メリット）」を記述せよ。
2. **[番号付き手順]**: 手順は「1.」「2.」のように番号を振り、一般的なレシピアプリのように工程が明確に分かるようにせよ。
3. **[調味料の明記]**: 使用する調味料の具体名と投入タイミングを必ず含めること。

【マスター食材リスト（${currentMonth}月基準）】
${mastersPrompt}

【現在の在庫状況（既存のストック）】
${inventoryList}
`;

    const userPrompt = `${startDate.toLocaleDateString('ja-JP')}から${days}日間分の献立と調達計画を作成してください。
予算は合計¥${tripBudget}円です。
主菜の肉魚比率を4:3にし、旬の食材を活用し、週2回の作り置きミッションで副菜を効率化してください。`;

    let retryCount = 0;
    const maxRetries = 2;
    let lastError = null;

    while (retryCount <= maxRetries) {
      try {
        const result = await model.generateContent([systemPrompt, userPrompt]);
        const responseText = result.response.text();
        
        // JSON抽出の堅牢化
        const startIdx = responseText.indexOf('{');
        const endIdx = responseText.lastIndexOf('}');
        
        if (startIdx === -1 || endIdx === -1) {
          throw new Error("AIの応答にJSONが含まれていませんでした。");
        }
        
        const cleanJson = responseText.substring(startIdx, endIdx + 1);
        const parsedData = JSON.parse(cleanJson);

        if (!parsedData.dailyPlans || !Array.isArray(parsedData.dailyPlans)) {
          throw new Error("JSONの構造が不正です（dailyPlansが見つかりません）。");
        }

        // 型安全性を考慮してデータを整理（UI側の期待に合わせて変換）
        return {
          dailyPlans: parsedData.dailyPlans.map((plan: any, index: number) => {
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
          }),
          weeklyBatchMissions: parsedData.weeklyBatchMissions
        };
      } catch (e: any) {
        lastError = e;
        console.error(`AI生成リトライ (${retryCount + 1}/${maxRetries + 1}):`, e.message);
        retryCount++;
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    throw lastError || new Error("AI献立生成に失敗しました。");
  },

  /**
   * 買い物リストの合計金額を計算
   */
  calculateTotalCost(menu: any[]) {
    return menu.reduce((sum, item) => sum + (item.recipe?.estimatedPrice || 0), 0);
  }
};
