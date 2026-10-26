import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/authContext";

interface UsageAddonSliderProps {
  onSuccess?: () => void;
  currentPlanName?: string;
  renewalDate?: string | null;
  isPro?: boolean;
}

export const UsageAddonSlider: React.FC<UsageAddonSliderProps> = ({
  onSuccess: _onSuccess,
  currentPlanName = "Pro",
  renewalDate,
  isPro = true
}) => {
  const { user } = useAuth();
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const [quote, setQuote] = useState<{
    pack: { id: string; minutes: number; priceUsd: number; priceCents: number; proposed: boolean; label: string };
    priceUsd: number;
    minutes: number;
    currentPlan: string;
    renewalDate: string | null;
    oneTimePurchase: boolean;
    proposed: boolean;
  } | null>(null);
  const [loadingQuote, setLoadingQuote] = useState<boolean>(true);
  const [purchasing, setPurchasing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch server-calculated quote whenever sliderIndex changes
  useEffect(() => {
    let isCancelled = false;
    const fetchQuote = async () => {
      try {
        setLoadingQuote(true);
        setError(null);
        const res = await api.getAddonQuote(undefined, sliderIndex, user?.id);
        if (!isCancelled) {
          setQuote(res);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || "Failed to calculate add-on quote.");
        }
      } finally {
        if (!isCancelled) {
          setLoadingQuote(false);
        }
      }
    };

    void fetchQuote();
    return () => {
      isCancelled = true;
    };
  }, [sliderIndex, user?.id]);

  const handleCheckout = async () => {
    if (!user) {
      window.location.hash = "#/login?returnTo=" + encodeURIComponent("#/billing");
      return;
    }
    if (!isPro) {
      setError("Usage add-on packs are available exclusively to active Pro subscribers.");
      return;
    }
    if (!quote?.pack?.id) return;
    if (purchasing) return;

    try {
      setPurchasing(true);
      setError(null);
      const res = await api.createCheckoutSession("premium_monthly", user.id, "topup", quote.pack.id);
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to initiate top-up checkout. Please try again.");
      setPurchasing(false);
    }
  };

  const steps = [
    { label: "60 min", minutes: 60, price: "$2" },
    { label: "150 min", minutes: 150, price: "$4" },
    { label: "300 min", minutes: 300, price: "$7" }
  ];

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e5e5",
        borderRadius: "8px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}
    >
      {/* Title & Badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#666666",
              display: "block",
              marginBottom: "4px"
            }}
          >
            Transcription Top-Up
          </span>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111111", margin: 0 }}>
            Usage Add-on Slider
          </h3>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "12px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: "#111111",
              color: "#ffffff"
            }}
          >
            One-Time Purchase
          </span>
          {quote?.proposed && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "12px",
                fontSize: "0.6875rem",
                fontWeight: 600,
                background: "#fef3c7",
                color: "#92400e",
                border: "1px solid #fde68a"
              }}
            >
              Proposed Pricing
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: "0.875rem", color: "#666666", margin: 0, lineHeight: 1.5 }}>
        Need more transcription capacity before your monthly renewal? Slide to choose additional minutes.
        Top-up credits are consumed only after your included monthly allowance is exhausted, and roll over across monthly renewals.
      </p>

      {/* Discrete Slider Control */}
      <div style={{ padding: "10px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.8125rem", fontWeight: 600, color: "#111111" }}>
          <span>Select Add-on Pack:</span>
          <span>{steps[sliderIndex].label} ({steps[sliderIndex].price})</span>
        </div>

        <input
          type="range"
          min="0"
          max="2"
          step="1"
          value={sliderIndex}
          onChange={(e) => setSliderIndex(parseInt(e.target.value, 10))}
          disabled={purchasing}
          aria-label="Usage Add-on Quantity Slider"
          style={{
            width: "100%",
            height: "6px",
            background: "#e5e5e5",
            borderRadius: "3px",
            outline: "none",
            accentColor: "#111111",
            cursor: purchasing ? "wait" : "pointer"
          }}
        />

        {/* Step Ticks */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
          {steps.map((step, idx) => (
            <button
              key={step.minutes}
              type="button"
              onClick={() => setSliderIndex(idx)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                textAlign: idx === 0 ? "left" : idx === 2 ? "right" : "center",
                color: sliderIndex === idx ? "#111111" : "#888888",
                fontWeight: sliderIndex === idx ? 700 : 500,
                fontSize: "0.8125rem"
              }}
            >
              <div>{step.label}</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.85 }}>{step.price}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Server-Calculated Quote Box */}
      <div
        style={{
          background: "#fafafa",
          border: "1px solid #eeeeee",
          borderRadius: "6px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "0.875rem", color: "#666666" }}>Additional Minutes:</span>
          <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111111" }}>
            {loadingQuote ? "..." : `+${quote?.minutes || steps[sliderIndex].minutes} Minutes`}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "0.875rem", color: "#666666" }}>Total Price:</span>
          <span style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111111" }}>
            {loadingQuote ? "..." : `$${quote?.priceUsd || steps[sliderIndex].price.replace("$", "")}.00 USD`}
          </span>
        </div>

        <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: "10px", fontSize: "0.8125rem", color: "#666666" }}>
          <div>
            Account Plan: <strong>{currentPlanName}</strong>
          </div>
          {renewalDate && (
            <div style={{ marginTop: "3px" }}>
              Current Subscription Renewal: <strong>{new Date(renewalDate).toLocaleDateString()}</strong>
            </div>
          )}
          <div style={{ marginTop: "6px", color: "#111111", fontWeight: 500 }}>
            Summary: 1-time charge of ${quote?.priceUsd || 2} USD for +{quote?.minutes || 60} transcription minutes. No recurring charge.
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#991b1b",
            fontSize: "0.8125rem"
          }}
        >
          {error}
        </div>
      )}

      {/* Checkout Action */}
      <button
        type="button"
        className="btn-primary"
        onClick={handleCheckout}
        disabled={loadingQuote || purchasing || !isPro}
        style={{
          width: "100%",
          padding: "12px",
          fontSize: "0.9375rem",
          fontWeight: 600,
          opacity: loadingQuote || purchasing || !isPro ? 0.6 : 1,
          cursor: loadingQuote || purchasing ? "wait" : !isPro ? "not-allowed" : "pointer"
        }}
      >
        {purchasing
          ? "Connecting to Checkout..."
          : loadingQuote
            ? "Calculating Quote..."
            : !isPro
              ? "Pro Subscription Required for Top-ups"
              : `Purchase +${quote?.minutes || steps[sliderIndex].minutes} Minutes — $${quote?.priceUsd || 2} USD`}
      </button>
    </div>
  );
};
