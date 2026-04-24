import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 所得控除データの取得 (Raw SQL)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const yearInt = parseInt(year);

    const deductions: any[] = await prisma.$queryRaw`
      SELECT * FROM YearlyTaxDeduction WHERE year = ${yearInt}
    `;

    if (deductions.length === 0) {
      return NextResponse.json({
        year: yearInt,
        healthInsurance: 0,
        pension: 0,
        lifeInsuranceGeneral: 0,
        lifeInsuranceMedical: 0,
        lifeInsuranceKenmin: 0,
        earthquakeInsurance: 0,
        ideco: 0
      });
    }

    return NextResponse.json(deductions[0]);
  } catch (error: any) {
    console.error('Error fetching tax deductions:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}

// POST: 所得控除データの更新 (Raw SQL)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      year, 
      healthInsurance, 
      pension,
      lifeInsuranceGeneral,
      lifeInsuranceMedical,
      lifeInsuranceKenmin,
      earthquakeInsurance,
      ideco
    } = body;
    const yearInt = parseInt(year);
    const hi = Number(healthInsurance) || 0;
    const p = Number(pension) || 0;
    const lig = Number(lifeInsuranceGeneral) || 0;
    const lim = Number(lifeInsuranceMedical) || 0;
    const lik = Number(lifeInsuranceKenmin) || 0;
    const ei = Number(earthquakeInsurance) || 0;
    const idc = Number(ideco) || 0;
    const now = new Date().toISOString();

    // Upsert logic using Raw SQL (SQLite)
    await prisma.$executeRaw`
      INSERT INTO YearlyTaxDeduction (
        year, healthInsurance, pension, 
        lifeInsuranceGeneral, lifeInsuranceMedical, lifeInsuranceKenmin,
        earthquakeInsurance, ideco, updatedAt
      )
      VALUES (${yearInt}, ${hi}, ${p}, ${lig}, ${lim}, ${lik}, ${ei}, ${idc}, ${now})
      ON CONFLICT(year) DO UPDATE SET
        healthInsurance = excluded.healthInsurance,
        pension = excluded.pension,
        lifeInsuranceGeneral = excluded.lifeInsuranceGeneral,
        lifeInsuranceMedical = excluded.lifeInsuranceMedical,
        lifeInsuranceKenmin = excluded.lifeInsuranceKenmin,
        earthquakeInsurance = excluded.earthquakeInsurance,
        ideco = excluded.ideco,
        updatedAt = excluded.updatedAt
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating tax deductions:', error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
