class Ember {
    constructor(canvas, ctx, baseY) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.baseY = baseY;
        this.reset();
        this.shadowBlur = Math.random() * 10 + 5;
        this.shadowColor = `rgba(255, 100, 0, ${Math.random() * 0.3 + 0.1})`;
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = this.baseY + Math.random() * 50;
        this.size = Math.random() * 2 + 1;
        this.speedY = Math.random() * 0.8 + 0.2;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.lifetime = 0;
        this.maxLifetime = Math.random() * 400 + 200;
        this.angle = Math.random() * 360;
        this.rotationSpeed = Math.random() * 0.02 - 0.01;
        this.color = `hsl(${Math.random() * 20 + 10}, 100%, ${Math.random() * 40 + 50}%)`;
        this.zigZag = Math.random() < 0.5;
        this.zigZagAmplitude = Math.random() * 100 + 50;
        this.zigZagFrequency = Math.random() * 0.02 + 0.01;
        this.fadeInOut = Math.random() < 0.5;
    }

    update() {
        this.y -= this.speedY;
        if (this.zigZag) {
            this.x += Math.sin(this.lifetime * this.zigZagFrequency) * this.speedX;
        } else {
            this.x += this.speedX;
        }
        this.lifetime++;
        this.angle += this.rotationSpeed;
        this.size -= 0.002;

        if (this.lifetime > this.maxLifetime || this.y < 0 || this.size <= 0 || this.x < 0 || this.x > this.canvas.width) {
            this.reset();
        }
    }

    draw() {
        let alpha;
        if (this.fadeInOut) {
            alpha = Math.sin((this.lifetime / this.maxLifetime) * Math.PI);
        } else {
            alpha = 1 - (this.lifetime / this.maxLifetime);
        }
        alpha = Math.max(0, Math.min(1, alpha));

        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        this.ctx.rotate(this.angle);

        // Draw shadow
        this.ctx.shadowBlur = this.shadowBlur;
        this.ctx.shadowColor = this.shadowColor;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 5;

        this.ctx.fillStyle = this.color;
        this.ctx.globalAlpha = alpha;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Glow effect
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, this.size * 2);
        gradient.addColorStop(0, `hsla(${parseInt(this.color.slice(4))}, 100%, 50%, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
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
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.embers = [];
            this.createEmbers();
        });
        this.animate();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createEmbers() {
        const emberCount = Math.floor(this.canvas.width * this.canvas.height / 16000); // Reduced by half
        const baseY = this.canvas.height;
        for (let i = 0; i < emberCount; i++) {
            this.embers.push(new Ember(this.canvas, this.ctx, baseY));
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
