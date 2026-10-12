import "server-only";

import Stripe from "stripe";

import { createAsaasAdapter } from "@/server/payments/asaas-adapter";
import { createStripeAdapter } from "@/server/payments/stripe-adapter";
import type { GatewayName, PaymentGateway } from "@/server/payments/types";

export function getGateway(gateway: GatewayName): PaymentGateway {
  if (gateway === "STRIPE") {
    const key = process.env.STRIPE_SECRET_KEY;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!key || !secret) {
      throw new Error("GATEWAY_NOT_CONFIGURED");
    }
    return createStripeAdapter(new Stripe(key), secret);
  }
  if (gateway === "ASAAS") {
    const apiKey = process.env.ASAAS_API_KEY;
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!apiKey || !webhookToken) {
      throw new Error("GATEWAY_NOT_CONFIGURED");
    }
    return createAsaasAdapter({
      apiKey,
      webhookToken,
      baseUrl: process.env.ASAAS_API_URL ?? "https://api-sandbox.asaas.com/v3",
    });
  }
  const exhaustive: never = gateway;
  return exhaustive;
}
