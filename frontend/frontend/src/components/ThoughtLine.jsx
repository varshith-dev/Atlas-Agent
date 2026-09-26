import React, { useState, useEffect, useRef } from 'react';

export default function ThoughtLine({
  working = true,
  steps = ['Reading the question', 'Searching your notes', 'Drafting an answer'],
  label = 'Thinking…',
  doneLabel = 'Thought for',
  glyph = 'sparkle',
  fontSize = 16,
  breathPeriod = 1.6,
  breathDepth = 0.45,
  settleDuration = 350,
  settleBlur = 2,
  collapsible = true,
  collapseOnSettle = true,
  showTimer = true,
  onSettle,
}) {
  const [elapsed, setElapsed] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [settled, setSettled] = useState(false);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const stepIntervalRef = useRef(null);

  useEffect(() => {
    if (working) {
      setSettled(false);
      setCollapsed(false);
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 100) / 10);
      }, 100);

      // Cycle through steps if not dynamically controlled
      if (steps && steps.length > 1) {
        stepIntervalRef.current = setInterval(() => {
          setCurrentStepIdx((prev) => (prev + 1) % steps.length);
        }, 1800);
      }
    } else {
      clearInterval(timerRef.current);
      clearInterval(stepIntervalRef.current);
      setSettled(true);
      const finalSec = Math.floor((Date.now() - startTimeRef.current) / 100) / 10;
      if (onSettle) onSettle(finalSec);
      if (collapseOnSettle) {
        setTimeout(() => setCollapsed(true), settleDuration);
      }
    }

    return () => {
      clearInterval(timerRef.current);
      clearInterval(stepIntervalRef.current);
    };
  }, [working, steps, collapseOnSettle, settleDuration, onSettle]);

  const glyphIcon = glyph === 'sparkle' ? '✨' : '✦';
  const activeStepText = steps && steps.length > 0 ? steps[currentStepIdx] || steps[0] : '';

  return (
    <div
      style={{
        margin: '8px 0',
        padding: '8px 12px',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontSize: `${fontSize}px`,
        color: 'var(--text-secondary, #a3a3a3)',
        transition: `all ${settleDuration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        filter: working ? 'none' : `blur(${settled && !collapsed ? settleBlur : 0}px)`,
      }}
    >
      <div
        onClick={() => collapsible && setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-block',
              animation: working
                ? `thoughtBreath ${breathPeriod}s ease-in-out infinite alternate`
                : 'none',
              transformOrigin: 'center',
            }}
          >
            {glyphIcon}
          </span>
          <span style={{ fontWeight: 500 }}>
            {working ? label : `${doneLabel} ${elapsed.toFixed(1)}s`}
          </span>
          {working && (
            <span
              style={{
                color: 'var(--text-tertiary, #737373)',
                fontSize: `${fontSize - 2}px`,
                marginLeft: '4px',
              }}
            >
              — {activeStepText}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {working && showTimer && (
            <span
              style={{
                fontSize: `${fontSize - 2}px`,
                color: 'var(--text-tertiary, #737373)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {elapsed.toFixed(1)}s
            </span>
          )}
          {collapsible && (
            <span
              style={{
                fontSize: '11px',
                opacity: 0.5,
                transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              ▼
            </span>
          )}
        </div>
      </div>

      {!collapsed && steps && steps.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: `${fontSize - 2}px`,
          }}
        >
          {steps.map((st, i) => {
            const isCur = working && i === currentStepIdx;
            const isPast = !working || i < currentStepIdx;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isCur
                    ? 'var(--text-primary, #ffffff)'
                    : isPast
                    ? 'var(--text-secondary, #888888)'
                    : 'var(--text-tertiary, #555555)',
                }}
              >
                <span>{isPast ? '✓' : isCur ? '›' : '·'}</span>
                <span>{st}</span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes thoughtBreath {
          from { opacity: ${1 - breathDepth}; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
