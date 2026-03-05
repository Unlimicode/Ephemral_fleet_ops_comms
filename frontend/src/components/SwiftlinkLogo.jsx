export default function SwiftlinkLogo({ height = 80 }) {
  return (
    <>
      <style>{`
        .logo-tile {
          transform-origin: 50px 50px;
          animation: tileEntrance 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        @keyframes tileEntrance {
          from { opacity: 0; transform: scale(0.3) rotate(-10deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .logo-path {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: drawPath 0.8s ease forwards;
          animation-delay: 0.5s;
        }
        @keyframes drawPath {
          to { stroke-dashoffset: 0; }
        }

        .logo-arrow-top {
          opacity: 0;
          animation: arrowFadeIn 0.4s ease forwards;
          animation-delay: 0.9s;
        }

        .logo-arrow-bottom {
          opacity: 0;
          animation: arrowFadeIn 0.4s ease forwards;
          animation-delay: 1.1s;
        }

        @keyframes arrowFadeIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }

        .logo-wordmark {
          animation: wordmarkEntrance 0.5s ease forwards;
          animation-delay: 1.2s;
          opacity: 0;
        }
        @keyframes wordmarkEntrance {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .logo-glow-pulse {
          animation: glowPulse 3s ease-in-out infinite;
          animation-delay: 1.5s;
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(108,99,255,0.4)); }
          50% { filter: drop-shadow(0 0 20px rgba(0,212,255,0.6)); }
        }

        .logo-cyan-glow {
          animation: cyanGlowPulse 3s ease-in-out infinite;
          animation-delay: 1.5s;
        }
        @keyframes cyanGlowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.9; }
        }
      `}</style>

      <svg
        width={height * 3.4}
        height={height}
        viewBox="0 0 340 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Tile gradient: violet to cyan */}
          <linearGradient id="tileGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>

          {/* Cyan glow radial — bleeds from left edge */}
          <radialGradient id="cyanGlow" cx="0.1" cy="0.5" r="0.7" fx="0.05" fy="0.5">
            <stop offset="0%" stopColor="rgba(0,212,255,0.5)" />
            <stop offset="60%" stopColor="rgba(0,212,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,212,255,0)" />
          </radialGradient>

          {/* Glass glow filter */}
          <filter id="glassGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Neon glow for arrows */}
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop shadow for tile */}
          <filter id="tileShadow" x="-20%" y="-10%" width="140%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.2)" />
          </filter>
        </defs>

        {/* ── Tile ── */}
        {/* Drop shadow layer */}
        <rect
          className="logo-tile"
          x="10" y="10" width="80" height="80" rx="16"
          fill="url(#tileGradient)"
          filter="url(#tileShadow)"
        />

        {/* Cyan glow bleed — left side */}
        <ellipse
          className="logo-tile logo-cyan-glow"
          cx="12" cy="50" rx="28" ry="38"
          fill="url(#cyanGlow)"
          style={{ pointerEvents: 'none' }}
        />

        {/* White inner border */}
        <rect
          className="logo-tile"
          x="10" y="10" width="80" height="80" rx="16"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.5"
        />

        {/* ── S curve — white/light-blue stroke ── */}
        <path
          className="logo-path"
          d="M 62 30 C 62 30, 55 26, 45 28 C 35 30, 28 38, 30 46 C 32 54, 42 56, 50 54 C 58 52, 65 56, 67 62 C 69 68, 62 74, 55 74 C 48 74, 38 72, 38 72"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* ── Top-right arrow — solid filled green triangle pointing right ── */}
        <polygon
          className="logo-arrow-top"
          points="60,24 74,32 60,40"
          fill="#00F5A0"
          filter="url(#neonGlow)"
          style={{ transformOrigin: '65px 32px' }}
        />

        {/* ── Bottom-left arrow — solid filled green triangle pointing left ── */}
        <polygon
          className="logo-arrow-bottom"
          points="40,62 26,70 40,78"
          fill="#00F5A0"
          filter="url(#neonGlow)"
          style={{ transformOrigin: '35px 70px' }}
        />

        {/* ── Wordmark ── */}
        <text
          className="logo-wordmark"
          x="110" y="62"
          fontFamily="Inter, sans-serif"
          fontWeight="700"
          fontSize="32"
          fill="#F0F2F7"
        >
          Swiftlink
        </text>
      </svg>
    </>
  );
}
