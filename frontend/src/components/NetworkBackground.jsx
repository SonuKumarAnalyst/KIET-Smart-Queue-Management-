import { useEffect, useRef } from "react";

class Particle {
  constructor(isDrifter = false) {
    this.init(isDrifter);
  }

  init(isDrifter) {
    this.x = Math.random() * window.innerWidth;
    this.y = Math.random() * window.innerHeight;
    this.vx = (Math.random() - 0.5) * (isDrifter ? 0.3 : 0.6);
    this.vy = (Math.random() - 0.5) * (isDrifter ? 0.3 : 0.6);
    this.baseRadius = isDrifter ? Math.random() * 1.5 : Math.random() * 2 + 1;
    this.radius = this.baseRadius;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = 0.01 + Math.random() * 0.02;
    this.isDrifter = isDrifter;
    this.opacity = isDrifter ? 0.2 + Math.random() * 0.3 : 0.8;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.pulse += this.pulseSpeed;

    if (this.x < 0 || this.x > window.innerWidth) this.vx *= -1;
    if (this.y < 0 || this.y > window.innerHeight) this.vy *= -1;

    if (!this.isDrifter) {
      this.radius = this.baseRadius + Math.sin(this.pulse) * 0.8;
    }
  }

  draw(ctx, isDark) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    
    if (!this.isDrifter) {
      ctx.shadowBlur = 12 + Math.sin(this.pulse) * 6;
      const particleColor = isDark ? "0, 210, 190" : "22, 119, 255";
      ctx.shadowColor = isDark ? "#22D3C5" : "#1677FF";
      ctx.fillStyle = `rgba(${particleColor}, ${isDark ? 0.72 + Math.sin(this.pulse) * 0.12 : 0.30 + Math.sin(this.pulse) * 0.08})`;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = isDark ? `rgba(0, 210, 190, ${this.opacity * 0.55})` : `rgba(22, 119, 255, ${this.opacity * 0.24})`;
    }
    
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export default function NetworkBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const dpr = window.devicePixelRatio || 1;
    const setCanvasSize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    setCanvasSize();

    let particles = [];
    const count = Math.min(Math.floor(window.innerWidth / 15), 100);
    const connectionDist = 160;

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push(new Particle(false));
      }
      for (let i = 0; i < 25; i++) {
        particles.push(new Particle(true));
      }
    };
    initParticles();

    const connect = (isDark) => {
      ctx.lineWidth = 0.6;
      for (let a = 0; a < particles.length; a++) {
        if (particles[a].isDrifter) continue;
        for (let b = a + 1; b < particles.length; b++) {
          if (particles[b].isDrifter) continue;
          
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const opacity = (1 - dist / connectionDist) * 0.2;
            ctx.beginPath();
            ctx.strokeStyle = isDark ? `rgba(0, 210, 190, ${opacity * 0.7})` : `rgba(22, 119, 255, ${opacity * 0.28})`;
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      const isDark = document.documentElement.classList.contains("dark");
      const grad = ctx.createRadialGradient(
        window.innerWidth / 2, 
        window.innerHeight / 2, 
        0, 
        window.innerWidth / 2, 
        window.innerHeight / 2, 
        window.innerWidth
      );
      grad.addColorStop(0, isDark ? "#0A192F" : "#FFFFFF");
      grad.addColorStop(1, isDark ? "#07111F" : "#F7F8FA");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach(p => {
        p.update();
        p.draw(ctx, isDark);
      });

      connect(isDark);
      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      setCanvasSize();
      initParticles();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-50 pointer-events-none"
    />
  );
}
