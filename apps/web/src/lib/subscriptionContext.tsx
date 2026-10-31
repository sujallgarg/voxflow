import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useAuth } from "./authContext";
import type { UserEntitlements, UserSubscription } from "@voxflow/shared";

export interface SubscriptionContextType {
  entitlements: UserEntitlements | null;
  subscription: UserSubscription | null;
  isPremium: boolean;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSubscription = useCallback(async () => {
    // Unauthenticated visitors do not have subscriptions; avoid triggering 401 on protected backend
    if (!user?.id) {
      setEntitlements(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getSubscription(user.id);
      setEntitlements(res.entitlements || null);
      setSubscription(res.subscription || null);
    } catch (err) {
      console.warn("Could not fetch authoritative subscription:", err);
      // Fallback safely to non-premium free state on network or server error
      setEntitlements(null);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load and whenever user / userId changes (e.g. login, session restore)
  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  // Listen for global subscription refresh events (e.g. after webhook confirmation, checkout completion, or cancellation)
  useEffect(() => {
    const handleSubscriptionRefresh = () => {
      void fetchSubscription();
    };

    window.addEventListener("voxflow_subscription_updated", handleSubscriptionRefresh);
    window.addEventListener("voxflow_user_changed", handleSubscriptionRefresh);

    return () => {
      window.removeEventListener("voxflow_subscription_updated", handleSubscriptionRefresh);
      window.removeEventListener("voxflow_user_changed", handleSubscriptionRefresh);
    };
  }, [fetchSubscription]);

  const value = {
    entitlements,
    subscription,
    isPremium: Boolean(entitlements?.isPremium),
    loading,
    refreshSubscription: fetchSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
};

/**
 * Global helper to notify all subscribed components to re-verify entitlements with server
 */
export function notifySubscriptionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("voxflow_subscription_updated"));
  }
}
