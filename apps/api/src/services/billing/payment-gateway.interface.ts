import type {
  CreateCheckoutParams,
  CheckoutSessionResult,
  CreateCustomerPortalParams,
  CustomerPortalResult,
  WebhookEventPayload,
  AuthoritativeSubscription
} from "./billing.types.js";

export interface IPaymentGatewayAdapter {
  readonly providerName: string;

  /**
   * Create a secure, provider-hosted checkout session for the user.
   */
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult>;

  /**
   * Create a customer billing portal session for managing payment methods or cancellations.
   */
  createCustomerPortalSession(params: CreateCustomerPortalParams): Promise<CustomerPortalResult>;

  constructWebhookEvent(
    rawBody: string | Buffer,
    signatureHeader?: string,
    headers?: Record<string, string | string[] | undefined>
  ): WebhookEventPayload;

  /**
   * Retrieve authoritative subscription details directly from the provider.
   */
  getAuthoritativeSubscription(subscriptionId: string): Promise<AuthoritativeSubscription | null>;

  /**
   * Request subscription cancellation at period end or immediately.
   */
  cancelSubscription(subscriptionId: string, atPeriodEnd?: boolean): Promise<AuthoritativeSubscription>;

  /**
   * Look up any active subscription or recent checkout for a user directly from the provider.
   */
  findUserSubscription?(userId: string, sessionId?: string): Promise<AuthoritativeSubscription | null>;

  /**
   * Push next billing date to provider to extend subscription period and prevent duplicate recurring charges.
   */
  updateSubscriptionPeriod?(subscriptionId: string, nextBillingDate: string): Promise<boolean>;
}
