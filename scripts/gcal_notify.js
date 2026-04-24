/**
 * Google カレンダー連携スクリプト
 * 監査結果を「全日（終日）の予定（またはタスク）」としてGoogleカレンダーに登録します。
 */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// スコープの定義。カレンダーの読み書き権限が必要です。
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
// 認証情報の読み込み
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// 監査結果のステータスとサマリーを引数で受け取る
const auditStatus = process.argv[2] || 'UNKNOWN';
const auditSummary = process.argv[3] || '監査が実行されました。';

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('credentials.jsonが見つかりません。Google Cloud Consoleから発行して配置してください。');
  }
  const content = fs.readFileSync(CREDENTIALS_PATH);
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }
  
  return getAccessToken(oAuth2Client);
}

function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('認証URLをブラウザで開いてください:\n', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve, reject) => {
    rl.question('そのページに表示されたコードをここに入力してください: ', (code) => {
      rl.close();
      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject('トークンの取得に失敗しました: ' + err);
        oAuth2Client.setCredentials(token);
        // 次回以降のために保存
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('トークンが保存されました:', TOKEN_PATH);
        resolve(oAuth2Client);
      });
    });
  });
}

async function createEvent(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  
  const eventTitle = `【経理レビュー】${auditStatus === 'OK' ? '✅ 良好' : '⚠️ 要確認'}`;
  const eventDescription = auditSummary + '\n\n詳細: https://localhost:3000 (ダッシュボードを参照)';

  const event = {
    summary: eventTitle,
    description: eventDescription,
    start: {
      date: new Date().toISOString().split('T')[0],
      timeZone: 'Asia/Tokyo',
    },
    end: {
      date: new Date().toISOString().split('T')[0],
      timeZone: 'Asia/Tokyo',
    },
    colorId: auditStatus === 'OK' ? '10' : '11', // OKなら緑、以外なら赤っぽい色
  };

  try {
    const res = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
    console.log('Event created:', res.data.htmlLink);
  } catch (error) {
    console.error('Failed to create event:', error);
  }
}

authorize().then(auth => {
  if (auth) createEvent(auth);
}).catch(console.error);
