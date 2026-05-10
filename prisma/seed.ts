import { PrismaClient } from '@prisma/client';

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

  // レシピのシード（活力向上・ボディメイク・予算厳守版）
  console.log('初期レシピデータを投入中...');
  const sampleRecipes = [
    {
      id: 'v_rec_001',
      name: '活力・マッスル鶏むねガーリックステーキ',
      ingredients: JSON.stringify([
        { name: '鶏むね肉', quantity: '300g' },
        { name: 'ほうれん草', quantity: '1/2束' },
        { name: 'にんにく', quantity: '2片' },
        { name: 'オリーブオイル', quantity: '適量' }
      ]),
      instructions: '1. 鶏むね肉を厚めに切り、塩コショウで下味をつける\n2. にんにくをオリーブオイルで炒め、香りを出す\n3. 肉を焼き、仕上げにほうれん草をさっと炒め合わせる',
      estimatedPrice: 850
    },
    {
      id: 'v_rec_002',
      name: '血流改善！ほうれん草と豚の亜鉛チャージ炒め',
      ingredients: JSON.stringify([
        { name: '豚赤身スライス', quantity: '200g' },
        { name: 'ほうれん草', quantity: '1束' },
        { name: 'ブロッコリー', quantity: '100g' },
        { name: 'ごま油', quantity: '少々' }
      ]),
      instructions: '1. 豚肉と野菜を一口大に切る\n2. 強火で豚肉を炒め、野菜を加える\n3. 醤油と酒で味を整え、ごま油で仕上げる',
      estimatedPrice: 950
    },
    {
      id: 'v_rec_003',
      name: '除脂肪・胸筋強化！トマトと赤身肉の煮込み',
      ingredients: JSON.stringify([
        { name: '牛赤身細切れ', quantity: '200g' },
        { name: 'トマト缶', quantity: '1/2缶' },
        { name: '玉ねぎ', quantity: '1/2個' },
        { name: 'ブロッコリー', quantity: '適量' }
      ]),
      instructions: '1. 玉ねぎを炒め、牛肉を加えて焼き色をつける\n2. トマト缶と少々の水、コンソメを加えて煮込む\n3. 仕上げにブロッコリーを添える',
      estimatedPrice: 1100
    },
    {
      id: 'v_rec_004',
      name: '真・バイタリティまぐろ納豆丼',
      ingredients: JSON.stringify([
        { name: 'まぐろ赤身', quantity: '100g' },
        { name: '納豆', quantity: '1パック' },
        { name: 'めかぶ', quantity: '1パック' },
        { name: '生卵', quantity: '1個' },
        { name: '麦飯', quantity: '1杯' }
      ]),
      instructions: '1. まぐろを角切りにする\n2. 納豆、めかぶを混ぜ合わせる\n3. 麦飯の上に具材を盛り、中央に卵黄を落とす',
      estimatedPrice: 1200
    },
    {
      id: 'v_rec_005',
      name: 'スタミナ補給！レバニラ・バイタリティ炒め',
      ingredients: JSON.stringify([
        { name: '豚レバー', quantity: '150g' },
        { name: 'ニラ', quantity: '1束' },
        { name: 'もやし', quantity: '100g' },
        { name: 'にんにく・生姜', quantity: '各1片' }
      ]),
      instructions: '1. レバーの下処理を行い、片栗粉をまぶして焼く\n2. にんにく、生姜、野菜を加えて一気に炒める\n3. オイスターソースと醤油で味を付ける',
      estimatedPrice: 750
    },
    {
      id: 'v_rec_006',
      name: '胸筋ビルドアップ・サバのガリバタトマト焼き',
      ingredients: JSON.stringify([
        { name: 'サバ切り身', quantity: '2切れ' },
        { name: 'トマト', quantity: '1個' },
        { name: 'にんにく', quantity: '1片' },
        { name: 'バター', quantity: '10g' }
      ]),
      instructions: '1. サバをにんにくと共にバターで焼く\n2. カットしたトマトを加え、水分が出るまで加熱する\n3. 塩コショウで味を整える',
      estimatedPrice: 800
    },
    {
      id: 'v_rec_007',
      name: '亜鉛最大化！厚揚げと豚のオイスター炒め',
      ingredients: JSON.stringify([
        { name: '豚バラ肉', quantity: '100g' },
        { name: '厚揚げ', quantity: '1枚' },
        { name: '小松菜', quantity: '1/2束' },
        { name: 'カシューナッツ', quantity: '少々' }
      ]),
      instructions: '1. 厚揚げと肉を焼き、焼き色をつける\n2. 小松菜とナッツを加えて炒め合わせる\n3. オイスターソースでコクを出す',
      estimatedPrice: 900
    },
    {
      id: 'v_rec_008',
      name: '鶏むね肉とブロッコリーの最強筋肉炒め',
      ingredients: JSON.stringify([
        { name: '鶏むね肉', quantity: '200g' },
        { name: 'ブロッコリー', quantity: '1/2株' },
        { name: '塩麹', quantity: '大さじ1' },
        { name: 'にんにく', quantity: '1片' }
      ]),
      instructions: '1. 鶏肉をそぎ切りにし、塩麹で揉み込む\n2. ブロッコリーを小房に分け、レンジで加熱する\n3. フライパンでにんにくと共に鶏肉を焼き、最後にブロッコリーを合わせる',
      estimatedPrice: 450
    },
    {
      id: 'v_rec_009',
      name: '血流UP！鯖缶とトマトの地中海風パスタ',
      ingredients: JSON.stringify([
        { name: '鯖水煮缶', quantity: '1缶' },
        { name: 'トマト缶', quantity: '1/2缶' },
        { name: 'パスタ', quantity: '100g' },
        { name: '唐辛子', quantity: '少々' }
      ]),
      instructions: '1. パスタを茹でる\n2. フライパンで鯖、トマト缶、唐辛子を加熱する\n3. 茹で上がったパスタをソースと絡める',
      estimatedPrice: 550
    },
    {
      id: 'v_rec_010',
      name: '最強の亜鉛源！豚レバーの生姜焼き風',
      ingredients: JSON.stringify([
        { name: '豚レバー', quantity: '150g' },
        { name: '玉ねぎ', quantity: '1/2個' },
        { name: '生姜', quantity: '1片' },
        { name: 'ニラ', quantity: '1/2束' }
      ]),
      instructions: '1. レバーを下処理し、薄切りにする\n2. 玉ねぎとレバーを炒め、生姜醤油で味付ける\n3. 最後にニラを加えてサッと炒める',
      estimatedPrice: 480
    }
  ];

  for (const recipe of sampleRecipes) {
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      update: recipe,
      create: recipe
    });
  }
  console.log('バイタリティ・ボディメイク特化型レシピデータの投入が完了しました。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
