import { useEffect, useRef } from 'react';

export function useParticles(theme: string | null) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        const particles: Particle[] = [];
        const isMobile = window.innerWidth < 768;
        const count = isMobile ? 80 : 170;

        let mouseX = -9999;
        let mouseY = -9999;

        class Particle {
            x: number;
            y: number;
            size: number;
            speedY: number;
            speedX: number;
            lifeDecay: number;
            life: number;
            isGold: boolean;

            constructor(width: number, height: number, initializeAtRandomY = false) {
                this.x = Math.random() * width;
                this.y = initializeAtRandomY ? Math.random() * height : height + 10;
                this.size = 0.35 + Math.random() * 1.7; // 0.35 to 2.05px
                this.speedY = -(0.10 + Math.random() * 0.38); // -0.10 to -0.48px/frame
                this.speedX = (Math.random() - 0.5) * 0.56; // +- 0.28px/frame
                this.lifeDecay = 0.0004 + Math.random() * 0.0017;
                this.life = initializeAtRandomY ? Math.random() : 1;
                this.isGold = Math.random() > 0.5;
            }

            update(width: number, height: number) {
                this.x += this.speedX;
                this.y += this.speedY;
                this.life -= this.lifeDecay;

                // Mouse repulsion
                const dx = this.x - mouseX;
                const dy = this.y - mouseY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 115) {
                    const force = (115 - dist) / 115;
                    const pushX = (dx / dist) * force * 0.75;
                    const pushY = (dy / dist) * force * 0.75;
                    this.x += pushX;
                    this.y += pushY;
                }

                if (this.life <= 0 || this.y < -10 || this.x < -10 || this.x > width + 10) {
                    Object.assign(this, new Particle(width, height, false));
                }
            }

            draw(ctx: CanvasRenderingContext2D, isDark: boolean) {
                ctx.globalAlpha = Math.max(0, this.life);
                ctx.fillStyle = this.isGold ? (isDark ? "#c9a84c" : "#b8892f") : (isDark ? "#1a9e8f" : "#1a8a7d");
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        // Initial setup
        resize();
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(canvas.width, canvas.height, true));
        }

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        };

        const handleMouseOut = () => {
            mouseX = -9999;
            mouseY = -9999;
        };

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseOut);

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark');

            const connRadiusSq = 88 * 88;

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.update(canvas.width, canvas.height);
                p.draw(ctx, isDark);

                // Connections
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < connRadiusSq) {
                        const dist = Math.sqrt(distSq);
                        const opacity = (1 - dist / 88) * (p.life * p2.life) * 0.08; // 0.07-0.09 x life product
                        if (opacity > 0) {
                            ctx.globalAlpha = opacity;
                            ctx.strokeStyle = p.isGold ? (isDark ? "#c9a84c" : "#b8892f") : (isDark ? "#1a9e8f" : "#1a8a7d");
                            ctx.lineWidth = 0.5;
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.stroke();
                        }
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseOut);
            cancelAnimationFrame(animationFrameId);
        };
    }, [theme]); // Re-bind if theme explicitly triggers, but mostly internal isDark handles it

    return canvasRef;
}
