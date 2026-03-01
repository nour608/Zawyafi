'use client';

import React, { useEffect, useState } from 'react';

export function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Sync with initial theme
        const currentTheme = document.documentElement.getAttribute('data-theme') ||
            (localStorage.getItem('theme') ?? 'light');
        setIsDark(currentTheme === 'dark');
    }, []);

    const toggleTheme = () => {
        const nextDark = !isDark;
        const nextTheme = nextDark ? 'dark' : 'light';
        setIsDark(nextDark);
        document.documentElement.setAttribute('data-theme', nextTheme);
        if (nextDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', nextTheme);
    };

    return (
        <button
            onClick={toggleTheme}
            className={`fixed bottom-[76px] right-4 md:bottom-6 md:right-6 z-[110] flex items-center gap-[12px] pl-[12px] pr-[16px] py-[9px] rounded-full backdrop-blur-[12px] border transition-all duration-500 hover:brightness-110
        ${isDark ? 'bg-[rgba(255,255,255,0.04)] border-[var(--border-subtle)]' : 'bg-[rgba(255,255,255,0.65)] border-[var(--border-subtle)]'}
      `}
            aria-label="Toggle Theme"
        >
            <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--text-primary)]">
                {isDark ? 'Dark' : 'Light'}
            </span>
            <div
                className={`relative w-[32px] h-[17px] rounded-[9px] p-[2px] transition-colors duration-500
          ${isDark ? 'bg-[rgba(184,137,47,0.2)]' : 'bg-[rgba(26,138,125,0.2)]'}
        `}
            >
                <div
                    className={`absolute top-[2px] w-[13px] h-[13px] rounded-full transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${isDark ? 'translate-x-[15px] bg-[var(--gold)]' : 'translate-x-[0px] bg-[var(--teal)]'}
          `}
                />
            </div>
        </button>
    );
}
