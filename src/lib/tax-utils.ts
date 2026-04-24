/**
 * 日本の所得税法に基づく給与所得控除額を計算する (令和2年以降〜令和6年現在)
 * @param grossAmount 給与の額面金額（支払金額）
 * @returns 給与所得控除額
 */
export function calculateSalaryDeduction(grossAmount: number): number {
  if (grossAmount <= 1625000) {
    return 550000;
  } else if (grossAmount <= 1800000) {
    return Math.floor(grossAmount * 0.40 - 100000);
  } else if (grossAmount <= 3600000) {
    return Math.floor(grossAmount * 0.30 + 80000);
  } else if (grossAmount <= 6600000) {
    return Math.floor(grossAmount * 0.20 + 440000);
  } else if (grossAmount <= 8500000) {
    return Math.floor(grossAmount * 0.10 + 1100000);
  } else {
    return 1950000; // 上限
  }
}
