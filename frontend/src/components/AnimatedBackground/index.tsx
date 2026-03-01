'use client';

import React, { useEffect, useState } from 'react';
import { useParticles } from './useParticles';
import { useNodeGraph } from './useNodeGraph';
import { FloatingTokens } from './tokens';

export function AnimatedBackground() {
    const [theme, setTheme] = useState<string | null>(null);

    useEffect(() => {
        // Read initial theme and observe changes
        const getTheme = () => document.documentElement.getAttribute('data-theme') || 'light';
        setTheme(getTheme());

        const observer = new MutationObserver(() => {
            setTheme(getTheme());
        });

        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    const particlesRef = useParticles(theme);
    const nodeGraphRef = useNodeGraph(theme);

    return (
        <>
            {/* Full-page: noise + grid + radius */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden transition-colors duration-500 z-[-2]">
                <div
                    className="absolute inset-0 z-[1] transition-opacity duration-500"
                    style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")',
                        opacity: theme === 'dark' ? 0.035 : 0.022
                    }}
                />
                <div
                    className="absolute inset-0 z-[1] transition-opacity duration-500"
                    style={{
                        backgroundImage: 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
                        backgroundSize: '62px 62px',
                        maskImage: 'radial-gradient(ellipse 88% 88% at 50% 50%, black 15%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(ellipse 88% 88% at 50% 50%, black 15%, transparent 100%)'
                    }}
                />
                <div
                    className="absolute inset-0 z-[1]"
                    style={{
                        background: `radial-gradient(circle at center, transparent 30%, var(--vignette) 150%)`
                    }}
                />
                <div className="absolute top-1/2 left-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,var(--bg-surface)_0%,transparent_70%)] blur-[80px] animate-breathe" />
            </div>

            {/* Upper-section only: animated elements */}
            <div className="absolute top-0 left-0 right-0 h-[100svh] md:h-[110svh] pointer-events-none overflow-hidden transition-colors duration-500 z-[-1]">
                <div className="absolute inset-0 opacity-40 mix-blend-screen">
                    <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,var(--gold)_0%,transparent_60%)] blur-[100px]" />
                    <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,var(--teal)_0%,transparent_60%)] blur-[100px]" />
                </div>

                <canvas ref={particlesRef} className="absolute inset-0 pointer-events-auto z-[2]" />
                <canvas ref={nodeGraphRef} className="absolute inset-0 pointer-events-none z-[3]" />
                <FloatingTokens />
            </div>
        </>
    );
}
