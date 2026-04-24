import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';

// APIキーの取得（環境変数から）
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 画像ファイルをBase64文字列に変換
    const base64Image = buffer.toString('base64');
    const mimeType = file.type;

    // Gemini 1.5 Pro または Flashモデルを使用（画像認識が得意なモデル）
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // すべての勘定科目を取得
    const accounts = await prisma.account.findMany();
    const accountNames = accounts.map(a => a.name).join(', ');

    const prompt = `
      このレシート画像の品目情報を詳細に読み取り、以下のJSONフォーマットで出力してください。
      本アプリは「個人の財布で買ったものからビジネス経費分だけを抽出する」スプリット会計に対応しています。
      
      【解析・判定ルール】
      1. レシート内のすべての品目（Line Items）を抽出してください。
      2. 各品目が「ビジネス経費（Business）」か「私物（Private/Personal）」かを厳格に判定してください。
         - タバコ、酒類、宝くじ、娯楽品、明らかに私的な食事、美容品などは必ず「私物」にしてください。
         - 「私物」と判定した品目は、isPersonalをtrueにしてください。
      3. ビジネス経費については、適切な勘定科目を推測してください（消耗品費、旅費交通費など）。
      4. 私物については、勘定科目を一律「事業主貸」としてください。

      【勘定科目の候補リスト】
      ${accountNames}

      【出力形式：JSONのみ】
      {
        "date": "YYYY-MM-DD",
        "totalAmount": 1500,
        "description": "店名",
        "items": [
          { "name": "品目名", "amount": 500, "isPersonal": boolean, "guessedAccount": "勘定科目名" }
        ],
        "suggestedEntries": [
          { "accountName": "勘定科目名", "amount": 数値, "reason": "理由（私用の場合はなぜ私用か明記）", "isPersonal": boolean }
        ]
      }
      
      ※JSON以外のテキストは一切含めず、純粋なJSONのみを返してください。
    `;

    const imageParts = [
      {
        inlineData: {
          data: base64Image,
          mimeType
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();

    // JSONパース
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```json\s?([\s\S]*?)```/) || jsonStr.match(/```\s?([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const startBracket = jsonStr.indexOf('{');
      const endBracket = jsonStr.lastIndexOf('}');
      if (startBracket !== -1 && endBracket !== -1) {
        jsonStr = jsonStr.substring(startBracket, endBracket + 1);
      }
    }

    const receiptData = JSON.parse(jsonStr.trim());
    console.log('[OCR] Parsed Data:', receiptData);
    return NextResponse.json(receiptData);

  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: 'Failed to process receipt image' }, { status: 500 });
  }
}
