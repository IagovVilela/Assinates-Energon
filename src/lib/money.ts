const MINOR_DIGITS: Record<string, number> = {
  BRL: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

export function minorDigits(currency: string) {
  return MINOR_DIGITS[currency] ?? 2;
}

export function minorToMajor(amountMinor: number, currency: string) {
  const digits = minorDigits(currency);
  return Number((amountMinor / 10 ** digits).toFixed(digits));
}

export function formatMoney(amountMinor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(minorToMajor(amountMinor, currency));
}

export function installmentAmountMinor(totalMinor: number, installments: number) {
  const count = Math.max(1, Math.floor(installments));
  return Math.ceil(totalMinor / count);
}
