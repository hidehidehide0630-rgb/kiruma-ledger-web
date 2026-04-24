import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year') || new Date().getFullYear().toString();
    const year = parseInt(yearStr);
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    // 1. 全勘定科目と仕訳を取得
    const accounts = await prisma.account.findMany({
      include: {
        journalEntries: {
          where: {
            transaction: { date: { gte: startDate, lte: endDate }, isDeleted: false }
          },
          include: {
            transaction: true
          }
        },
        businessRatio: true,
      }
    });

    // 2. 固定資産を取得
    const fixedAssets = await prisma.fixedAsset.findMany({
      where: { purchaseDate: { lte: endDate }, isDeleted: false }
    });

    // 3. 勘定科目ごとの集計
    const reportData = accounts.map(acc => {
      let totalDebit = 0;
      let totalCredit = 0;
      for (const entry of acc.journalEntries) {
        if (entry.entryType === 'DEBIT') totalDebit += entry.amount;
        else totalCredit += entry.amount;
      }
      let rawBalance = 0;
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') rawBalance = totalDebit - totalCredit;
      else rawBalance = totalCredit - totalDebit;

      let businessAmount = rawBalance;
      const ratio = (acc.businessRatio as any)?.ratio ?? 100;
      
      // 所得控除科目 (800番台) は事業経費に含めない
      if (acc.type === 'EXPENSE') {
        if (acc.code && acc.code.startsWith('8')) {
          businessAmount = 0; // 事業所得の計算からは除外
        } else {
          businessAmount = Math.floor(rawBalance * (ratio / 100));
        }
      }

      return { id: acc.id, name: acc.name, type: acc.type, code: acc.code, rawBalance, businessAmount, ratio };
    });

    // 4. 減価償却費
    let totalDepreciation = 0;
    fixedAssets.forEach(asset => {
      if (asset.purchaseDate <= endDate) totalDepreciation += Math.floor(asset.purchasePrice / asset.usefulLife);
    });
    const depAccount = reportData.find(a => a.name === '減価償却費');
    if (depAccount) depAccount.businessAmount += totalDepreciation;

    const revenues = reportData.filter(a => a.type === 'REVENUE');
    const expenses = reportData.filter(a => a.type === 'EXPENSE' && (!a.code || !a.code.startsWith('8')));
    const assets = reportData.filter(a => a.type === 'ASSET');
    const liabilities = reportData.filter(a => a.type === 'LIABILITY');
    
    const totalRevenue = revenues.reduce((sum, a) => sum + a.businessAmount, 0);
    const totalExpense = expenses.reduce((sum, a) => sum + a.businessAmount, 0);
    const netProfit = totalRevenue - totalExpense;

    // 月別売上の集計
    const monthlySales = Array(12).fill(0);
    const salesAcc = accounts.find(a => a.name === '売上高');
    if (salesAcc) {
      salesAcc.journalEntries.forEach(entry => {
        if (entry.entryType === 'CREDIT') {
          const m = new Date(entry.transaction.date).getMonth();
          if (m >= 0 && m < 12) monthlySales[m] += entry.amount;
        }
      });
    }

    // 6. 源泉徴収税 (Prisma Client を使用して日付比較の確実性を担保)
    // tag = '源泉徴収税' のもの、または 勘定名が '事業主貸' 且つ 摘要に '源泉' を含むものを合算
    const withholdingTaxJournalEntries = await prisma.journalEntry.findMany({
      where: {
        transaction: {
          date: { gte: startDate, lte: endDate },
          isDeleted: false,
        },
        OR: [
          { tag: '源泉徴収税' },
          {
            AND: [
              { account: { name: '事業主貸' } },
              { transaction: { description: { contains: '源泉' } } }
            ]
          }
        ]
      }
    });
    const totalWithholdingTax = withholdingTaxJournalEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    console.log(`Debug: Withholding entries found: ${withholdingTaxJournalEntries.length}, Total: ${totalWithholdingTax}`);

    // 7. 給与所得の集計 (Raw SQL)
    let salaryIncome = 0;
    let salarySocialInsurance = 0;
    let salaryWithholdingTax = 0;
    let isConfirmedMode = false;

    // YearlySummary
    const summaries: any[] = await prisma.$queryRaw`
      SELECT * FROM YearlySalarySummary WHERE year = ${year}
    `;
    const yearlySummary = summaries[0];

    if (yearlySummary && (yearlySummary.isConfirmed === 1 || yearlySummary.isConfirmed === true)) {
      salaryIncome = Number(yearlySummary.totalAmount) || 0;
      salarySocialInsurance = Number(yearlySummary.totalSocialInsurance) || 0;
      salaryWithholdingTax = Number(yearlySummary.totalWithholdingTax) || 0;
      isConfirmedMode = true;
    } else {
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      const salaries: any[] = await prisma.$queryRaw`
        SELECT * FROM Salary WHERE date >= ${startIso} AND date <= ${endIso}
      `;
      salaryIncome = salaries.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      salarySocialInsurance = salaries.reduce((sum, s) => sum + (Number(s.socialInsurance) || 0), 0);
      salaryWithholdingTax = salaries.reduce((sum, s) => sum + (Number(s.withholdingTax) || 0), 0);
    }

    const getSalaryDeduction = (gross: number) => {
      if (gross <= 1625000) return 550000;
      if (gross <= 1800000) return Math.floor(gross * 0.40 - 100000);
      if (gross <= 3600000) return Math.floor(gross * 0.30 + 80000);
      if (gross <= 6600000) return Math.floor(gross * 0.20 + 440000);
      if (gross <= 8500000) return Math.floor(gross * 0.10 + 1100000);
      return 1950000;
    };
    const salaryDeduction = salaryIncome > 0 ? getSalaryDeduction(salaryIncome) : 0;
    const netSalaryIncome = Math.max(0, salaryIncome - salaryDeduction);

    // 8. 所得控除取得（YearlyTaxDeduction モデルからも取得）
    const taxDeductionSetting = await prisma.yearlyTaxDeduction.findUnique({
      where: { year: year }
    });

    // 全ての仕訳データをフラットにする（集計用）
    const allJournalEntries = accounts.flatMap(acc => 
      acc.journalEntries.map(e => ({ ...e, account: acc }))
    );

    const getDeductionAmount = (code: string) => {
      // 800番台の科目について、仕訳データ（DEBIT側）を合算
      const journalTotal = allJournalEntries
        .filter((e: any) => e.account.code === code && e.entryType === 'DEBIT')
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      
      // 設定値（YearlyTaxDeduction）との合算
      let settingValue = 0;
      if (taxDeductionSetting) {
        if (code === '801') settingValue = (taxDeductionSetting as any).healthInsurance;
        if (code === '802') settingValue = (taxDeductionSetting as any).pension;
        if (code === '803') settingValue = (taxDeductionSetting as any).lifeInsuranceGeneral;
        if (code === '804') settingValue = (taxDeductionSetting as any).earthquakeInsurance;
        if (code === '805') settingValue = (taxDeductionSetting as any).ideco;
        if (code === '806') settingValue = (taxDeductionSetting as any).lifeInsuranceKenmin;
      }
      
      return journalTotal + settingValue;
    };

    const healthInsurance = getDeductionAmount('801');
    const pension = getDeductionAmount('802');
    const lifeInsuranceGeneral = getDeductionAmount('803');
    const earthquakeInsurance = getDeductionAmount('804');
    const ideco = getDeductionAmount('805');
    const lifeInsuranceKenmin = getDeductionAmount('806');

    const totalTaxDeduction = healthInsurance + pension + lifeInsuranceGeneral + earthquakeInsurance + ideco + lifeInsuranceKenmin;

    return NextResponse.json({
      year,
      summary: {
        totalRevenue, totalExpense, netProfit, totalWithholdingTax,
        totalAssets: assets.reduce((sum, a) => sum + a.rawBalance, 0),
        totalLiabilities: liabilities.reduce((sum, a) => sum + a.rawBalance, 0),
        salary: {
          gross: salaryIncome, 
          deduction: salaryDeduction, 
          net: netSalaryIncome,
          socialInsurance: salarySocialInsurance, 
          withholdingTax: salaryWithholdingTax,
          isConfirmed: isConfirmedMode
        },
        taxDeduction: {
          healthInsurance,
          pension,
          lifeInsuranceGeneral,
          lifeInsuranceMedical: 0,
          lifeInsuranceKenmin,
          earthquakeInsurance,
          ideco,
          total: totalTaxDeduction
        },
        totalIncome: Math.max(0, netProfit + netSalaryIncome - totalTaxDeduction)
      },
      expenses: expenses.filter(e => e.businessAmount !== 0 || e.name === '減価償却費').map(e => ({
        id: e.id, name: e.name, type: e.type, businessAmount: e.businessAmount, ratio: e.ratio
      })),
      assets: assets.filter(a => a.rawBalance !== 0),
      monthlySales
    });
  } catch (error: any) {
    console.error('Tax Summary Error:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
