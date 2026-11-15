import React from 'react';

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  showRadialGradient?: boolean;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  className = '',
  children,
  showRadialGradient = true,
  ...props
}) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center bg-[#07080a] text-white overflow-hidden ${className}`}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className={`
            [--aurora:repeating-linear-gradient(115deg,#4f46e5_0%,#6366f1_12%,#38bdf8_24%,#818cf8_36%,#a855f7_48%,#4f46e5_60%)]
            [background-image:var(--aurora)]
            [background-size:250%_150%]
            [background-position:50%_50%]
            filter blur-[70px] sm:blur-[90px]
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--aurora)]
            after:[background-size:200%_150%]
            after:animate-aurora
            pointer-events-none
            absolute -inset-[25px] opacity-30 sm:opacity-35 will-change-transform
            ${
              showRadialGradient
                ? '[mask-image:radial-gradient(ellipse_75%_60%_at_50%_25%,black_20%,transparent_80%)]'
                : ''
            }
          `}
        />
      </div>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
};

export default AuroraBackground;
