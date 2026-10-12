export const COUNTRIES = [
  { code: "BR", name: "Brasil" },
  { code: "US", name: "United States" },
  { code: "PT", name: "Portugal" },
  { code: "ES", name: "España" },
  { code: "DE", name: "Deutschland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "México" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "UY", name: "Uruguay" },
  { code: "PE", name: "Perú" },
  { code: "IE", name: "Ireland" },
  { code: "NL", name: "Nederland" },
  { code: "IT", name: "Italia" },
  { code: "AU", name: "Australia" },
] as const;

export const STRIPE_CURRENCIES = ["USD", "EUR"] as const;

export function gatewayForCountry(country: string): "ASAAS" | "STRIPE" {
  return country === "BR" ? "ASAAS" : "STRIPE";
}

export function currencyForCountry(country: string, requested?: string) {
  if (country === "BR") {
    return "BRL";
  }
  if (requested === "EUR") {
    return "EUR";
  }
  return "USD";
}
