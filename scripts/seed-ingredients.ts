import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const ingredients = [
    // 魚介 (Fish) - 5-6月旬
    {
      name: 'カツオ (刺身・たたき用)',
      category: 'fish',
      seasonalMonths: [4, 5, 6],
      vitalityBenefit: 'アンセリン・カルノシンによる疲労回復、鉄分・亜鉛による血流改善',
      basePrice: 400,
      unit: '200gサク',
      isVitality: true,
    },
    {
      name: 'アジ',
      category: 'fish',
      seasonalMonths: [5, 6, 7, 8],
      vitalityBenefit: '良質なタンパク質とEPA/DHAによる血管柔軟性の維持',
      basePrice: 300,
      unit: '2尾',
      isVitality: true,
    },
    {
      name: 'イサキ',
      category: 'fish',
      seasonalMonths: [5, 6, 7],
      vitalityBenefit: '低脂質・高タンパク、ビタミンAによる粘膜保護',
      basePrice: 500,
      unit: '1尾',
      isVitality: false,
    },
    // 野菜 (Vegetables) - 5-6月旬
    {
      name: 'アスパラガス',
      category: 'vegetable',
      seasonalMonths: [4, 5, 6],
      vitalityBenefit: 'アスパラギン酸によるエネルギー代謝促進、スタミナ増強',
      basePrice: 200,
      unit: '1束(4-5本)',
      isVitality: true,
    },
    {
      name: '新玉ねぎ',
      category: 'vegetable',
      seasonalMonths: [3, 4, 5],
      vitalityBenefit: 'アリシンによる血管拡張、ビタミンB1吸収促進',
      basePrice: 250,
      unit: '1袋(3個)',
      isVitality: true,
    },
    {
      name: '枝豆',
      category: 'vegetable',
      seasonalMonths: [6, 7, 8],
      vitalityBenefit: 'メチオニンによる肝機能サポート、アルギニン含有',
      basePrice: 300,
      unit: '1袋(250g)',
      isVitality: true,
    },
    // 精肉 (Meat) - 定番・活力
    {
      name: '牛赤身肉 (もも)',
      category: 'meat',
      seasonalMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      vitalityBenefit: '亜鉛・L-カルニチンによるテストステロン向上、脂肪燃焼',
      basePrice: 600,
      unit: '200g',
      isVitality: true,
    },
    {
      name: '豚レバー',
      category: 'meat',
      seasonalMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      vitalityBenefit: '圧倒的なビタミンA・B群、鉄分による造血・活力維持',
      basePrice: 250,
      unit: '200g',
      isVitality: true,
    },
    {
      name: '鶏むね肉',
      category: 'meat',
      seasonalMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      vitalityBenefit: 'イミダゾールジペプチドによる抗疲労、筋合成',
      basePrice: 200,
      unit: '300g',
      isVitality: true,
    },
    // その他
    {
      name: 'ブロッコリー',
      category: 'vegetable',
      seasonalMonths: [11, 12, 1, 2, 3], // 旬ではないが筋トレ必須
      vitalityBenefit: 'インドール-3-カルビノールによるエストロゲン抑制・テストステロン相対向上',
      basePrice: 250,
      unit: '1株',
      isVitality: true,
    },
    {
      name: 'にんにく',
      category: 'seasoning',
      seasonalMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      vitalityBenefit: 'スコルジニンによる強壮効果、血流の爆発',
      basePrice: 100,
      unit: '1個',
      isVitality: true,
    },
  ];

  console.log('Start seeding ingredients...');

  for (const ingredient of ingredients) {
    await prisma.ingredientMaster.upsert({
      where: { name: ingredient.name },
      update: ingredient,
      create: ingredient,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
