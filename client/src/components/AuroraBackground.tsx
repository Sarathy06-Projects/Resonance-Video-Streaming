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
            [--white-gradient:repeating-linear-gradient(100deg,#fff_0%,#fff_7%,transparent_10%,transparent_12%,#fff_16%)]
            [--dark-gradient:repeating-linear-gradient(100deg,#000_0%,#000_7%,transparent_10%,transparent_12%,#000_16%)]
            [--aurora:repeating-linear-gradient(100deg,#3b82f6_10%,#818cf8_15%,#60a5fa_20%,#c084fc_25%,#38bdf8_30%)]
            [background-image:var(--dark-gradient),var(--aurora)]
            [background-size:300%,_200%]
            [background-position:50%_50%,50%_50%]
            filter blur-[10px]
            after:content-[""] after:absolute after:inset-0 after:[background-image:var(--dark-gradient),var(--aurora)]
            after:[background-size:200%,_100%]
            after:animate-aurora after:mix-blend-difference
            pointer-events-none
            absolute -inset-[10px] opacity-45 will-change-transform
            ${
              showRadialGradient
                ? '[mask-image:radial-gradient(ellipse_at_50%_0%,black_25%,transparent_75%)]'
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

