import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface RingProps {
  size: number;
  strokeWidth: number;
  percentage: number;
  color: string;
  exceededColor?: string;
  limit?: number;
  value: number;
  className?: string;
  label?: string;
}

export const ProgressRing = ({
  size = 100,
  strokeWidth = 8,
  percentage,
  color,
  exceededColor = '#ef4444',
  className,
}: {
  size?: number;
  strokeWidth?: number;
  percentage: number;
  color: string;
  exceededColor?: string;
  className?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedPercentage = Math.min(percentage, 100);
  const offset = circumference - (clampedPercentage / 100) * circumference;

  const isExceeded = percentage > 100;
  const displayColor = isExceeded ? exceededColor : color;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-zinc-800"
        />
        {/* Progress stroke */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={displayColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      {/* Overglow if exceeded */}
      {isExceeded && (
        <div 
          className="absolute inset-0 rounded-full blur-[8px] opacity-20 pointer-events-none"
          style={{ backgroundColor: exceededColor }}
        />
      )}
    </div>
  );
};

export const MultiProgressRing = ({
  size = 200,
  strokeWidth = 12,
  metrics,
}: {
  size?: number;
  strokeWidth?: number;
  metrics: {
    label: string;
    value: number;
    goal: number;
    color: string;
    exceededColor: string;
  }[];
}) => {
  const spacing = 4;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {metrics.map((m, i) => {
          const currentRadius = (size / 2) - (i * (strokeWidth + spacing)) - (strokeWidth / 2);
          const circumference = currentRadius * 2 * Math.PI;
          const percentage = (m.value / m.goal) * 100;
          const clampedPercentage = Math.min(percentage, 100);
          const offset = circumference - (clampedPercentage / 100) * circumference;
          const isExceeded = percentage > 100;
          const displayColor = isExceeded ? m.exceededColor : m.color;

          return (
            <React.Fragment key={m.label}>
              {/* Background track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={currentRadius}
                stroke="#18181b" // zinc-900
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              {/* Progress stroke */}
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={currentRadius}
                stroke={displayColor}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.1 }}
                strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </svg>
      
      {/* Legend / Overlay info could go here if needed, but keeping it clean like Apple */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-white font-bold text-lg tracking-tighter">Fueling</span>
      </div>
    </div>
  );
};
