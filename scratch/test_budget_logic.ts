import { HouseholdLogic } from '../src/lib/logic/household';

async function testGeneration() {
    console.log('--- 献立生成テスト開始 ---');
    console.log('設定: 7日間, 総予算 7,000円 (1日目安 1,000円)');
    
    const menu = await HouseholdLogic.generateMenu({
        startDate: new Date(),
        days: 7,
        tripBudget: 7000,
        vitalityMode: true
    });

    let totalCost = 0;
    menu.forEach((item, index) => {
        const price = item.recipe.estimatedPrice;
        totalCost += price;
        console.log(`Day ${index + 1}: ${item.recipe.name} (${price}円)`);
    });

    console.log('---------------------------');
    console.log(`合計金額: ${totalCost}円`);
    console.log(`平均単価: ${Math.floor(totalCost / 7)}円`);
    
    if (totalCost <= 7000 + 500 * 7) {
        console.log('✅ 予算バッファ内に収まっています。');
    } else {
        console.log('❌ 予算を大幅に超過しています。');
    }
}

testGeneration().catch(console.error);
