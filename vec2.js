class Vec2 {
    constructor(x, y) { this.x = x || 0; this.y = y || 0; }
    magSq() { return this.x * this.x + this.y * this.y; }
    mag() { return Math.sqrt(this.magSq()); }
    normalize() { let m = this.mag(); if (m > 0) { this.x /= m; this.y /= m; } return this; }
    distSq(other) { let dx = this.x - other.x, dy = this.y - other.y; return dx * dx + dy * dy; }
    dist(other) { return Math.sqrt(this.distSq(other)); }
    copy() { return new Vec2(this.x, this.y); }
}
