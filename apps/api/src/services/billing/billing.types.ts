import type { PlanId, SubscriptionStatus, UserSubscription, BillingInvoice } from "@voxflow/shared";

export interface CreateCheckoutParams {
  userId: string;
  email: string;
  planId: PlanId;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  customerId: string;
}

export interface CreateCustomerPortalParams {
  customerId: string;
  returnUrl: string;
}

export interface CustomerPortalResult {
  portalUrl: string;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  created: number; // Unix timestamp
  data: {
    object: any;
  };
}

export interface AuthoritativeSubscription {
  subscriptionId: string;
  customerId: string;
  userId: string;
  status: SubscriptionStatus;
  planId: PlanId;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}
