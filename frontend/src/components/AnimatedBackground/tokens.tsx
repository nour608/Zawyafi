import React, { useMemo, useState, useEffect } from 'react';

const ASSET_LABELS = [
    "CAFÉ-01", "VEND-08", "MFG-03", "SME-12",
    "RTL-05", "BKY-02", "CAFE-07", "INV-19"
];

const SHAPES = ['hex', 'square', 'circle'] as const;

export function FloatingTokens() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const tokens = useMemo(() => {
        return ASSET_LABELS.map((label, i) => {
            const shape = SHAPES[i % 3];
            const size = 36 + Math.random() * 24; // 36 - 60px
            const isGold = Math.random() > 0.5;
            const duration = 11 + Math.random() * 13; // 11 - 24s
            const delay = -Math.random() * 18; // 0 to -18s
            const left = 10 + Math.random() * 80; // 10% to 90%

            return {
                id: i, label, shape, size, isGold, duration, delay, left
            };
        });
    }, []);

    if (!mounted) return null;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[4]">
            {tokens.map((t) => {
                const colorVar = t.isGold ? 'var(--gold)' : 'var(--teal)';

                return (
                    <div
                        key={t.id}
                        className="absolute flex items-center justify-center animate-floatToken opacity-0"
                        style={{
                            left: `${t.left}%`,
                            width: t.size,
                            height: t.size,
                            bottom: '30%', // starting point for translateY
                            animationDuration: `${t.duration}s`,
                            animationDelay: `${t.delay}s`,
                        }}
                    >
                        {/* Shape Outline Render */}
                        <div
                            className="absolute inset-0 border border-opacity-30 flex items-center justify-center"
                            style={{
                                borderColor: t.shape !== 'hex' ? colorVar : 'transparent',
                                borderRadius: t.shape === 'circle' ? '50%' : t.shape === 'square' ? '4px' : '0',
                                backgroundColor: t.shape === 'hex' ? colorVar : 'transparent',
                                clipPath: t.shape === 'hex' ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' : 'none',
                                opacity: t.shape === 'hex' ? 0.15 : 1,
                            }}
                        />
                        {/* Hex Border Simulator */}
                        {t.shape === 'hex' && (
                            <div
                                className="absolute border"
                                style={{
                                    width: '94%', height: '94%',
                                    backgroundColor: 'transparent',
                                    border: `1px solid ${colorVar}`,
                                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                    opacity: 0.8
                                }}
                            />
                        )}

                        <span
                            className="font-mono font-medium tracking-[0.14em] z-10"
                            style={{
                                color: colorVar,
                                fontSize: Math.max(6.5, t.size / 6) + 'px',
                            }}
                        >
                            {t.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
