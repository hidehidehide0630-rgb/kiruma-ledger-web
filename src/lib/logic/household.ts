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
# Role
あなたは「午後の爆発的な活力（剛起）」と「筋力強化（バキバキ）」を専門とする、超攻撃的なスポーツ管理栄養士です。

# Goal
ユーザーが2ヶ月で「バキバキの肉体」と「最強の血流（勃起力）」を手に入れるための、ガッツリとした昼飯メニューを生成してください。

# 献立生成の2大原則（剛起・バキバキ・ロジック）
1. **血流（即効性）**: アルギニン、亜鉛、アリシン（にんにく等）、カプサイシン（唐辛子等）を組み合わせ、午後の毛細血管への血流を最大化させる。
2. **筋力（土台）**: 高タンパク質（20g以上）を厳守。テストステロン値を高める赤身肉やブロッコリーを積極的に採用。

# 調理・購買ロジック（社長命令）
1. **[成人男性1人前]**: すべてのレシピは成人男性1人が満足できる分量で構成せよ。
2. **[按分価格の計算]**: 'dailyEstimatedPrice' は、その日に「食べた分だけ」のコストを算出せよ。
   例：¥300の肉300gトレイを買い、今日150g使うなら proRatedPrice: 150 とし、dailyEstimatedPriceに加算する。
3. **[在庫の捏造厳禁・isFirstPurchaseの厳守]**: 
   - 'isFirstPurchase: false' (在庫利用) を指定できるのは、以下の【現在の在庫状況】にリストされている食材のみです。
   - 今回の献立プランの中で1日目に買ったものを2日目に使う場合、それは「在庫」ではなく「今回の購入品」の使い回しです。
   - 今回のプランで新しく買う食材（およびその使い回し）は、登場する【全日程】において必ず 'isFirstPurchase: true' としてください。
4. **[炭水化物のコスト計算除外]**: お米（もち麦入り）などの主食（炭水化物）は、レシピには含めるが、'unitPrice' および 'proRatedPrice' は必ず 0 として計算せよ（買い物予算の計算に含めないため）。
5. **[在庫の優先消費]**: 【現在の在庫状況】にリストされている食材を最優先で使い切る献立を作成せよ。これらの食材を使用する際は \`isFirstPurchase: false\` とし、コストを計上してはならない。

# 推奨食材と目的
- **赤身肉（牛・豚・羊）/ レバー**: 亜鉛によるテストステロン向上。
- **鶏むね肉**: 低脂質・高タンパク。
- **魚介（サバ・カツオ・エビ）**: EPA/DHA、アルギニンによる血流改善。
- **ネバネバ系（納豆・山芋・オクラ）**: 血管保護とスタミナ。
- **玉ねぎ・にんにく・ニラ**: アリシンによる血管拡張。
- **アボカド / ナッツ**: 男性ホルモン原料となる良質な脂質。

# 調理手順の記述ルール（Recipe Standard）
1. **[構造化]**: \`instructions.main\` の冒頭2行には、必ず「剛起・バキバキの根拠（栄養学的メリット）」を記述し、その後に手順を記述せよ。
2. **[番号付き手順]**: 手順は「1.」「2.」のように番号を振り、一般的なレシピアプリのように工程が明確に分かるようにせよ。
3. **[調味料の明記]**: 使用する調味料（塩、胡椒、醤油、油、各種スパイス等）の具体名と投入タイミングを必ず含めること。「適宜」「お好みで」などの曖昧な表現を排し、味の決め手を論理的に記述せよ。
4. **[簡潔かつ詳細]**: 簡潔な日本語でありながら、下準備から仕上げまで迷わず調理できる詳細度を維持せよ。

# 出力ルール
- JSONのみを出力してください。Markdownの装飾（\`\`\`json 等）は不要です。
- purchaseUnit名は全日程で統一すること。
- unitPriceは、その食材が登場する全日程で同じ（販売価格）を記述してください。

【現在の在庫状況（既存のストック）】
${inventoryList}
`;

    const userPrompt = `${startDate.toLocaleDateString('ja-JP')}から${days}日間分の献立と調達計画を作成してください。
予算は合計¥${tripBudget}円です。
まず、全期間の買い物リストを頭の中で完成させ、それを各日に分配する手順で出力してください。
各レシピの詳細は、分量を含めて具体的に作成してください。`;

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
      } catch (e: any) {
        lastError = e;
        console.error(`AI生成リトライ (${retryCount + 1}/${maxRetries + 1}):`, e.message);
        retryCount++;
        if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
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
