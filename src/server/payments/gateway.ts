import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env as processEnv } from "node:process";
import Stripe from "stripe";

import { createAsaasAdapter } from "@/server/payments/asaas-adapter";
import { createStripeAdapter } from "@/server/payments/stripe-adapter";
import type { GatewayName, PaymentGateway } from "@/server/payments/types";

function envValue(name: string) {
  const value = processEnv[name]?.trim();
  return value ? value : undefined;
}

function stripeSecretKey() {
  const raw = envValue("STRIPE_SECRET_KEY") ?? "";
  return raw.match(/sk_(?:live|test)_[A-Za-z0-9]+/)?.[0];
}

function stripeWebhookSecret() {
  const raw = envValue("STRIPE_WEBHOOK_SECRET") ?? "";
  return raw.match(/whsec_[A-Za-z0-9]+/)?.[0] ?? "";
}

function dotenvValue(name: string) {
  try {
    const text = readFileSync(join(process.cwd(), ".env"), "utf8");
    const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
    if (!line) {
      return undefined;
    }
    let value = line.slice(name.length + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    return value.trim() || undefined;
  } catch {
    return undefined;
  }
}

function asaasApiKey() {
  const raw = envValue("ASAAS_API_KEY") ?? dotenvValue("ASAAS_API_KEY") ?? "";
  if (raw.startsWith("$aact_")) {
    return raw;
  }
  if (raw.startsWith("aact_")) {
    return `$${raw}`;
  }
  const fromFile = dotenvValue("ASAAS_API_KEY") ?? "";
  if (fromFile.startsWith("$aact_")) {
    return fromFile;
  }
  if (fromFile.startsWith("aact_")) {
    return `$${fromFile}`;
  }
  return raw || undefined;
}

export function isGatewayConfigured(gateway: GatewayName) {
  if (gateway === "STRIPE") {
    return Boolean(stripeSecretKey());
  }
  if (gateway === "ASAAS") {
    return Boolean(asaasApiKey() && envValue("ASAAS_WEBHOOK_TOKEN"));
  }
  const exhaustive: never = gateway;
  return exhaustive;
}

export function getGateway(gateway: GatewayName): PaymentGateway {
  if (gateway === "STRIPE") {
    const key = stripeSecretKey();
    if (!key) {
      throw new Error("GATEWAY_NOT_CONFIGURED");
    }
    return createStripeAdapter(new Stripe(key), stripeWebhookSecret());
  }
  if (gateway === "ASAAS") {
    const apiKey = asaasApiKey();
    const webhookToken = envValue("ASAAS_WEBHOOK_TOKEN");
    if (!apiKey || !webhookToken) {
      throw new Error("GATEWAY_NOT_CONFIGURED");
    }
    return createAsaasAdapter({
      apiKey,
      webhookToken,
      baseUrl: envValue("ASAAS_API_URL") ?? "https://api-sandbox.asaas.com/v3",
    });
  }
  const exhaustive: never = gateway;
  return exhaustive;
}
