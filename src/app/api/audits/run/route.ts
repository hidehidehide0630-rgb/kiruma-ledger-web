import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: Request) {
  try {
    const { startDate, endDate } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    // audit_engine.js のパスを取得
    const scriptPath = path.join(process.cwd(), 'scripts', 'audit_engine.js');
    
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Audit script not found' }, { status: 500 });
    }

    // 引数として日付を渡して実行
    // node scripts/audit_engine.js 2026-03-01 2026-03-31
    const command = `node "${scriptPath}" ${startDate} ${endDate}`;
    
    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          resolve(NextResponse.json({ error: 'Failed to execute audit' }, { status: 500 }));
          return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
        resolve(NextResponse.json({ success: true, message: 'Audit completed successfully', output: stdout }));
      });
    });

  } catch (error) {
    console.error('Error in manual audit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
