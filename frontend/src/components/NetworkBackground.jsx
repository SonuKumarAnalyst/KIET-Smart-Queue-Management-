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

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    
    if (!this.isDrifter) {
      ctx.shadowBlur = 12 + Math.sin(this.pulse) * 6;
      ctx.shadowColor = "#00ffe1";
      ctx.fillStyle = `rgba(0, 255, 225, ${0.8 + Math.sin(this.pulse) * 0.2})`;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(0, 255, 225, ${this.opacity})`;
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

    const connect = () => {
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
            ctx.strokeStyle = `rgba(0, 255, 225, ${opacity})`;
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      const grad = ctx.createRadialGradient(
        window.innerWidth / 2, 
        window.innerHeight / 2, 
        0, 
        window.innerWidth / 2, 
        window.innerHeight / 2, 
        window.innerWidth
      );
      grad.addColorStop(0, "#0a192f");
      grad.addColorStop(1, "#000000");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      connect();
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
