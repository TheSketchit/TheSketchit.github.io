class Vec2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mag() { return Math.sqrt(this.x*this.x + this.y*this.y); }
    norm() { const m = this.mag(); return m === 0 ? new Vec2(0,0) : new Vec2(this.x/m, this.y/m); }
    mult(n) { return new Vec2(this.x * n, this.y * n); }
    dist(v) { return this.sub(v).mag(); }
    distSq(v) { return (this.x - v.x)**2 + (this.y - v.y)**2; }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Vec2;
}
