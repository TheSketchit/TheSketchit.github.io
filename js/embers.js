class Ember {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.x = Math.random() * canvas.width;
        this.y = canvas.height + Math.random() * 20;
        this.size = Math.random() * 3 + 1;
        this.speedY = Math.random() * 1 + 0.5;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.lifetime = 0;
        this.maxLifetime = Math.random() * 200 + 100;
        this.angle = Math.random() * 360;
        this.rotationSpeed = Math.random() * 0.02 - 0.01;
        this.color = `hsl(${Math.random() * 30 + 15}, 100%, ${Math.random() * 20 + 60}%)`;
    }

    update() {
        this.y -= this.speedY;
        this.x += Math.sin(this.lifetime * 0.01) * this.speedX;
        this.lifetime++;
        this.angle += this.rotationSpeed;

        if (this.lifetime > this.maxLifetime || this.y < 0) {
            this.y = this.canvas.height + Math.random() * 20;
            this.x = Math.random() * this.canvas.width;
            this.lifetime = 0;
        }
    }

    draw() {
        const alpha = Math.min(1, (this.maxLifetime - this.lifetime) / 50);
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        this.ctx.rotate(this.angle);
        this.ctx.fillStyle = this.color;
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Glow effect
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
        gradient.addColorStop(0, `hsla(${parseInt(this.color.slice(4))}, 100%, 50%, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.size * 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
}

class EmberEffect {
    constructor() {
        this.canvas = document.getElementById('emberCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        this.embers = [];
        this.createEmbers();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.animate();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createEmbers() {
        const emberCount = Math.floor(this.canvas.width * this.canvas.height / 10000);
        for (let i = 0; i < emberCount; i++) {
            this.embers.push(new Ember(this.canvas, this.ctx));
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.embers.forEach(ember => {
            ember.update();
            ember.draw();
        });
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the effect when the DOM is ready
document.addEventListener('DOMContentLoaded', () => new EmberEffect());
