import React, { useState } from 'react';

export default function ImageCard({ src, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="gen-image-card">
      <div className="gen-image-header">
        <span className="gen-image-badge">
          <span className="gen-sparkle">✦</span> Gemini Vision
        </span>
        <a href={src} target="_blank" rel="noopener noreferrer" className="gen-image-open">
          Full Res ↗
        </a>
      </div>

      <div className={`gen-image-viewport ${!loaded ? 'loading' : 'ready'}`}>
        {!loaded && !error && (
          <div className="gen-shimmer-wrapper">
            <div className="gen-shimmer-beam" />
            <div className="gen-shimmer-text">
              <span className="gen-pulse-dot" />
              <span>Synthesizing pixels…</span>
            </div>
          </div>
        )}

        <img
          src={src}
          alt={alt || 'Generated asset'}
          className={`gen-img ${loaded ? 'visible' : 'hidden'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />

        {error && (
          <div className="gen-error-box">
            <span>Image render failed.</span>
            <a href={src} target="_blank" rel="noreferrer">Open direct link</a>
          </div>
        )}
      </div>

      {alt && (
        <div className="gen-image-caption">
          <span className="gen-caption-tag">Prompt:</span>
          <span className="gen-caption-text">{alt}</span>
        </div>
      )}

      <style>{`
        .gen-image-card {
          width: 100%;
          max-width: 420px;
          margin: 14px 0;
          border-radius: 16px;
          overflow: hidden;
          background: var(--bg-surface, #141416);
          border: 1px solid var(--border-light, rgba(255, 255, 255, 0.1));
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.45);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
          display: flex;
          flex-direction: column;
        }
        .gen-image-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 35px -5px rgba(0, 0, 0, 0.6);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .gen-image-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--border-light, rgba(255, 255, 255, 0.07));
          font-size: 12px;
        }
        .gen-image-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary, #a1a1aa);
          font-weight: 500;
          letter-spacing: 0.02em;
        }
        .gen-sparkle {
          color: #a855f7;
          font-size: 13px;
          animation: sparkleSpin 3s linear infinite;
        }
        .gen-image-open {
          color: var(--text-tertiary, #71717a);
          text-decoration: none;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          transition: all 0.2s;
        }
        .gen-image-open:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.12);
        }
        .gen-image-viewport {
          position: relative;
          width: 100%;
          height: 250px;
          max-height: 260px;
          background: #09090b;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gen-shimmer-wrapper {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
          z-index: 2;
        }
        .gen-shimmer-beam {
          position: absolute;
          top: 0; left: -100%; width: 200%; height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(168, 85, 247, 0.08) 35%,
            rgba(255, 255, 255, 0.15) 50%,
            rgba(168, 85, 247, 0.08) 65%,
            transparent 100%
          );
          animation: shimmerSweep 2.2s infinite ease-in-out;
        }
        .gen-shimmer-text {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-tertiary, #a1a1aa);
          font-size: 13px;
          z-index: 3;
          font-weight: 500;
        }
        .gen-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #a855f7;
          animation: dotPulse 1.4s infinite ease-in-out;
        }
        .gen-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s ease;
        }
        .gen-img.hidden {
          opacity: 0;
          transform: scale(1.04);
        }
        .gen-img.visible {
          opacity: 1;
          transform: scale(1);
        }
        .gen-image-caption {
          padding: 10px 14px;
          background: var(--bg-surface, #141416);
          border-top: 1px solid var(--border-light, rgba(255, 255, 255, 0.05));
          font-size: 12px;
          line-height: 1.4;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .gen-caption-tag {
          color: var(--text-tertiary, #71717a);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .gen-caption-text {
          color: var(--text-secondary, #d4d4d8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .gen-error-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          color: #ef4444;
          font-size: 13px;
        }

        @keyframes shimmerSweep {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(60%); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.25); opacity: 1; box-shadow: 0 0 10px #a855f7; }
        }
        @keyframes sparkleSpin {
          0% { transform: rotate(0deg) scale(0.9); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
