import { WORLD_WIDTH, WORLD_HEIGHT } from "../config/constants.js";

export class Vec2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    return new Vec2(this.x + v.x, this.y + v.y);
  }
  sub(v) {
    return new Vec2(this.x - v.x, this.y - v.y);
  }
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  norm() {
    const m = this.mag();
    return m === 0 ? new Vec2(0, 0) : new Vec2(this.x / m, this.y / m);
  }
  mult(n) {
    return new Vec2(this.x * n, this.y * n);
  }
  dist(v) {
    return this.sub(v).mag();
  }
  distSq(v) {
    return (this.x - v.x) ** 2 + (this.y - v.y) ** 2;
  }
}

export const GameBounds = {
  getMain() {
    return {
      x1: 150,
      x2: WORLD_WIDTH - 150,
      y1: 150,
      y2: WORLD_HEIGHT - 150,
    };
  },
  getCorridor(dir) {
    const mw = WORLD_WIDTH,
      mh = WORLD_HEIGHT;
    const w = 400,
      h = 800;
    const cx = mw / 2,
      cy = mh / 2;
    const overlap = 50;
    switch (dir) {
      case "NORTH":
        return {
          x1: cx - w / 2,
          x2: cx + w / 2,
          y1: 150 - h,
          y2: 150 + overlap,
        };
      case "SOUTH":
        return {
          x1: cx - w / 2,
          x2: cx + w / 2,
          y1: mh - 150 - overlap,
          y2: mh - 150 + h,
        };
      case "EAST":
        return {
          x1: mw - 150 - overlap,
          x2: mw - 150 + h,
          y1: cy - w / 2,
          y2: cy + w / 2,
        };
      case "WEST":
        return {
          x1: 150 - h,
          x2: 150 + overlap,
          y1: cy - w / 2,
          y2: cy + w / 2,
        };
    }
  },
  getAllRects() {
    return [
      this.getMain(),
      this.getCorridor("NORTH"),
      this.getCorridor("SOUTH"),
      this.getCorridor("EAST"),
      this.getCorridor("WEST"),
    ];
  },
  clamp(x, y, radius = 0) {
    const rects = this.getAllRects();
    let inRect = false;
    for (let r of rects) {
      if (
        x >= r.x1 + radius &&
        x <= r.x2 - radius &&
        y >= r.y1 + radius &&
        y <= r.y2 - radius
      ) {
        inRect = true;
        break;
      }
    }
    if (inRect) return new Vec2(x, y);

    let closest = new Vec2(x, y);
    let minDist = Infinity;
    for (let r of rects) {
      const cx = Math.max(r.x1 + radius, Math.min(x, r.x2 - radius));
      const cy = Math.max(r.y1 + radius, Math.min(y, r.y2 - radius));
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < minDist) {
        minDist = d;
        closest = new Vec2(cx, cy);
      }
    }
    return closest;
  },
};
