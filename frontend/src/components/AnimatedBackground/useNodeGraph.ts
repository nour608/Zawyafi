import { useEffect, useRef } from 'react';

export function useNodeGraph(theme: string | null) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let nodes: NodeItem[] = [];
        const nodeCount = 11;
        let phase = 0;

        class NodeItem {
            x: number;
            y: number;
            r: number;
            vx: number;
            vy: number;
            phaseOffset: number;

            constructor(width: number, height: number) {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.r = 2.5 + Math.random() * 2.5; // 2.5 to 5px
                this.vx = (Math.random() - 0.5) * 0.2;
                this.vy = (Math.random() - 0.5) * 0.2;
                this.phaseOffset = Math.random() * Math.PI * 2;
            }

            update(width: number, height: number) {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;
            }
        }

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            nodes = [];
            for (let i = 0; i < nodeCount; i++) {
                nodes.push(new NodeItem(canvas.width, canvas.height));
            }
        };

        resize();
        window.addEventListener('resize', resize);

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark');

            phase += 0.011; // 0.011 rad/frame

            nodes.forEach(n => n.update(canvas.width, canvas.height));

            // Draw connections (2 nearest neighbors)
            nodes.forEach((n, i) => {
                // Find 2 closest nodes
                const sorted = [...nodes]
                    .filter((_, idx) => idx !== i)
                    .map(n2 => ({ n2, distSq: (n.x - n2.x) ** 2 + (n.y - n2.y) ** 2 }))
                    .sort((a, b) => a.distSq - b.distSq)
                    .slice(0, 2);

                sorted.forEach(({ n2 }) => {
                    // Edge style
                    ctx.beginPath();
                    ctx.moveTo(n.x, n.y);
                    ctx.lineTo(n2.x, n2.y);
                    ctx.setLineDash([3, 10]);
                    ctx.lineDashOffset = -(phase * 6); // Edge scroll speed

                    ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(26, 26, 46, 0.15)";
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Data dot traveling on the line
                    const dist = Math.sqrt((n.x - n2.x) ** 2 + (n.y - n2.y) ** 2);
                    const t = ((phase * 0.45 * 10) % dist) / dist; // Data dot speed 0.45 * pulse
                    const dotX = n.x + (n2.x - n.x) * t;
                    const dotY = n.y + (n2.y - n.y) * t;

                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.arc(dotX, dotY, 0.9, 0, Math.PI * 2); // size 1.8px -> r 0.9px
                    ctx.fillStyle = isDark ? "#1a9e8f" : "#1a8a7d"; // Teal in both
                    ctx.fill();
                });
            });

            // Draw nodes
            nodes.forEach(n => {
                ctx.setLineDash([]);

                // Halo
                const opacity = 0.18 + 0.12 * Math.sin(phase + n.phaseOffset);
                const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 5);
                const colorBase = isDark ? "255, 255, 255" : "26, 26, 46";
                grad.addColorStop(0, `rgba(${colorBase}, ${opacity})`);
                grad.addColorStop(1, `rgba(${colorBase}, 0)`);

                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r * 5, 0, Math.PI * 2);
                ctx.fillStyle = grad;
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = isDark ? "#F0EDE6" : "#1A1A2E";
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, [theme]);

    return canvasRef;
}
