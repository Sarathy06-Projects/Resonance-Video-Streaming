import React, { useEffect, useRef } from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const hexToRgb = (hex: string) => {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean;
  const intValue = Number.parseInt(normalized, 16);

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
};

const mixColors = (colors: string[], t: number) => {
  const palette = colors && colors.length ? colors : ['#8b5cf6', '#60a5fa', '#e2e8f0', '#38bdf8'];
  const scaled = clamp(t, 0, 1) * (palette.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(palette.length - 1, lowerIndex + 1);
  const localT = scaled - lowerIndex;

  const a = hexToRgb(palette[lowerIndex]);
  const b = hexToRgb(palette[upperIndex]);

  return {
    r: Math.round(lerp(a.r, b.r, localT)),
    g: Math.round(lerp(a.g, b.g, localT)),
    b: Math.round(lerp(a.b, b.b, localT)),
  };
};

export interface GradientASCIIProps {
  colors?: string[];
  shape?: 'horizon' | 'pinch' | 'rise' | 'eclipse';
  characters?: string;
  cellSize?: number;
  density?: number;
  glyphOpacity?: number;
  gradientOpacity?: number;
  glow?: number;
  softness?: number;
  flow?: number;
  speed?: number;
  grain?: number;
  mouseInteraction?: boolean;
  scrambleRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const GradientASCII: React.FC<GradientASCIIProps> = ({
  colors = ['#8b5cf6', '#60a5fa', '#e2e8f0', '#38bdf8'],
  shape = 'horizon',
  characters = ' .,:;irsXA253hMHGS#9B&@',
  cellSize = 17,
  density = 0.72,
  glyphOpacity = 0.78,
  gradientOpacity = 0.9,
  glow = 0.75,
  softness = 0.42,
  flow = 0.68,
  speed = 0.88,
  grain = 0.06,
  mouseInteraction = true,
  scrambleRadius = 0.22,
  className = '',
  style = {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const glyphs = [...new Set([...characters].filter((char) => char && char.trim() !== ''))];
    const safeGlyphs = glyphs.length ? glyphs : [' ', '.', ':', ';', 'i', 'r', 's', 'X', 'A', '2', '#', '@'];

    let frameId = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (time: number) => {
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      context.clearRect(0, 0, width, height);

      const columns = Math.max(18, Math.ceil(width / cellSize));
      const rows = Math.max(12, Math.ceil(height / cellSize));
      const t = time * 0.0008 * speed;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const nx = col / columns;
          const ny = row / rows;
          const x = (nx - 0.5) * width;
          const y = (ny - 0.5) * height;

          let value = 0;

          if (shape === 'pinch') {
            const pinch = 0.18 * Math.sin((y / height) * 11 + t * 2.2);
            const band = Math.abs((y - pinch * height) / (height * 0.24));
            value = Math.exp(-Math.pow(band, 2.2));
          } else if (shape === 'rise') {
            const dx = x / (width * 0.72);
            const dy = (y - height * 0.6) / (height * 0.5);
            const ring = Math.hypot(dx, dy);
            value = clamp(1 - ring, 0, 1);
            value = Math.pow(value, 1.4);
          } else if (shape === 'eclipse') {
            const dist = Math.hypot(x, y);
            const band = Math.abs(dist - height * 0.24);
            value = Math.exp(-Math.pow(band / (height * 0.12), 2));
          } else {
            const horizon = 0.5 + 0.08 * Math.sin(t * 2.2 + nx * 12);
            const edge = Math.abs(y - height * (0.3 + 0.34 * Math.sin(nx * 8 + t)));
            const band = Math.exp(-Math.abs(edge / (height * (0.18 + softness))));
            const arch = Math.exp(-Math.pow((x / (width * 0.64)) ** 2, 0.8));
            value = clamp(band * (0.4 + arch * 1.3) * (0.5 + horizon), 0, 1);
          }

          const drift = (Math.sin(nx * 12 + t * 1.7 + flow) + Math.cos(ny * 16 - t * 1.1)) * 0.12;
          let adjusted = clamp(value + drift, 0, 1);

          if (mouseInteraction) {
            const dx = nx - pointerRef.current.x;
            const dy = ny - pointerRef.current.y;
            const dist = Math.hypot(dx, dy);
            if (pointerRef.current.active && dist < scrambleRadius + 0.08) {
              const wave = clamp(1 - dist / (scrambleRadius + 0.08), 0, 1);
              adjusted = clamp(adjusted + wave * 0.35 * Math.sin(time * 0.012 + nx * 20 + ny * 16), 0, 1);
            }
          }

          const presence = Math.random() < clamp(adjusted * (0.55 + density), 0, 1) ? 1 : 0;
          if (!presence) continue;

          const index = clamp(Math.floor(adjusted * (safeGlyphs.length - 1)), 0, safeGlyphs.length - 1);
          const char = safeGlyphs[index];
          const rgb = mixColors(colors, adjusted);
          const alpha = clamp(adjusted * glyphOpacity, 0.15, 1);

          context.font = `${Math.max(12, cellSize * (0.75 + glow * 0.4))}px 'SFMono-Regular', 'Consolas', monospace`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.shadowBlur = 18 * glow;
          context.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.24 + adjusted * 0.4})`;
          context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          context.fillText(char, col * cellSize + cellSize * 0.7, row * cellSize + cellSize * 0.72);
        }
      }

      const glowGradient = context.createRadialGradient(
        width * 0.5,
        height * 0.46,
        height * 0.12,
        width * 0.5,
        height * 0.46,
        width * 0.75,
      );
      glowGradient.addColorStop(0, `rgba(148, 163, 255, ${0.22 * gradientOpacity})`);
      glowGradient.addColorStop(0.55, `rgba(59, 130, 246, ${0.1 * gradientOpacity})`);
      glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = glowGradient;
      context.fillRect(0, 0, width, height);

      if (grain > 0) {
        for (let i = 0; i < 180; i += 1) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const alpha = Math.random() * grain;
          context.fillStyle = `rgba(255,255,255,${alpha})`;
          context.fillRect(x, y, 1, 1);
        }
      }

      frameId = window.requestAnimationFrame(render);
    };

    const handleMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerRef.current.x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      pointerRef.current.y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      pointerRef.current.active = true;
    };

    const handleLeave = () => {
      pointerRef.current.active = false;
    };

    resize();
    frameId = window.requestAnimationFrame(render);
    container.addEventListener('pointermove', handleMove);
    container.addEventListener('pointerleave', handleLeave);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(frameId);
      container.removeEventListener('pointermove', handleMove);
      container.removeEventListener('pointerleave', handleLeave);
      window.removeEventListener('resize', resize);
    };
  }, [cellSize, characters, colors, density, flow, glow, glyphOpacity, gradientOpacity, grain, mouseInteraction, scrambleRadius, shape, softness, speed]);

  return (
    <div
      ref={containerRef}
      className={`gradient-ascii ${className}`.trim()}
      style={{
        ...style,
        width: '100%',
        height: '100%',
      }}
    >
      <canvas ref={canvasRef} className="gradient-ascii__canvas" />
    </div>
  );
};

export default GradientASCII;
