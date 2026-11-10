export function formatMoney(minorUnits: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const fractionDigits = new Intl.NumberFormat(undefined, { style: "currency", currency: normalizedCurrency })
    .resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: fractionDigits,
  }).format(minorUnits / 10 ** fractionDigits);
}
