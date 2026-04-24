const { PrismaClient } = require('../src/generated/client');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// モデル名をより互換性の高いものに変更し、失敗時のフォールバックを実装
async function getAIReview(prompt) {
  const models = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-flash-latest"];
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    } catch (err) {
      console.warn(`AI Review with ${modelName} failed:`, err.message);
    }
  }
  return null;
}

// 簡易（旧）チェックロジックをフォールバックとして定義
function runHeuristicCheck(transactions) {
  const issues = [];
  for (const t of transactions) {
    const tIssues = [];
    if (t.description.length < 3) tIssues.push('摘要が短すぎます。具体的な店名や品目を記入してください。');
    const vagueKeywords = ['購入', '支払い', '買い物'];
    if (vagueKeywords.some(k => t.description.includes(k))) {
      tIssues.push(`摘要「${t.description}」が抽象的すぎます。具体的な内容を記入してください。`);
    }
    if (t.description.includes('うんこ')) tIssues.push({ point: '摘要', issue: '不適切な言葉が含まれています。', suggestion: '真面目な内容に書き換えてください。' });
    
    if (tIssues.length > 0) {
      issues.push({ id: t.id, assessment: tIssues });
    }
  }
  return issues;
}

async function runAudit(targetStartDate, targetEndDate) {
  console.log(`Starting AI Audit for ${targetStartDate.toLocaleDateString()} to ${targetEndDate.toLocaleDateString()}...`);

  // 取引データの取得
  const transactions = await prisma.transaction.findMany({
    where: {
      date: { gte: targetStartDate, lte: targetEndDate },
      isDeleted: false,
    },
    include: {
      journalEntries: {
        include: { account: true },
      },
    },
  });

  if (transactions.length === 0) {
    console.log('No transactions found for this period.');
    return;
  }

  // AIに送るデータの整形
  const dataForAI = transactions.map(t => ({
    id: t.id,
    date: t.date.toLocaleDateString(),
    description: t.description,
    journal: t.journalEntries.map(j => ({
      account: j.account.name,
      amount: j.amount,
      type: j.entryType
    }))
  }));

  const prompt = `あなたは厳格な日本の税理士です。以下の取引データのリストを審査し、税務署の監査で否認・指摘されるリスクがある取引を特定してください。
審査基準:
- 摘要の内容が具体的か（店名や品目があるか）。「買い物」や不適切な言葉、事業と無関係そうな内容はNG。
- 摘要と勘定科目に矛盾がないか。
- 支出の妥当性が疑わしいもの。
- **所得控除に関する特例**:
  - 「所得控除：国民健康保険」や「国民年金」などのカテゴリは、本アプリ独自の所得控除集計用カテゴリであり、経費（損益計算書）には算入されません。
  - これらの科目が使われている場合、勘定科目が不自然であるという指摘は **行わないでください**。
  - また、貸方が「事業主貸」または「事業主借」であれば、個人と事業の資金移動として **正当なものとして扱ってください**。

【取引データ】
${JSON.stringify(dataForAI, null, 2)}

【出力形式】
以下のJSON形式のみで出力してください。追加の文章は不要です。
[
  {
    "id": 取引ID,
    "assessment": [
      {
        "point": "不備のある具体的な箇所（摘要、勘定科目など）",
        "issue": "何が問題なのか",
        "suggestion": "具体的にどう改善・修正すべきか"
      }
    ]
  }
]
もし全て問題なければ空の配列 [] を返してください。`;

  let issues = await getAIReview(prompt);
  
  // AIが失敗した場合は従来の簡易チェックを行う
  if (!issues) {
    console.warn('Falling back to heuristic audit...');
    issues = runHeuristicCheck(transactions);
  }

  const status = issues.length > 0 ? 'WARNING' : 'OK';
  const summary = issues.length > 0 
    ? `${transactions.length}件中、${issues.length}件の取引に不備の可能性があります。` 
    : 'すべての取引が税務署の承認基準を満たしている可能性が高いです。';

  // DBへ保存
  const review = await prisma.auditReview.create({
    data: {
      startDate: targetStartDate,
      endDate: targetEndDate,
      status: status,
      summary: summary,
      details: JSON.stringify(issues, null, 2),
    }
  });

  // ログファイルへの出力 (Workflows用)
  const logDir = path.join(__dirname, '../../kiruma-company/.agent/skills/hq-tax-affairs/reviews');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  
  const logPath = path.join(logDir, `${targetStartDate.toISOString().split('T')[0]}_audit.md`);
  const logContent = `# AI取引監査レポート (${targetStartDate.toLocaleDateString()} 〜 ${targetEndDate.toLocaleDateString()})

## 判定: ${status}
**概要**: ${summary}

${issues.length > 0 ? '### 指摘事項と改善案' : ''}
${issues.map(item => {
    const t = transactions.find(x => x.id === item.id);
    const assessmentText = item.assessment.map(a => 
      `  - **不備箇所**: ${a.point}\n    - **問題点**: ${a.issue}\n    - **改善案**: ${a.suggestion}`
    ).join('\n');
    return `- **[${t?.date.toLocaleDateString()}] ${t?.description}** (ID: ${item.id})\n${assessmentText}`;
  }).join('\n')}

---
判定方法: ${issues === null ? '簡易(Heuristic)' : 'AI(Gemini)'} / 作成日時: ${new Date().toLocaleString()}
`;
  fs.writeFileSync(logPath, logContent);

  console.log(`Audit complete. Log written to: ${logPath}`);

  // Google カレンダー通知用のサマリー作成
  const calendarSummary = issues.length > 0 
    ? `${summary}\n\n${issues.slice(0, 3).map(item => {
        const t = transactions.find(x => x.id === item.id);
        return `・[${t?.description}] ${item.assessment[0].issue} → ${item.assessment[0].suggestion}`;
      }).join('\n')}${issues.length > 3 ? '\n...他' : ''}`
    : summary;

  // Google カレンダー通知の実行
  try {
    const scriptPath = path.join(__dirname, 'gcal_notify.js');
    console.log('Sending Google Calendar notification...');
    execSync(`node "${scriptPath}" "${status}" "${calendarSummary}"`, { stdio: 'inherit' });
  } catch (err) {
    console.warn('Google Calendar notification skipped or failed:', err.message);
  }

  return review;
}

// 実行（引数があれば期間指定、なければ先週分）
let targetStartDate, targetEndDate;

if (process.argv[2] && process.argv[3]) {
  // node scripts/audit_engine.js 2026-03-01 2026-03-31 のように指定された場合
  targetStartDate = new Date(process.argv[2]);
  targetEndDate = new Date(process.argv[3]);
  targetEndDate.setHours(23, 59, 59, 999);
} else {
  // デフォルト: 先週の日曜日〜土曜日
  const now = new Date();
  targetStartDate = new Date(now);
  targetStartDate.setDate(now.getDate() - now.getDay() - 7);
  targetStartDate.setHours(0, 0, 0, 0);

  targetEndDate = new Date(targetStartDate);
  targetEndDate.setDate(targetStartDate.getDate() + 6);
  targetEndDate.setHours(23, 59, 59, 999);
}

runAudit(targetStartDate, targetEndDate)
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
