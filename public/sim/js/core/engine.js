import { WORLD_WIDTH, WORLD_HEIGHT } from "../config/constants.js";
import { Vec2 } from "./math.js";

export const Camera = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  zoom: 1.0,
  targetZoom: 1.0,
};

export const SpriteCache = {
  cache: new Map(),
  get(icon, size, drawShadow = false, stroke = false, outlineColor = null) {
    const key = `${icon}_${size}_${drawShadow}_${stroke}_${outlineColor}`;
    if (!this.cache.has(key)) {
      const c = document.createElement("canvas");
      const pad = drawShadow || outlineColor ? 15 : 5;
      c.width = size + pad * 2;
      c.height = size + pad * 2;
      const ctx = c.getContext("2d");
      const cx = c.width / 2,
        cy = c.height / 2;
      ctx.font = `${size}px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (outlineColor) {
        const sil = document.createElement("canvas");
        sil.width = c.width;
        sil.height = c.height;
        const sCtx = sil.getContext("2d");
        sCtx.font = ctx.font;
        sCtx.textAlign = ctx.textAlign;
        sCtx.textBaseline = ctx.textBaseline;
        sCtx.fillStyle = "black";
        sCtx.fillText(icon, cx, cy);
        const imgData = sCtx.getImageData(0, 0, sil.width, sil.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
          }
        }
        sCtx.putImageData(imgData, 0, 0);
        ctx.save();
        const offsets = [
          [-2, 0],
          [2, 0],
          [0, -2],
          [0, 2],
          [-2, -2],
          [2, 2],
          [-2, 2],
          [2, -2],
        ];
        offsets.forEach(([ox, oy]) => {
          ctx.drawImage(sil, ox, oy);
        });
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = outlineColor;
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "source-over";
        ctx.restore();
      }
      if (drawShadow) {
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }
      ctx.fillStyle = "white";
      ctx.fillText(icon, cx, cy);
      if (drawShadow) {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
      if (stroke) {
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeText(icon, cx, cy);
      }
      this.cache.set(key, c);
    }
    return this.cache.get(key);
  },
  getAshpit(radius) {
    const key = "ashpit_" + radius;
    if (!this.cache.has(key)) {
      const c = document.createElement("canvas");
      c.width = radius * 2 + 20;
      c.height = radius * 2 + 20;
      const ctx = c.getContext("2d");
      const cx = radius,
        cy = radius;
      ctx.fillStyle = "rgba(20, 20, 20, 0.6)";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * (radius * 0.85);
        const br = 4 + Math.random() * 8;
        ctx.fillStyle = "rgba(40, 40, 40, 0.7)";
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, br, 0, Math.PI * 2);
        ctx.fill();
      }
      this.cache.set(key, c);
    }
    return this.cache.get(key);
  },
};

export const Grid = {
  cellSize: 100,
  cells: new Map(),
  offsetX: 1500,
  offsetY: 1500,
  clear() {
    this.cells.clear();
  },
  insert(e) {
    if (!e.pos) return;
    const cx = Math.floor((e.pos.x + this.offsetX) / this.cellSize),
      cy = Math.floor((e.pos.y + this.offsetY) / this.cellSize);
    const k = cx + "," + cy;
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k).push(e);
  },
  getNearby(pos, rSq, faction) {
    const res = [],
      r = Math.sqrt(rSq);
    const minX = Math.max(
        0,
        Math.floor((pos.x - r + this.offsetX) / this.cellSize),
      ),
      maxX = Math.min(
        100,
        Math.floor((pos.x + r + this.offsetX) / this.cellSize),
      ),
      minY = Math.max(
        0,
        Math.floor((pos.y - r + this.offsetY) / this.cellSize),
      ),
      maxY = Math.min(
        100,
        Math.floor((pos.y + r + this.offsetY) / this.cellSize),
      );
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const arr = this.cells.get(cx + "," + cy);
        if (arr) {
          for (let i = 0; i < arr.length; i++) {
            const e = arr[i];
            if (e.active && e.faction === faction) {
              if (pos.distSq(e.pos) <= rSq) res.push(e);
            }
          }
        }
      }
    }
    return res;
  },
};
