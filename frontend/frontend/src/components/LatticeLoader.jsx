import React, { useState, useEffect, useRef } from 'react';

export default function LatticeLoader({
  status = 'working',
  label = 'Thinking',
  doneLabel = 'Done in',
  errorLabel = 'Failed after',
  pattern = 'orbit',
  grid = 3,
  shape = 'round',
  doneColor = '#22c55e',
  errorColor = '#ef4444',
  cellSize = 6,
  gap = 2,
  fontSize = 14,
  step = 90,
  idleOpacity = 0.15,
  glow = false,
  glowColor = '',
  showTimer = true,
  color = '#f5f5f5',
}) {
  const [activeCell, setActiveCell] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const animRef = useRef(null);

  // Orbit pattern for 3x3 grid: perimeter in clockwise order
  const orbitIndices = [0, 1, 2, 5, 8, 7, 6, 3];

  useEffect(() => {
    if (status === 'working') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 100) / 10);
      }, 100);

      let idx = 0;
      animRef.current = setInterval(() => {
        if (pattern === 'orbit' && grid === 3) {
          idx = (idx + 1) % orbitIndices.length;
          setActiveCell(orbitIndices[idx]);
        } else {
          idx = (idx + 1) % (grid * grid);
          setActiveCell(idx);
        }
      }, step);
    } else {
      clearInterval(timerRef.current);
      clearInterval(animRef.current);
    }

    return () => {
      clearInterval(timerRef.current);
      clearInterval(animRef.current);
    };
  }, [status, step, pattern, grid]);

  const currentColor =
    status === 'done' ? doneColor : status === 'error' ? errorColor : color;

  const totalCells = grid * grid;
  const cells = Array.from({ length: totalCells }, (_, i) => i);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: `${fontSize}px`,
        color: currentColor,
        fontFamily: 'inherit',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${grid}, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
      >
        {cells.map((i) => {
          const isActive = status === 'working' ? activeCell === i : status === 'done';
          return (
            <div
              key={i}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                borderRadius: shape === 'round' ? '50%' : '2px',
                backgroundColor: currentColor,
                opacity: isActive ? 1 : idleOpacity,
                boxShadow:
                  glow && isActive ? `0 0 6px ${glowColor || currentColor}` : 'none',
                transition: 'opacity 0.1s ease',
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>
          {status === 'done'
            ? doneLabel
            : status === 'error'
            ? errorLabel
            : label}
        </span>
        {showTimer && (
          <span style={{ opacity: 0.7, fontSize: `${fontSize - 1}px` }}>
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}
