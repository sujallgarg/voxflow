import crypto from "crypto";
import { Webhook } from "standardwebhooks";
import type { IPaymentGatewayAdapter } from "./payment-gateway.interface.js";
import type {
  CreateCheckoutParams,
  CheckoutSessionResult,
  CreateCustomerPortalParams,
  CustomerPortalResult,
  WebhookEventPayload,
  AuthoritativeSubscription
} from "./billing.types.js";
import type { SubscriptionStatus, PlanId } from "@voxflow/shared";

export class MockPaymentAdapter implements IPaymentGatewayAdapter {
  readonly providerName = "mock";
  private webhookSecret: string;
  private subscriptions: Map<string, AuthoritativeSubscription> = new Map();
  private processedCheckoutSessions: Map<string, CheckoutSessionResult> = new Map();

  constructor(webhookSecret = "whsec_mock_test_secret_1234567890abcdef") {
    this.webhookSecret = webhookSecret;
  }

  setWebhookSecret(secret: string) {
    this.webhookSecret = secret;
  }

  private getStandardWebhookSecret(): string {
    if (this.webhookSecret.startsWith("whsec_")) {
      const rest = this.webhookSecret.slice(6);
      if (/^[A-Za-z0-9+/=]+$/.test(rest)) {
        return this.webhookSecret;
      }
    }
    return `whsec_${Buffer.from(this.webhookSecret).toString("base64")}`;
  }

  createSignedDodoWebhookHeaders(
    payload: string,
    eventId = `msg_${Date.now()}`,
    date = new Date()
  ): Record<string, string> {
    const wh = new Webhook(this.getStandardWebhookSecret());
    const signature = wh.sign(eventId, date, payload);
    return {
      "webhook-id": eventId,
      "webhook-timestamp": Math.floor(date.getTime() / 1000).toString(),
      "webhook-signature": signature
    };
  }

  createSignedWebhookHeader(payload: string, timestampSeconds = Math.floor(Date.now() / 1000)): string {
    const signature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestampSeconds}.${payload}`)
      .digest("hex");
    return `t=${timestampSeconds},v1=${signature}`;
  }

  setMockSubscription(sub: AuthoritativeSubscription) {
    this.subscriptions.set(sub.subscriptionId, sub);
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    if (params.idempotencyKey && this.processedCheckoutSessions.has(params.idempotencyKey)) {
      return this.processedCheckoutSessions.get(params.idempotencyKey)!;
    }

    const sessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const customerId = `cus_mock_${params.userId}`;

    // Seed authoritative subscription for testing
    const now = new Date();
    const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.subscriptions.set(`sub_mock_${sessionId}`, {
      subscriptionId: `sub_mock_${sessionId}`,
      customerId,
      userId: params.userId,
      status: "active",
      planId: params.planId,
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: oneMonthAhead.toISOString(),
      cancelAtPeriodEnd: false,
      canceledAt: null
    });

    const result: CheckoutSessionResult = {
      sessionId,
      checkoutUrl: params.successUrl
        ? params.successUrl.replace("{CHECKOUT_SESSION_ID}", sessionId)
        : `https://checkout.voxflow.test/c/${sessionId}`,
      customerId
    };

    if (params.idempotencyKey) {
      this.processedCheckoutSessions.set(params.idempotencyKey, result);
    }

    return result;
  }

  async createCustomerPortalSession(params: CreateCustomerPortalParams): Promise<CustomerPortalResult> {
    return {
      portalUrl: `https://billing.voxflow.test/portal/${params.customerId}?return=${encodeURIComponent(params.returnUrl)}`
    };
  }

  constructWebhookEvent(
    rawBody: string | Buffer,
    signatureHeader?: string,
    headers?: Record<string, string | string[] | undefined>
  ): WebhookEventPayload {
    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");

    // 1. If Standard Webhooks headers (webhook-id / webhook-signature) are provided
    const headerMap: Record<string, string> = {};
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") headerMap[k.toLowerCase()] = v;
        else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
          headerMap[k.toLowerCase()] = v[0];
        }
      }
    }
    if (!headerMap["webhook-signature"] && signatureHeader) {
      headerMap["webhook-signature"] = signatureHeader;
    }

    if (headerMap["webhook-signature"] && (headerMap["webhook-id"] || headerMap["webhook-timestamp"])) {
      const wh = new Webhook(this.getStandardWebhookSecret());
      wh.verify(bodyStr, headerMap);
      const parsed = JSON.parse(bodyStr);
      const eventId = headerMap["webhook-id"] || parsed.id || `msg_${Date.now()}`;
      const created = headerMap["webhook-timestamp"]
        ? parseInt(headerMap["webhook-timestamp"], 10)
        : Math.floor(Date.now() / 1000);
      return {
        id: eventId,
        type: parsed.type || "subscription.active",
        created,
        data: parsed.data ? { object: parsed.data } : { object: parsed }
      };
    }

    if (!signatureHeader) {
      throw new Error("Missing mock-signature header");
    }

    const parts = signatureHeader.split(",");
    const tPart = parts.find((p) => p.startsWith("t="));
    const vPart = parts.find((p) => p.startsWith("v1="));

    if (!tPart || !vPart) {
      throw new Error("Malformed signature header");
    }

    const timestamp = parseInt(tPart.slice(2), 10);
    const signature = vPart.slice(3);

    // Replay check: reject events older than 300 seconds
    const currentUnix = Math.floor(Date.now() / 1000);
    if (Math.abs(currentUnix - timestamp) > 300) {
      throw new Error("Webhook signature timestamp expired (replay attack protection)");
    }

    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.${bodyStr}`)
      .digest("hex");

    const providedBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expected);

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new Error("Invalid webhook signature HMAC");
    }

    const parsed = JSON.parse(bodyStr);
    return {
      id: parsed.id || `evt_${Date.now()}`,
      type: parsed.type || "subscription.active",
      created: parsed.created || timestamp,
      data: parsed.data ? { object: parsed.data } : { object: parsed }
    };
  }

  async getAuthoritativeSubscription(subscriptionId: string): Promise<AuthoritativeSubscription | null> {
    return this.subscriptions.get(subscriptionId) || null;
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd = true): Promise<AuthoritativeSubscription> {
    const existing = this.subscriptions.get(subscriptionId);
    if (!existing) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const updated: AuthoritativeSubscription = {
      ...existing,
      status: atPeriodEnd ? "cancel_at_period_end" : "canceled",
      cancelAtPeriodEnd: atPeriodEnd,
      canceledAt: new Date().toISOString()
    };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  async findUserSubscription(userId: string, _sessionId?: string): Promise<AuthoritativeSubscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId && (sub.status === "active" || sub.status === "cancel_at_period_end")) {
        return sub;
      }
    }
    return null;
  }

  async updateSubscriptionPeriod(subscriptionId: string, nextBillingDate: string): Promise<boolean> {
    const existing = this.subscriptions.get(subscriptionId);
    if (existing) {
      existing.currentPeriodEnd = nextBillingDate;
      return true;
    }
    return false;
  }
}
