import { Entity } from "./Entity.js";
import { Vec2 } from "../core/math.js";

export class Unit extends Entity {
  constructor(x, y) {
    super(x, y);
    this.speed = 50;
    this.target = null;
    this.state = "IDLE";
    this.attackRange = 30;
    this.damage = 10;
    this.attackCooldown = 0;
    this.maxAttackCooldown = 1.0;
  }
  moveTowards(tPos) {
    const d = tPos.sub(this.pos);
    if (d.mag() > 0) {
      this.vel = d.norm().mult(this.speed);
      this.pos = this.pos.add(this.vel.mult(0.016));
    }
  }
  applySoftCollision() {
    return; // Implementation injected by Game or handled globally
  }
}
