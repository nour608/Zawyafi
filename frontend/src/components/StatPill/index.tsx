'use client';

import React from 'react';

interface StatPillProps {
    label: string;
    value: string;
    accentDigit?: string; // Optional: specific digit to color in gold, otherwise highlights last char if it's a letter (e.g., M or K)
}

export function StatPill({ label, value, accentDigit }: StatPillProps) {
    // Simple heuristic: if accentDigit is provided, replace first occurrence
    // Or if no accent digit, just render as is

    const renderValue = () => {
        if (!accentDigit) {
            // Just render the last character as gold if it's not a number (e.g. 'M', 'K', '%')
            const lastChar = value.slice(-1);
            const isWord = /[a-zA-Z%]/.test(lastChar);

            if (isWord) {
                return (
                    <>
                        {value.slice(0, -1)}
                        <span className="text-[var(--gold)]">{lastChar}</span>
                    </>
                );
            }
            return value;
        }

        const parts = value.split(accentDigit);
        if (parts.length > 1) {
            return (
                <>
                    {parts[0]}
                    <span className="text-[var(--gold)]">{accentDigit}</span>
                    {parts.slice(1).join(accentDigit)}
                </>
            );
        }

        return value;
    };

    return (
        <div className="inline-flex flex-col justify-center px-[24px] py-[12px] bg-[var(--bg-surface)] backdrop-blur-[10px] border border-[var(--border-subtle)] rounded-[2px] transition-all duration-500
      shadow-[0_2px_8px_rgba(26,26,46,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] 
      dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] dark:inset-0
    ">
            <span className="font-serif text-[22px] text-[var(--text-primary)] leading-none mb-1">
                {renderValue()}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {label}
            </span>
        </div>
    );
}
