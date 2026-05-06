import { Vec2 } from "../core/math.js";

export class Entity {
  constructor(x, y) {
    this.pos = new Vec2(x, y);
    this.vel = new Vec2(0, 0);
    this.radius = 15;
    this.hp = 100;
    this.maxHp = 100;
    this.active = true;
    this.faction = "NEUTRAL";
    this.type = "ENTITY";
    this.isDead = false;
  }
  update(dtSec) {}
  draw(ctx) {}
  takeDamage(amount, source) {
    if (!this.active || this.isDead) return;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }
  die() {
    this.active = false;
    this.isDead = true;
  }
}
