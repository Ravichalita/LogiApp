
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// --- CONFIGURAÇÃO DO SVG ---
const LogoSVG = React.memo(({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 460.18 516.29" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    fill="#ff9e00" 
  >
    <path d="M380.22,156.65l-137.4-79.27c-7.91-4.57-17.66-4.56-25.57,0l-68.63,39.65c-4.42,2.55-4.13,8.79.33,11.29.04.03.09.05.13.08l141.55,80.33c8.16,4.63,13.21,13.29,13.21,22.68l.04,159.99c0,.06,0,.11,0,.17-.03,5.4,5.56,8.92,10.23,6.22l66.16-38.22c7.91-4.57,12.78-13.01,12.78-22.15l-.04-158.62c0-9.13-4.88-17.57-12.79-22.14ZM458.04,153.18c0-16.48-8.87-31.83-23.15-40.07L253.16,8.25C238.89.01,221.15.02,206.88,8.26L25.21,113.22c-14.27,8.24-23.13,23.6-23.13,40.08l.06,209.81c0,16.49,8.88,31.84,23.15,40.07l181.73,104.86c7.14,4.12,15.14,6.18,23.14,6.17,8,0,16-2.06,23.14-6.19l181.68-104.95c14.27-8.24,23.13-23.6,23.13-40.08l-.06-209.81ZM422.51,381.5l-181.68,104.96c-6.59,3.81-14.78,3.8-21.36,0l-181.73-104.86c-6.59-3.8-10.68-10.88-10.68-18.49l-.06-209.81c0-7.61,4.09-14.7,10.68-18.5L219.34,29.84c3.29-1.9,6.99-2.85,10.68-2.85,3.69,0,7.39.95,10.68,2.85l181.73,104.86c6.59,3.81,10.69,10.89,10.69,18.5l.06,209.81c0,7.6-4.09,14.69-10.68,18.5Z"/>
  </svg>
));

const Hexagon = React.memo(({ isGlowing, onHover }: { isGlowing: boolean, onHover: () => void }) => {
  return (
    // TAMANHO REDUZIDO: w-12 (48px) e h-14 (56px)
    // MARGEM REDUZIDA: -mb-3.5 (14px) para manter proporção de overlap de 1/4
    <div className="relative w-12 h-14 flex items-center justify-center -mb-3.5">
      <div 
        className={`
          w-full h-full flex items-center justify-center 
          transition-all duration-300 ease-in-out cursor-pointer
          clip-hexagon scale-90 hover:scale-95 hover:z-20
          group
        `}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          backgroundColor: 'transparent'
        }}
        onMouseEnter={onHover}
      >
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
          <LogoSVG 
            className={`
              w-full h-full
              transition-all duration-[5000ms] ease-out
              ${isGlowing 
                ? 'opacity-100 drop-shadow-[0_0_20px_rgba(255,158,0,0.9)] filter brightness-125' 
                : 'opacity-20 hover:opacity-100 hover:drop-shadow-[0_0_15px_rgba(255,158,0,0.6)]'}
            `} 
          />
        </div>
      </div>
    </div>
  );
});

const HoneycombRow = React.memo(({ count, rowIndex, activeColsInRow, onCellHover }: { count: number, rowIndex: number, activeColsInRow: Set<number>, onCellHover: (rowIndex: number, colIndex: number) => void }) => {
  return (
    <div 
      className="flex justify-center"
      style={{ 
        // OFFSET REDUZIDO: 1.5rem (24px) que é metade da largura w-12 (48px)
        transform: rowIndex % 2 !== 0 ? 'translateX(1.5rem)' : 'none' 
      }} 
    >
      {Array.from({ length: count }).map((_, colIndex) => {
        const isGlowing = activeColsInRow.has(colIndex);
        return (
          <Hexagon 
            key={colIndex} 
            isGlowing={isGlowing} 
            onHover={() => onCellHover(rowIndex, colIndex)}
          />
        );
      })}
    </div>
  );
});

export function HoneycombAnimation() {
  const [dimensions, setDimensions] = useState({ cols: 0, rows: 0 });
  const [activeCells, setActiveCells] = useState(new Map<string, number>()); // Map<key, expiryTimestamp>
  
  const walkersRef = useRef<{r: number, c: number}[]>([]); 
  // Aumentado levemente para 6 para compensar o aumento na quantidade de células
  const maxWalkers = 6; 
  const tickRef = useRef(0);

  useEffect(() => {
    const handleResize = () => {
      // GRID MAIS DENSO: Divisores reduzidos pela metade (48px e 42px efetivos)
      const cols = Math.ceil(window.innerWidth / 48) + 2;
      const rows = Math.ceil(window.innerHeight / 42) + 4;
      setDimensions({ cols, rows });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Interação do Mouse
  const handleCellHover = useCallback((r: number, c: number) => {
    setActiveCells(prev => {
      const newMap = new Map(prev);
      const key = `${r},${c}`;
      const now = Date.now();
      
      const newExpiry = now + 1000;
      
      const currentExpiry = newMap.get(key) || 0;
      if (newExpiry > currentExpiry) {
        newMap.set(key, newExpiry);
      }
      
      return newMap;
    });
  }, []);

  useEffect(() => {
    if (dimensions.rows === 0) return;

    const getNeighbors = (r: number, c: number) => {
      const neighbors: {r: number, c: number}[] = [];
      const isOdd = r % 2 !== 0;
      const offsets = isOdd 
        ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
        : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];

      offsets.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < dimensions.rows && nc >= 0 && nc < dimensions.cols) {
          neighbors.push({ r: nr, c: nc });
        }
      });
      return neighbors;
    };

    // Loop de Controle (100ms)
    const intervalId = setInterval(() => {
      const now = Date.now();
      tickRef.current += 1;

      setActiveCells(prevActive => {
        const newMap = new Map(prevActive);
        let changed = false;

        // 1. Limpeza de Células Expiradas
        for (const [key, expiry] of newMap.entries()) {
          if (now > expiry) {
            newMap.delete(key);
            changed = true;
          }
        }

        // 2. Movimento dos Caminhantes (Lógica lenta: a cada 800ms)
        if (tickRef.current % 8 === 0) {
          const currentWalkers = walkersRef.current;

          // Nascer novos caminhantes se necessário
          if (currentWalkers.length < maxWalkers) {
            currentWalkers.push({
              r: Math.floor(Math.random() * dimensions.rows),
              c: Math.floor(Math.random() * dimensions.cols)
            });
          }

          // Mover existentes
          for (let i = 0; i < currentWalkers.length; i++) {
            const walker = currentWalkers[i];
            const key = `${walker.r},${walker.c}`;
            
            newMap.set(key, now + 12000); 
            changed = true;

            const neighbors = getNeighbors(walker.r, walker.c);
            if (neighbors.length > 0) {
              const nextStep = neighbors[Math.floor(Math.random() * neighbors.length)];
              walker.r = nextStep.r;
              walker.c = nextStep.c;
            } else {
              currentWalkers.splice(i, 1);
              i--;
            }

            if (Math.random() > 0.995) { 
               currentWalkers.splice(i, 1);
               i--;
            }
          }
        }

        return changed ? newMap : prevActive;
      });
    }, 100); 

    return () => clearInterval(intervalId);
  }, [dimensions]);

  const activeMapByRow = useMemo(() => {
    const map: { [key: number]: Set<number> } = {};
    activeCells.forEach((_, key) => {
      const [r, c] = key.split(',').map(Number);
      if (!map[r]) map[r] = new Set();
      map[r].add(c);
    });
    return map;
  }, [activeCells]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden backdrop-blur-sm">
      <div className="absolute inset-0 bg-background/90" />

      <div className="scale-105 opacity-50">
        {Array.from({ length: dimensions.rows }).map((_, rowIndex) => (
          <HoneycombRow 
            key={rowIndex} 
            rowIndex={rowIndex}
            count={dimensions.cols} 
            activeColsInRow={activeMapByRow[rowIndex] || new Set()}
            onCellHover={handleCellHover}
          />
        ))}
      </div>
    </div>
  );
}
