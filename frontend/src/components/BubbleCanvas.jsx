import React, { useEffect, useRef } from 'react';

const BubbleCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let bubbles = [];

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        // Bubble Class
        class Bubble {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = canvas.height + Math.random() * 100;
                this.size = Math.random() * 20 + 10; // 10-30px
                this.speed = Math.random() * 1 + 0.5;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.color = `hsla(${Math.random() * 360}, 70%, 70%, ${this.opacity})`;
            }

            update() {
                this.y -= this.speed;
                if (this.y < -this.size) {
                    this.y = canvas.height + this.size;
                    this.x = Math.random() * canvas.width;
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }

        // Initialize Bubbles
        const initBubbles = () => {
            bubbles = [];
            for (let i = 0; i < 50; i++) {
                bubbles.push(new Bubble());
            }
        };

        initBubbles();

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            bubbles.forEach(bubble => {
                bubble.update();
                bubble.draw();
            });
            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none" />;
};

export default BubbleCanvas;
