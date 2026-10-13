export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function checksum(base: string, factors: number[]) {
  const total = factors.reduce((sum, factor, index) => sum + Number(base[index]) * factor, 0);
  const rest = total % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
    return false;
  }
  const first = checksum(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checksum(digits.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[9]) && second === Number(digits[10]);
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) {
    return false;
  }
  const first = checksum(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checksum(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

export function isValidBrazilianTaxId(value: string) {
  return isValidCpf(value) || isValidCnpj(value);
}
