import { Entity } from "./Entity.js";
import { Grid, SpriteCache } from "../core/engine.js";
import { Vec2 } from "../core/math.js";
export class Projectile {
  constructor(x, y, t, d, s, pT = "MAGIC") {
    this.pos = new Vec2(x, y);
    this.target = t;
    this.damage = d;
    this.source = s;
    this.speed =
      pT === "FIREBALL"
        ? 4
        : pT === "ARROW"
          ? 8
          : pT === "MAGIC_MISSILE"
            ? 6
            : pT === "LAVA_ROCK"
              ? 6
              : 5;
    this.active = true;
    this.projType = pT;
  }
  update(dtSec) {
    if (!this.target.active) {
      this.active = false;
      return;
    }
    if (this.pos.distSq(this.target.pos) <= (this.speed * 2) ** 2) {
      this.target.takeDamage(this.damage, this.source);
      if (
        this.projType === "FIREBALL" &&
        typeof this.target.fireTimer !== "undefined"
      ) {
        this.target.fireTimer = 4.0;
      }
      this.active = false;
    } else {
      const dx = this.target.pos.x - this.pos.x,
        dy = this.target.pos.y - this.pos.y,
        d = Math.sqrt(dx * dx + dy * dy);
      this.pos.x += (dx / d) * this.speed;
      this.pos.y += (dy / d) * this.speed;
      if (this.projType === "MAGIC_MISSILE" && Game.frames % 2 === 0)
        Game.spawnParticle(this.pos.x, this.pos.y, "#3182ce");
      if (this.projType === "FIREBALL" && Game.frames % 2 === 0)
        Game.spawnParticle(this.pos.x, this.pos.y, "#e53e3e");
    }
  }
  draw(ctx) {
    if (this.projType === "MAGIC_MISSILE") {
      ctx.fillStyle = "#ecc94b";
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3182ce";
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.projType === "ARROW") {
      ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.rotate(
        Math.atan2(
          this.target.pos.y - this.pos.y,
          this.target.pos.x - this.pos.x,
        ),
      );
      ctx.fillStyle = "#5c4530";
      ctx.fillRect(-6, -1, 12, 2);
      ctx.restore();
    } else if (this.projType === "FIREBALL") {
      const sp = SpriteCache.get("🔥", 24, false, false);
      ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);
    } else if (this.projType === "LAVA_ROCK") {
      const sp = SpriteCache.get("🔴", 16, false, false);
      ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);
    } else {
      ctx.fillStyle = "#718096";
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export class Tombstone extends Entity {
  constructor(x, y, n, gN, l, k) {
    super(x, y);
    this.isStatic = true;
    this.type = "TOMBSTONE";
    this.name = n;
    this.guildName = gN;
    this.level = l;
    this.kills = k;
    this.radius = 15;
  }
  draw(ctx) {
    const outC =
      Game.selectedEntity === this
        ? "#ecc94b"
        : Game.hoveredEntity === this
          ? "#90ee90"
          : null;
    const sp = SpriteCache.get("🪦", 30, true, true, outC);
    ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);
  }
}

export class Trap extends Entity {
  constructor(x, y) {
    super(x, y);
    this.isStatic = true;
    this.faction = "PLAYER";
    this.type = "TRAP";
    this.hp = this.maxHp = 1;
    this.radius = 10;
  }
  update(dtSec) {
    const rats = Grid.getNearby(this.pos, 900, "ENEMY");
    for (let i = 0; i < rats.length; i++) {
      if (rats[i].monsterType === "RAT") {
        rats[i].takeDamage(rats[i].hp, this);
        this.die();
        break;
      }
    }
  }
  takeDamage(amt, source) {
    if (!this.active) return;
    if (source && source.monsterType === "RAT")
      source.takeDamage(source.hp, this);
    super.takeDamage(amt, source);
  }
  draw(ctx) {
    const outC =
      Game.selectedEntity === this
        ? "#ecc94b"
        : Game.hoveredEntity === this
          ? "#90ee90"
          : null;
    const sp = SpriteCache.get("🪤", 24, true, true, outC);
    ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);
  }
}
