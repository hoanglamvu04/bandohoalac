// Unknown charges stay unknown; zero is an explicitly published free charge.
function charge(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function scaled(value, quantity) {
  if (quantity === 0) return 0;
  const rate = charge(value);
  return rate === null ? null : rate * quantity;
}
export function estimateHousingCosts(housing, { people = 1, kwh = 80, vehicles = 1 } = {}) {
  const quantities = [people,kwh,vehicles];
  if (!quantities.every((n) => Number.isInteger(n) && n >= 0) ||
      people < 1 || people > 20 || kwh > 2000 || vehicles > 20) return null;
  const monthly = [
    ['Tiền thuê',charge(housing.monthlyRent)],
    ['Tiền điện',scaled(housing.electricityPricePerKwh,kwh)],
    ['Tiền nước',scaled(housing.waterPricePerPersonMonth,people)],
    ['Gửi xe',scaled(housing.parkingFeeMonthly,vehicles)]
  ];
  const deposit = charge(housing.depositAmount);
  const knownMonthly = monthly.reduce((sum,[,amount]) => sum + (amount ?? 0),0);
  const missingMonthly = monthly.filter(([,amount]) => amount === null).map(([name]) => name);
  return { monthly, deposit, knownMonthly, knownFirstMonth:knownMonthly+(deposit??0),
    missingMonthly, missingFirstMonth:[...missingMonthly,...(deposit===null?['Tiền cọc']:[])] };
}
