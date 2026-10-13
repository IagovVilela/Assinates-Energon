export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskBrazilianTaxId(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskInternationalTaxId(value: string) {
  return value.replace(/[^A-Za-z0-9.\-\/ ]/g, "").slice(0, 32);
}

export function moneyFromMinor(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

export function maskMoney(value: string) {
  const digits = onlyDigits(value).slice(0, 12);
  if (!digits) {
    return "";
  }
  const minor = Number(digits);
  return (minor / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moneyToMinor(value: string) {
  const digits = onlyDigits(value);
  if (!digits) {
    return 0;
  }
  return Number(digits);
}