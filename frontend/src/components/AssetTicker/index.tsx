'use client';

import React from 'react';

const mockAssets = [
    { name: 'CAFÉ-01', raise: '€2.4M', yield: '14.2%', up: true },
    { name: 'VEND-08', raise: '€850K', yield: '9.8%', up: true },
    { name: 'MFG-03', raise: '€4.1M', yield: '12.5%', up: true },
    { name: 'SME-12', raise: '€1.2M', yield: '11.0%', up: true },
    { name: 'RTL-05', raise: '€3.8M', yield: '10.4%', up: false },
    { name: 'BKY-02', raise: '€620K', yield: '8.9%', up: true },
];

export function AssetTicker() {
    // Duplicate array once for seamless scrolling
    const scrollItems = [...mockAssets, ...mockAssets];

    return (
        <div
            className="fixed bottom-0 w-full z-[100] h-auto py-[10px] bg-[var(--bg-surface)] backdrop-blur-[10px] border-t border-[var(--border-subtle)] overflow-hidden"
            style={{
                maskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, black 6%, black 94%, transparent)'
            }}
        >
            <div className="flex w-max animate-tickerMove pointer-events-none will-change-transform">
                {scrollItems.map((asset, idx) => (
                    <div key={idx} className="flex items-center space-x-[14px] mx-[26px]">
                        {/* Pulsing Dot */}
                        <div className="relative w-[5px] h-[5px]">
                            <div className="absolute inset-0 bg-[var(--teal)] rounded-full animate-blink transform origin-center" />
                        </div>

                        {/* Text Structure */}
                        <span className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase whitespace-nowrap text-[var(--text-muted)]">
                            {asset.name}
                        </span>
                        <span className="text-[var(--border-medium)] px-1">·</span>
                        <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-[var(--text-primary)] whitespace-nowrap">
                            {asset.raise}
                        </span>
                        <span className="font-mono text-[11px] font-medium tracking-[0.14em] text-[var(--teal)] whitespace-nowrap pl-2">
                            +{asset.yield}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
