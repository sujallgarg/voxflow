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
          borderRadius: "7px",
          background: "#111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          position: "relative"
        }}
        aria-hidden="true"
      >
        <svg
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Stylized 'V' waveform mark in clean white */}
          <path
            d="M4 6L10.5 19C10.9 19.8 12.1 19.8 12.5 19L20 4"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 9L15 15"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      </div>

      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: `${size * 0.62}px`,
            letterSpacing: "-0.03em",
            color: "#111111",
            display: "flex",
            alignItems: "center"
          }}
        >
          VoxFlow
        </span>
      )}
    </div>
  );
};
