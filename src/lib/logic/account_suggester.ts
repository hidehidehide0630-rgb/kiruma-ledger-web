import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 標準的な仕訳辞書データ
export const KEYWORD_MAP: Record<string, string> = {
  'セブンイレブン': '消耗品費',
  'ローソン': '消耗品費',
  'ダイソー': '消耗品費',
  'スターバックス': '会議費',
  'ドトール': '会議費',
  '会議': '会議費',
  'タクシー': '旅費交通費',
  'JR': '旅費交通費',
  '東京メトロ': '旅費交通費',
  'ガソリン': '旅費交通費',
  'NTT': '通信費',
  'ソフトバンク': '通信費',
  'ドコモ': '通信費',
  '東京電力': '水道光熱費',
  '東京ガス': '水道光熱費',
};

// 勘定科目の説明文（ヘルプチップ用）
export const ACCOUNT_DESCRIPTIONS: Record<string, string> = {
  '現金': '手元にある現金（紙幣・硬貨）。',
  '普通預金': '銀行などの普通預金口座の残高。',
  '売掛金': '商品の販売やサービスの提供が完了し、代金が未回収のもの。',
  '事業主貸': '事業用の資金を生活費などプライベートへ支出した場合。',
  '買掛金': '商品の仕入などで代金が未払いのもの。',
  '未払金': '備品購入など本来の営業取引以外の代金が未払いのもの。',
  '事業主借': 'プライベートの資金を事業用に投入した場合。',
  '売上高': '商品の販売やサービスの提供による主要な収益。',
  '仕入高': '販売目的で商品を買い入れた費用。',
  '租税公課': '印紙代、固定資産税、自動車税、商工会議所の会費など。',
  '荷造運賃費': '商品の発送にかかる梱包材料費や送料。',
  '水道光熱費': '電気、ガス、水道料金。',
  '旅費交通費': '電車、バス、タクシー代、宿泊費、ガソリン代、駐車場代。',
  '通信費': '電話代、インターネット代、切手、はがき、サーバー代。',
  '広告宣伝費': 'チラシ作成、Web広告、名刺作成費用。',
  '接待交際費': '得意先への接待、贈答品、慶弔費。',
  '損害保険料': '火災保険、自動車保険（事業用）などの保険料。',
  '修繕費': '店舗や車両の修理代、備品のメンテナンス費。',
  '消耗品費': '10万円未満の事務用品、工具、備品、日用品の購入。',
  '減価償却費': '10万円以上の資産を経年的に費用化するもの。',
  '福利厚生費': '従業員の慰安、健康診断、慶弔見舞金など。',
  '地代家賃': '店舗、事務所、駐車場の賃借料。',
  '支払手数料': '銀行振込手数料、仲介手数料、税理士報酬、ドメイン更新料。',
  '雑費': '他のどの科目にも当てはまらない、少額かつ重要性の低い費用。',
  '新聞図書費': '新聞、書籍、専門誌の講読料。',
};

// AI提案用の型
export interface AiSuggestion {
  accountName: string;
  reason: string;
  isPrivate?: boolean; // 新規：タバコ、酒、私用品などの判別フラグ
}

/**
 * 摘要から勘定科目を推論する（1: 履歴, 2: キーワード, 3: デフォルト）
 */
export async function suggestAccountFromHistoryOrKeyword(description: string): Promise<{ accountId: number; accountName: string } | null> {
  if (!description) return null;

  // 1. 過去仕訳の学習（履歴優先マッチ）
  const lastEntry = await prisma.journalEntry.findFirst({
    where: {
      transaction: {
        description: { contains: description }, // 部分一致
        isDeleted: false,
      },
    },
    include: {
      account: true,
    },
    orderBy: {
      transaction: {
        date: 'desc',
      },
    },
  });

  if (lastEntry) {
    return { accountId: lastEntry.accountId, accountName: lastEntry.account.name };
  }

  // 2. キーワードマスターによるマッチング
  for (const [kw, accName] of Object.entries(KEYWORD_MAP)) {
    if (description.includes(kw)) {
      const account = await prisma.account.findUnique({
        where: { name: accName },
      });
      if (account) {
        return { accountId: account.id, accountName: account.name };
      }
    }
  }

  return null;
}

/**
 * Geminiを用いたAI提案
 */
export async function getAiSuggestions(description: string, accounts: string[]): Promise<AiSuggestion[]> {
  if (!process.env.GEMINI_API_KEY) return [];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
    日本の個人事業主の青色申告用仕訳をアシストしてください。
    
    取引内容: "${description}"
    
    候補となる勘定科目リスト: [${accounts.join(', ')}]
    
    【指示】
    1. 上記リストから、この取引に最も適切な勘定科目を1つ提案してください。
    2. また、その取引が「タバコ、酒、美容、私的な食事、娯楽」など、事業に関係のない【私的な支出（プライベート）】である可能性が高いかどうかを判定してください。
    3. 私的な支出であると判定した場合、isPrivateをtrueにし、最も適切な科目として「事業主貸」を優先的に提案してください。
    
    出力形式は必ず以下の純粋なJSONオブジェクトにしてください。複数の提案は不要です。
    { 
      "accountName": "勘定科目名", 
      "reason": "なぜその科目が適切か（私用と判断した場合はその理由も）を日本語で簡潔に",
      "isPrivate": true/false 
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('[AI Suggestion] Raw Response:', text);

    let jsonStr = text.trim();
    // 正規表現でJSONブロックを抽出（より堅牢な方法）
    const jsonMatch = jsonStr.match(/```json\s?([\s\S]*?)```/) || jsonStr.match(/```\s?([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // コードブロックがない場合は、最初と最後の [] または {} を探す
      const startBracket = jsonStr.indexOf('[');
      const endBracket = jsonStr.lastIndexOf(']');
      if (startBracket !== -1 && endBracket !== -1) {
        jsonStr = jsonStr.substring(startBracket, endBracket + 1);
      }
    }

    const suggestions = JSON.parse(jsonStr);
    console.log('[AI Suggestion] Parsed Suggestion:', suggestions);
    // 配列ではなくオブジェクトが返ってくることを想定
    return Array.isArray(suggestions) ? suggestions : [suggestions];
  } catch (error) {
    console.error('Gemini AI Suggestion Error:', error);
    return [];
  }
}
