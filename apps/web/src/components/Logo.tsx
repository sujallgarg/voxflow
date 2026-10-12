import React from "react";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 32,
  showWordmark = true,
  className = ""
}) => {
  return (
    <div
      className={`logo-wrapper ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        userSelect: "none"
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          background: "linear-gradient(135deg, #7e14ff 0%, #a855f7 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(126, 20, 255, 0.28)",
          flexShrink: 0,
          position: "relative",
          overflow: "hidden"
        }}
        aria-hidden="true"
      >
        <svg
          width={Math.round(size * 0.65)}
          height={Math.round(size * 0.65)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylized 'V' waveform mark */}
          <path
            d="M4 6L10.5 19C10.9 19.8 12.1 19.8 12.5 19L20 4"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 9L15 15"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            fontSize: `${size * 0.65}px`,
            letterSpacing: "-0.03em",
            color: "#0f172a",
            display: "flex",
            alignItems: "center",
            gap: "2px"
          }}
        >
          Vox<span style={{ color: "#7e14ff" }}>Flow</span>
        </span>
      )}
    </div>
  );
};
