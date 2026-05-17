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
    includeFavorites?: boolean;
  }) {
    const { startDate, days, tripBudget, vitalityMode, includeFavorites } = params;

    // マスター食材リストを取得
    const masters = await prisma.ingredientMaster.findMany();
    const currentMonth = startDate.getMonth() + 1;
    const mastersPrompt = masters.map(m => 
      `- ${m.name} (${m.category}, 旬:${m.seasonalMonths.join(',')}月): ${m.vitalityBenefit}, 基準価格:¥${m.basePrice}/${m.unit}, 活力食材:${m.isVitality}`
    ).join('\n');

    // お気に入りレシピを取得
    let favoritesPrompt = "なし";
    if (includeFavorites) {
      const favorites = await prisma.recipe.findMany({
        where: { isFavorite: true },
        take: 10 // あまり多すぎるとコンテキストを圧迫するので制限
      });
      if (favorites.length > 0) {
        favoritesPrompt = favorites.map(f => {
          try {
            const nameObj = JSON.parse(f.name);
            return `- ${nameObj.main} (副菜: ${nameObj.side}, スープ: ${nameObj.soup})`;
          } catch (e) {
            return `- ${f.name}`;
          }
        }).join('\n');
      }
    }
    
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
        // Vercel 60秒上限内に収めるため思考レベルを抑制（デフォルトhighは応答に~50秒かかる）
        // legacy SDK v0.24.1 に型未定義のためキャストで通過させる（REST API側は受理する）
        ...({ thinkingConfig: { thinkingLevel: "low" } } as any),
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            weeklyBatchMissions: {
              type: SchemaType.ARRAY,
              description: "週2回（1日目と5日目）にまとめて作る副菜のミッション。主菜の余り食材を活用し、必ず2つ以上のレシピを生成せよ。空配列は厳禁である。",
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  day: { type: SchemaType.INTEGER, description: "実施する日（1または5）" },
                  missionName: { type: SchemaType.STRING, description: "ミッション名（例: 活力サイドメニュー一括調理）" },
                  instructions: { 
                    type: SchemaType.STRING, 
                    description: "副菜の具体的な調理手順。2つ以上のレシピを生成する場合は、それぞれにタイトル（例:【きんぴら】）を付け、全ての料理について必ず『1. 2. 』と番号を振り、詳細な分量と垂直フローを維持せよ。食材の配分（g単位）を明記すること。" 
                  },
                  ingredients: { 
                    type: SchemaType.STRING, 
                    description: "必要な食材リスト。必ず改行で区切ること。" 
                  }
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
                      side: { type: SchemaType.STRING, description: "提供する全ての副菜名を記載せよ。例:『ほうれん草お浸し ＆ きんぴら』" },
                      soup: { type: SchemaType.STRING, description: "提供する全てのスープ名を記載せよ。食材がない場合は『なし』で良い" }
                    },
                    required: ["main", "side", "soup"]
                  },
                  instructions: {
                    type: SchemaType.OBJECT,
                    properties: {
                      main: { 
                        type: SchemaType.STRING, 
                        description: "主菜のレシピ。必ず『1. ○○を××g切る』のように手順番号を振り、分量（g, 個, 本）を詳細に含めること。視覚的に縦のフローチャートとして理解できる構造にせよ。" 
                      },
                      side: {
                        type: SchemaType.STRING,
                        description: "副菜のレシピ。主菜（instructions.main）と完全に同一のフォーマットで記述せよ。冒頭2行以内に活力への貢献を記述した後、必ず『1. 〇〇（分量g）を〜する』『2. 〇〇を〜する』と手順番号を振り、分量（g, 個, 本）を全手順に詳細に含めること。段落文・箇条書きは絶対禁止。"
                      },
                      soup: {
                        type: SchemaType.STRING,
                        description: "スープのレシピ。主菜（instructions.main）と完全に同一のフォーマットで記述せよ。冒頭2行以内に活力への貢献を記述した後、必ず『1. 〇〇（分量g）を〜する』『2. 〇〇を〜する』と手順番号を振り、分量（g, 個, 本）を全手順に詳細に含め、垂直フローで記述せよ。段落文は絶対禁止。"
                      }
                    },
                    required: ["main", "side", "soup"]
                  },
                  dailyEstimatedPrice: { type: SchemaType.INTEGER, description: "その日に食べた分だけのコスト（按分価格の合計）" },
                  ingredients: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        purchaseUnit: { type: SchemaType.STRING, description: "スーパーの販売単位。マスターデータの名称を優先せよ。例: 豚バラ肉(300gパック)" },
                        usageAmount: { type: SchemaType.STRING, description: "その日の使用量。必ず単位(g, 個, 本など)を具体的に付けること。例: 150g" },
                        unitPrice: { type: SchemaType.INTEGER, description: "販売単位（パック）あたりの価格。マスターデータを参照せよ。" },
                        proRatedPrice: { type: SchemaType.INTEGER, description: "その日の使用量に相当する価格。1円単位 for 正確に計算せよ。" },
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
ユーザーが「バキバキの肉体」と「最強の血流（勃起力）」を手に入れるための、戦略的・自律的な昼飯メニューを、**必ず指定された日数（${days}日間）ちょうど**生成してください。
1日でも多く、あるいは少なく生成することは許されません。${days}日間分のデータのみを dailyPlans に含めてください。

# レシピ出力品質規格（社長絶対命令）
1. **[手順の番号付け・厳守]**: instructions.main, instructions.side, instructions.soup および weeklyBatchMissions.instructions は、例外なく全手順を「1. 〇〇する」「2. 〇〇する」の形式で番号付きで記述せよ。段落文・箇条書き（「・」「-」）・連続文での記述は絶対禁止。副菜・スープも主菜と全く同じフォーマットで書け。
2. **[詳細な分量表示]**: 調理手順の中で、「鶏肉200gを〜」「醤油大さじ1を〜」のように、**具体的な分量をすべて明記せよ**。材料リストに書いてあるからと省略することは厳禁である。
3. **[垂直フロー構造]**: 手順は一行一工程とし、視覚的に縦に流れるフローチャートのような構成にせよ。
4. **[活力の言語化]**: 手順の冒頭2行以内で、そのレシピがどのように「活力（剛起）」に寄与するかを熱く記述せよ。この冒頭説明も必ず番号なしで独立した行として記述し、その後に「1. 」から手順を開始せよ。
5. **[副菜・スープの完全網羅]**: 献立（menu.side, menu.soup）に記載した料理は、必ずそのすべてについて手順（instructions.side, instructions.soup）を記述せよ。一部を省略することは許されない。
6. **[食材の配分明記]**: 購入した食材（パック等）を複数の料理に分ける場合、それぞれのレシピ内で「○○を××g使用」と明記し、合計が購入量と一致するように計算せよ。

## 出力フォーマット厳守サンプル（これ以外の形式は不合格）
instructions.side の正しい例:
副菜は血管拡張効果のあるナムルとサラダで剛起を強化する。
1. 春キャベツ1/4玉（75g）を千切りにする
2. 鍋に湯を沸かし、キャベツを30秒湯がいて水気を絞る
3. ごま油小さじ1、塩ひとつまみ、白ごま少々で和える

instructions.soup の正しい例:
スープは玉ねぎの硫化アリルで血流を爆上げする。
1. 玉ねぎ1個（200g）を薄切りにする
2. 鍋にだし汁400mlを沸かし玉ねぎを入れ中火で5分煮る
3. 味噌大さじ2を溶き入れ、火を止める

# 季節性活力戦略（Seasonal Vitality）
1. **[旬の優先]**: 以下の【マスター食材リスト】から、現在の月（${currentMonth}月）が旬に含まれる食材を最優先で採用せよ。
2. **[活力食材の義務化]**: 'isVitality: true' の食材を主菜に必ず組み込むこと。

【マスター食材リスト】:
${mastersPrompt}

# お気に入りレシピの優先（User Favorites）
以下の【お気に入りレシピ】に含まれるメニューがある場合、ユーザーの好みに合致しているため、積極的に再採用（または類似の構成を採用）せよ。
【お気に入りレシピ】:
${favoritesPrompt}

# 週次バランス（Weekly Logistics）
1. **[肉魚比率の動的調整]**: 
   - 7日間の場合は「肉4日：魚3日」を厳守せよ。
   - 7日未満の場合は、その比率に近いバランス（例：4日の場合は肉2:魚2）で構成せよ。
2. **[作り置きミッション (Batch Cooking)]**:
   - 副菜は毎日作らず、「まとめて作る（Batch Mission）」ロジックで構成せよ。
   - 副菜の食材は主菜の「余り（端数）」を**優先**して使うこと。ただし副菜にのみ必要な食材（例：ニラ、薬味、葉物野菜など）は、必ず dailyPlans[].ingredients に追加し isFirstPurchase: true で買い物リストに反映させること。「余りのみで完結」を理由に副菜固有の食材を ingredients から欠落させることは厳禁。
   - **[最重要・買い物リスト整合性]** weeklyBatchMissions の ingredients に列挙する全ての食材は、必ずそのミッションの day（1 または 5）に対応する dailyPlans[].ingredients にも構造化形式（purchaseUnit, usageAmount, unitPrice, proRatedPrice, isFirstPurchase）で重複して追加せよ。weeklyBatchMissions.ingredients は調理レシピ表示用、dailyPlans[].ingredients は買い物リスト集計用と機能を分けるため、両方への記載が必須である。在庫にあるものは isFirstPurchase: false、購入が必要なものは true として正確に分類すること。

# 調理・購買ロジック
1. **[成人男性1人前]**: すべてのレシピは成人男性1人が満足できる分量で構成せよ。
2. **[在庫の捏造厳禁]**: 【現在の在庫状況】にない食材を 'isFirstPurchase: false' にすることは絶対に許されない。逆に在庫にある食材は必ず isFirstPurchase: false にして買い物リストから除外せよ。
3. **[炭水化物のコスト計算除外]**: お米（もち麦入り）などの主食は、レシピには含めるがコストは 0 とせよ。
4. **[予算厳守・最重要]**: dailyPlans[].ingredients 内の isFirstPurchase: true の食材の unitPrice 合計は、必ず指定予算（${tripBudget}円）以内に収めよ。+500円までの超過は許容するが、それ以上の超過は不合格である。予算超過が見込まれる場合は、活力食材を維持したまま副菜の品数や肉魚の購入量を調整して予算内に収めよ。

【現在の在庫状況】:
${inventoryList}
`;

    const userPrompt = `
${startDate.toLocaleDateString('ja-JP')}から${days}日間分の献立と調達計画を作成してください。
これは週の途中からの計画、あるいは短期的な計画です。
**予算は合計¥${tripBudget}円（最大許容¥${tripBudget + 500}円）です。これを超えないこと。**
肉魚のバランスを考慮し、旬の食材を活用し、作り置きミッションで副菜を効率化してください。
最後に、買い物リスト合計が予算内に収まっているか必ず自己検証してから出力せよ。`;

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

        // 安全網: AIがweeklyBatchMissionsの食材を対応する日のdailyPlans[].ingredientsに
        // 重複記載し忘れた場合に備え、機械的にマージする（プロンプトでは指示済みだが順守率100%でないため）。
        // これがないと買い物リストにbatch食材（ニラ・ほうれん草等）が出現しないバグが発生する。
        const parseBatchLine = (line: string): { name: string; qty: string } | null => {
          const t = line.trim().replace(/^[・\-*•]\s*/, '');
          if (!t) return null;
          const m = t.match(/^(.+?)\s+([\d./]+\s*\S*)$/);
          if (m) return { name: m[1].trim(), qty: m[2].trim() };
          return { name: t, qty: '適量' };
        };
        const findMaster = (name: string) => {
          return masters.find(m => m.name === name)
              || masters.find(m => m.name.includes(name) || name.includes(m.name));
        };
        const stripParen = (s: string) => (s || '').replace(/\s*[(（][^)）]*[)）]\s*/g, '').trim();
        const inventoryNames = new Set(inventory.map(i => i.name));

        for (const mission of (parsedData.weeklyBatchMissions || [])) {
          const dayIdx = (mission.day || 1) - 1;
          if (dayIdx < 0 || dayIdx >= parsedData.dailyPlans.length) continue;
          const plan = parsedData.dailyPlans[dayIdx];
          if (!Array.isArray(plan.ingredients)) plan.ingredients = [];

          const existingBaseNames = new Set(
            plan.ingredients.map((i: any) => stripParen(i.purchaseUnit || ''))
          );

          const lines = (mission.ingredients || '').split('\n');
          for (const line of lines) {
            const parsed = parseBatchLine(line);
            if (!parsed) continue;
            if (existingBaseNames.has(parsed.name)) continue;
            const master = findMaster(parsed.name);
            const inInventory = inventoryNames.has(parsed.name)
                             || (master ? inventoryNames.has(master.name) : false);
            plan.ingredients.push({
              purchaseUnit: master ? `${master.name}(${master.unit})` : parsed.name,
              usageAmount: parsed.qty,
              unitPrice: master?.basePrice || 0,
              proRatedPrice: 0,
              isFirstPurchase: !inInventory
            });
            existingBaseNames.add(parsed.name);
          }
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
