import { PrismaClient } from '../src/generated/client';

const prisma = new PrismaClient();

const accounts = [
  // 資産 (ASSET)
  { name: '現金', type: 'ASSET', code: '100' },
  { name: '普通預金', type: 'ASSET', code: '101' },
  { name: '売掛金', type: 'ASSET', code: '102' },
  { name: '事業主貸', type: 'ASSET', code: '103' },
  { name: '前払金', type: 'ASSET', code: '104' },
  { name: '建物', type: 'ASSET', code: '110' },
  { name: '車両運搬具', type: 'ASSET', code: '111' },
  { name: '工具器具備品', type: 'ASSET', code: '112' },
  { name: '電子マネー', type: 'ASSET', code: '105' },

  // 負債 (LIABILITY)
  { name: '買掛金', type: 'LIABILITY', code: '200' },
  { name: '未払金', type: 'LIABILITY', code: '201' },
  { name: '事業主借', type: 'LIABILITY', code: '202' },
  { name: '預り金', type: 'LIABILITY', code: '203' },
  { name: '借入金', type: 'LIABILITY', code: '204' },
  { name: 'クレジットカード', type: 'LIABILITY', code: '205' },

  // 純資産 (EQUITY)
  { name: '元入金', type: 'EQUITY', code: '300' },

  // 収益 (REVENUE)
  { name: '売上高', type: 'REVENUE', code: '400' },
  { name: '雑収入', type: 'REVENUE', code: '401' },

  // 費用 (EXPENSE)
  { name: '仕入高', type: 'EXPENSE', code: '500' },
  { name: '租税公課', type: 'EXPENSE', code: '501' },
  { name: '荷造運賃費', type: 'EXPENSE', code: '502' },
  { name: '水道光熱費', type: 'EXPENSE', code: '503' },
  { name: '旅費交通費', type: 'EXPENSE', code: '504' },
  { name: '通信費', type: 'EXPENSE', code: '505' },
  { name: '広告宣伝費', type: 'EXPENSE', code: '506' },
  { name: '接待交際費', type: 'EXPENSE', code: '507' },
  { name: '損害保険料', type: 'EXPENSE', code: '508' },
  { name: '修繕費', type: 'EXPENSE', code: '509' },
  { name: '消耗品費', type: 'EXPENSE', code: '510' },
  { name: '減価償却費', type: 'EXPENSE', code: '511' },
  { name: '福利厚生費', type: 'EXPENSE', code: '512' },
  { name: '地代家賃', type: 'EXPENSE', code: '513' },
  { name: '支払手数料', type: 'EXPENSE', code: '514' },
  { name: '外注工賃', type: 'EXPENSE', code: '515' },
  { name: '雑費', type: 'EXPENSE', code: '516' },
  { name: '新聞図書費', type: 'EXPENSE', code: '517' },
  { name: '会議費', type: 'EXPENSE', code: '518' },
  { name: '研修費', type: 'EXPENSE', code: '519' },

  // 所得控除 (DEDUCTION - 800番台)
  { name: '所得控除：国民健康保険', type: 'EXPENSE', code: '801' },
  { name: '所得控除：国民年金', type: 'EXPENSE', code: '802' },
  { name: '所得控除：生命保険料', type: 'EXPENSE', code: '803' },
  { name: '所得控除：地震保険料', type: 'EXPENSE', code: '804' },
  { name: '所得控除：iDeCo / 小規模企業共済', type: 'EXPENSE', code: '805' },
  { name: '所得控除：生命保険料（県民共済等）', type: 'EXPENSE', code: '806' },
];

async function main() {
  console.log('勘定科目マスターデータを投入中...');

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { name: account.name },
      update: {},
      create: account,
    });
  }

  console.log(`${accounts.length} 件の勘定科目を投入しました。`);

  // ウォレット（決済手段）の初期設定
  console.log('決済手段（Wallet）データを投入中...');
  const walletConfigs = [
    { name: '現金', accountName: '現金' },
    { name: '事業用普通預金', accountName: '普通預金' },
    { name: 'クレジットカード (事業用)', accountName: 'クレジットカード' },
    { name: '本人立替 (個人カード/財布)', accountName: '事業主借' },
    { name: 'PayPay / 電子マネー', accountName: '電子マネー' },
  ];

  for (const config of walletConfigs) {
    const account = await prisma.account.findUnique({ where: { name: config.accountName } });
    if (account) {
      await prisma.wallet.upsert({
        where: { name: config.name },
        update: { accountId: account.id },
        create: { name: config.name, accountId: account.id },
      });
    }
  }
  console.log('決済手段の投入が完了しました。');

  // 家計カテゴリ (Household Categories)
  console.log('家計簿カテゴリを投入中...');
  const householdCategories = [
    { name: '朝食・昼食', icon: 'coffee' },
    { name: '夕食', icon: 'utensils' },
    { name: '調味料', icon: 'bottle-droplet' },
    { name: '嗜好品', icon: 'cookie' },
    { name: '交際費', icon: 'users' },
    { name: '日用品', icon: 'shopping-basket' },
    { name: '住居費', icon: 'home' },
    { name: '通信費', icon: 'wifi' },
    { name: '光熱費', icon: 'bolt' },
    { name: '娯楽・レジャー', icon: 'star' },
    { name: '美容・衣服', icon: 'shirt' },
    { name: '医療・健康', icon: 'heart-pulse' },
    { name: '交通費', icon: 'train' },
    { name: '雑費', icon: 'circle' },
  ];

  for (const cat of householdCategories) {
    await prisma.householdCategory.upsert({
      where: { name: cat.name },
      update: { icon: cat.icon },
      create: cat,
    });
  }
  console.log('家計簿カテゴリの投入が完了しました。');

  // 初期予算を設定 (例)
  console.log('初期予算データを設定中...');
  const dinnerCat = await prisma.householdCategory.findUnique({ where: { name: '夕食' } });
  if (dinnerCat) {
    await prisma.householdBudget.upsert({
      where: {
        year_month_categoryId: {
          year: 2026,
          month: 4,
          categoryId: dinnerCat.id
        }
      },
      update: { amount: 60000 },
      create: {
        year: 2026,
        month: 4,
        amount: 60000,
        categoryId: dinnerCat.id
      }
    });
  }

  // レシピのシード（簡易化のため一部抜粋）
  console.log('初期レシピデータを投入中...');
  const sampleRecipes = [
    {
      id: 'rec001',
      name: '肉じゃが',
      ingredients: JSON.stringify([
        { ingredientId: 'meat003', quantity: '200g' },
        { ingredientId: 'veg004', quantity: '3個' },
        { ingredientId: 'veg002', quantity: '1個' },
        { ingredientId: 'veg003', quantity: '1本' }
      ]),
      instructions: '1. 野菜と肉を切る\n2. 肉を炒め、野菜を加える\n3. 醤油・みりん・砂糖で煮込む（15分）',
      estimatedPrice: 580
    },
    {
      id: 'rec002',
      name: '豚の生姜焼き',
      ingredients: JSON.stringify([
        { ingredientId: 'meat003', quantity: '250g' },
        { ingredientId: 'veg018', quantity: '1かけ' },
        { ingredientId: 'veg002', quantity: '1/2個' }
      ]),
      instructions: '1. 生姜をすりおろし、タレを作る\n2. 肉を焼く\n3. タレを絡める',
      estimatedPrice: 420
    }
  ];

  for (const recipe of sampleRecipes) {
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      update: recipe,
      create: recipe
    });
  }
  console.log('レシピデータの投入が完了しました。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
