import DodoPayments from "dodopayments";
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
import { PLAN_CONFIGS } from "@voxflow/shared";

export class DodoPaymentAdapter implements IPaymentGatewayAdapter {
  readonly providerName = "dodo";
  private client: DodoPayments | null = null;
  private webhookKey: string;
  private productId: string;
  private environment: "test_mode" | "live_mode";

  constructor(options?: {
    apiKey?: string;
    webhookKey?: string;
    productId?: string;
    environment?: "test_mode" | "live_mode";
  }) {
    const rawApiKey = options?.apiKey || process.env.DODO_PAYMENTS_API_KEY || "";
    const rawWebhookKey = options?.webhookKey || process.env.DODO_PAYMENTS_WEBHOOK_KEY || "";
    const rawProductId = options?.productId || process.env.DODO_PAYMENTS_PRODUCT_ID || "";

    const apiKey = rawApiKey.split(/[\s#]/)[0].trim();
    this.webhookKey = rawWebhookKey.split(/[\s#]/)[0].trim();
    this.productId = rawProductId.split(/[\s#]/)[0].trim();
    this.environment =
      options?.environment ||
      (process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode");

    if (apiKey) {
      this.client = new DodoPayments({
        bearerToken: apiKey,
        webhookKey: this.webhookKey || undefined,
        environment: this.environment
      });
    }
  }

  private ensureClient(): DodoPayments {
    if (!this.client) {
      throw new Error(
        "Dodo Payments is not configured. Missing DODO_PAYMENTS_API_KEY in environment variables."
      );
    }
    return this.client;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
    const client = this.ensureClient();
    const plan = PLAN_CONFIGS[params.planId];
    if (!plan || plan.id === "free") {
      throw new Error(`Cannot create checkout session for free plan or invalid plan: ${params.planId}`);
    }

    const productId = this.productId || "pdt_premium_monthly";

    const session = await client.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1
        }
      ],
      customer: {
        email: params.email,
        name: params.userId
      },
      return_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        userId: params.userId,
        planId: params.planId,
        ...(params.metadata || {})
      }
    });

    if (!session.checkout_url) {
      throw new Error("Dodo Payments did not return a checkout session redirect URL.");
    }

    return {
      sessionId: session.session_id,
      checkoutUrl: session.checkout_url,
      customerId: ""
    };
  }

  async createCustomerPortalSession(params: CreateCustomerPortalParams): Promise<CustomerPortalResult> {
    const client = this.ensureClient();
    if (!params.customerId) {
      throw new Error("Missing customerId for customer billing portal.");
    }

    const portal = await client.customers.customerPortal.create(params.customerId, {
      return_url: params.returnUrl
    });

    if (!portal.link) {
      throw new Error("Dodo Payments did not return a customer portal link.");
    }

    return {
      portalUrl: portal.link
    };
  }

  constructWebhookEvent(
    rawBody: string | Buffer,
    signatureHeader?: string,
    headers?: Record<string, string | string[] | undefined>
  ): WebhookEventPayload {
    const client = this.ensureClient();
    if (!this.webhookKey) {
      throw new Error("Dodo webhook key is not configured. Missing DODO_PAYMENTS_WEBHOOK_KEY.");
    }

    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");

    // Standard Webhooks expects lower-case headers: webhook-id, webhook-signature, webhook-timestamp
    const headerMap: Record<string, string> = {};
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          headerMap[k.toLowerCase()] = v;
        } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") {
          headerMap[k.toLowerCase()] = v[0];
        }
      }
    }

    if (!headerMap["webhook-signature"] && signatureHeader) {
      headerMap["webhook-signature"] = signatureHeader;
    }

    const unwrapResult = client.webhooks.unwrap(bodyStr, {
      headers: headerMap,
      key: this.webhookKey
    });

    const eventId =
      headerMap["webhook-id"] ||
      (unwrapResult as any).id ||
      (unwrapResult as any).data?.payment_id ||
      (unwrapResult as any).data?.subscription_id ||
      `evt_${Date.now()}`;

    const timestampSec = headerMap["webhook-timestamp"]
      ? parseInt(headerMap["webhook-timestamp"], 10)
      : Math.floor(Date.now() / 1000);

    return {
      id: eventId,
      type: unwrapResult.type,
      created: timestampSec,
      data: {
        object: unwrapResult.data
      }
    };
  }

  async getAuthoritativeSubscription(subscriptionId: string): Promise<AuthoritativeSubscription | null> {
    const client = this.ensureClient();
    try {
      const sub = await client.subscriptions.retrieve(subscriptionId);
      return this.mapDodoSubscription(sub);
    } catch (err: any) {
      if (err.status === 404 || err.statusCode === 404) return null;
      throw err;
    }
  }

  async cancelSubscription(subscriptionId: string, atPeriodEnd = true): Promise<AuthoritativeSubscription> {
    const client = this.ensureClient();
    const updatedSub = await client.subscriptions.update(subscriptionId, {
      cancel_at_next_billing_date: atPeriodEnd,
      cancel_reason: "cancelled_by_customer"
    });

    return this.mapDodoSubscription(updatedSub);
  }

  async findUserSubscription(userId: string, sessionId?: string): Promise<AuthoritativeSubscription | null> {
    const client = this.ensureClient();

    // 1. If sessionId provided, verify ownership and payment status
    if (sessionId) {
      try {
        const session = await client.checkoutSessions.retrieve(sessionId);
        const paymentId = session.payment_id;
        if (paymentId) {
          const payment = await client.payments.retrieve(paymentId);
          const owner = payment.metadata?.userId || payment.customer?.name;
          if (owner === userId && payment.status === "succeeded" && payment.subscription_id) {
            const sub = await client.subscriptions.retrieve(payment.subscription_id);
            return this.mapDodoSubscription(sub);
          }
        }
      } catch (err: any) {
        // Fall through to subscription search
      }
    }

    // 2. Search recent subscriptions for matching authenticated user
    try {
      const list = await client.subscriptions.list({ page_size: 20 });
      for (const sub of (list.items || [])) {
        const owner = sub.metadata?.userId || sub.customer?.name;
        if (owner === userId && (sub.status === "active" || sub.status === "on_hold" || sub.status === "pending")) {
          return this.mapDodoSubscription(sub);
        }
      }
    } catch (err: any) {
      // Ignore list error
    }

    return null;
  }

  async updateSubscriptionPeriod(subscriptionId: string, nextBillingDate: string): Promise<boolean> {
    const client = this.ensureClient();
    try {
      await client.subscriptions.update(subscriptionId, {
        next_billing_date: nextBillingDate
      });
      return true;
    } catch (err: any) {
      console.warn("Dodo subscription next_billing_date update notice:", err?.message);
      return false;
    }
  }

  private mapDodoSubscription(sub: any): AuthoritativeSubscription {
    const userId = (sub.metadata?.userId as string) || "";
    const planId: PlanId = (sub.metadata?.planId as PlanId) || "premium_monthly";

    let status: SubscriptionStatus = "active";
    if (sub.status === "active") {
      status = sub.cancel_at_next_billing_date ? "cancel_at_period_end" : "active";
    } else if (sub.status === "cancelled") {
      status = "canceled";
    } else if (sub.status === "expired") {
      status = "expired";
    } else if (sub.status === "on_hold" || sub.status === "paused" || sub.status === "failed") {
      status = "past_due";
    } else if (sub.status === "pending") {
      status = "incomplete";
    }

    const now = new Date();
    const currentPeriodStart = sub.previous_billing_date
      ? new Date(sub.previous_billing_date).toISOString()
      : now.toISOString();
    const currentPeriodEnd = sub.next_billing_date
      ? new Date(sub.next_billing_date).toISOString()
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    return {
      subscriptionId: sub.subscription_id,
      customerId: sub.customer?.customer_id || "",
      userId,
      status,
      planId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: !!sub.cancel_at_next_billing_date,
      canceledAt:
        sub.cancel_at_next_billing_date || sub.status === "cancelled"
          ? new Date().toISOString()
          : null
    };
  }
}
