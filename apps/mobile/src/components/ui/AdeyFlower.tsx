import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

/**
 * Minimalist Adey Abeba (Meskel daisy) mark — Adey's original symbol.
 * Eight soft petals in gold around a forest-green centre.
 */
export function AdeyFlower({ size = 48, petal = '#E8B923', center = '#174B3A', stroke }: { size?: number; petal?: string; center?: string; stroke?: string }) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G origin="50, 50">
        {petals.map((deg) => (
          <Path
            key={deg}
            d="M50 50 C 44 36, 44 18, 50 8 C 56 18, 56 36, 50 50 Z"
            fill={petal}
            stroke={stroke}
            strokeWidth={stroke ? 1.5 : 0}
            transform={`rotate(${deg} 50 50)`}
            opacity={0.95}
          />
        ))}
      </G>
      <Circle cx="50" cy="50" r="11" fill={center} />
      <Circle cx="50" cy="50" r="5" fill={petal} opacity={0.9} />
    </Svg>
  );
}
