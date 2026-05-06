import { BUILDING_CONFIG, UI, ITEM_CONFIG } from "../config/constants.js";
import { Vec2 } from "../core/math.js";
import { SpriteCache, Grid } from "../core/engine.js";
import { Entity } from "./Entity.js";
export class Building extends Entity {
  constructor(x, y, t) {
    super(x, y);
    this.isStatic = true;
    this.faction = "PLAYER";
    this.type = t;
    this.heroes = [];
    this.maxHeroes = 3;
    this.upgrades = [];
    const c = BUILDING_CONFIG[t];
    this.hp = this.maxHp = c ? c.hp : 100;
    this.radius = c ? c.radius : 25;
    this.isRepairing = false;
    this.repairTimer = 0;
    this.fireTimer = 0;
    if (t === "SHOP") this.slots = ["NONE", "NONE", "NONE"];
    else if (t === "TOWER") {
      this.attackRange = 250;
      this.attackCooldown = 0;
      this.target = null;
    } else if (t === "TAVERN") {
      this.groups = [null, null, null];
    }
    this.isUpgraded = false;

    if (c && c.yOffset) {
      this.hitboxOffset = { x: 0, y: -c.yOffset / 2 };
    }
  }
  getVisionRange() {
    return BUILDING_CONFIG[this.type] ? BUILDING_CONFIG[this.type].vision : 200;
  }
  update(dtSec) {
    if (this.fireTimer > 0) this.fireTimer -= dtSec;

    if (this.isRepairing) {
      if (this.hp >= this.maxHp) {
        this.hp = this.maxHp;
        this.isRepairing = false;
      } else {
        this.repairTimer += dtSec;
        if (this.repairTimer >= 2.0) {
          this.repairTimer = 0;
          if (Game.gold >= 10) {
            Game.gold -= 10;
            this.hp = Math.min(this.maxHp, this.hp + 30);
            Game.spawnFloatingText(
              this.pos.x - 15,
              this.pos.y - 40,
              "-10g",
              "#e53e3e",
            );
            Game.spawnFloatingText(
              this.pos.x + 15,
              this.pos.y - 40,
              "+30 HP",
              "#48bb78",
            );
          } else {
            this.isRepairing = false;
          }
        }
      }
    }

    if (this.type === "TOWER") {
      if (this.attackCooldown > 0) this.attackCooldown -= dtSec;

      if (this.attackCooldown <= 0) {
        const enemies = Grid.getNearby(
          this.pos,
          this.attackRange ** 2,
          "ENEMY",
        );
        let validEnemies = [];
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (
            e.isVisible &&
            e.type !== "SPAWNER" &&
            this.pos.distSq(e.pos) <= this.attackRange ** 2
          ) {
            validEnemies.push(e);
          }
        }

        if (validEnemies.length > 0) {
          validEnemies.sort(
            (a, b) => this.pos.distSq(a.pos) - this.pos.distSq(b.pos),
          );
          const targetsToShoot = this.isUpgraded
            ? Math.min(3, validEnemies.length)
            : 1;

          for (let i = 0; i < targetsToShoot; i++) {
            Game.projectiles.push(
              new Projectile(
                this.pos.x,
                this.pos.y - 20,
                validEnemies[i],
                20,
                this,
                "MAGIC_MISSILE",
              ),
            );
          }
          this.attackCooldown = 1.0;
        }
      }
    }
  }
  draw(ctx) {
    const conf = BUILDING_CONFIG[this.type];
    if (conf) {
      ctx.save();
      ctx.fillStyle = "#3e2723";
      ctx.beginPath();
      ctx.ellipse(
        this.pos.x,
        this.pos.y + conf.yOffset,
        conf.foundationRx,
        conf.foundationRy,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();

      const iconToDraw =
        this.isUpgraded && conf.upgradedIcon ? conf.upgradedIcon : conf.icon;
      const outC =
        Game.selectedEntity === this
          ? "#ecc94b"
          : Game.hoveredEntity === this
            ? "#90ee90"
            : null;
      const sp = SpriteCache.get(
        iconToDraw,
        parseInt(conf.fontSize),
        true,
        true,
        outC,
      );
      ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);

      if (this.type === "TOWER") {
        const hY = Math.sin(Game.timeMs * 0.006) * 4;
        const topIcon = this.isUpgraded ? "🚦" : "🖲️";
        const tSp = SpriteCache.get(topIcon, 26);
        ctx.drawImage(
          tSp.img,
          this.pos.x - tSp.ox,
          this.pos.y - 20 + hY - tSp.oy,
        );
      }
      if (this.type === "TAVERN") {
        const bSp = SpriteCache.get("🍻", 28, false, false);
        ctx.drawImage(bSp.img, this.pos.x - bSp.ox, this.pos.y + 10 - bSp.oy);
      }
      if (conf.isGuild) {
        if (this.heroes.length < this.maxHeroes) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 16px Arial";
          ctx.fillStyle = "#ecc94b";
          ctx.strokeStyle = "black";
          ctx.lineWidth = 3;
          const text = `${this.heroes.length}/${this.maxHeroes}`;
          ctx.strokeText(text, this.pos.x, this.pos.y - 55);
          ctx.fillText(text, this.pos.x, this.pos.y - 55);
        }
        if (this.heroes.some((h) => h.isDead)) {
          const pY = Math.sin(Game.timeMs * 0.008) * 5;
          const pSp = SpriteCache.get("🙏", 28, false, false);
          ctx.drawImage(
            pSp.img,
            this.pos.x - pSp.ox,
            this.pos.y - 75 + pY - pSp.oy,
          );
        }
      }
    }

    if (this.fireTimer > 0) {
      const bounce = Math.abs(Math.sin(Game.timeMs * 0.01)) * 15;
      const fSp = SpriteCache.get("🔥", 40, false, false);
      ctx.drawImage(
        fSp.img,
        this.pos.x - fSp.ox,
        this.pos.y - this.radius - 15 - bounce - fSp.oy,
      );
    }

    if (this.isRepairing && this.hp < this.maxHp) {
      const hoverY = Math.abs(Math.sin(Game.timeMs * 0.01)) * 8;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(this.pos.x + 15, this.pos.y - 30, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const rSp = SpriteCache.get("🛠️", 24, false, false);
      ctx.drawImage(
        rSp.img,
        this.pos.x + 15 - rSp.ox,
        this.pos.y - 30 - hoverY - rSp.oy,
      );
    }

    let hpOff = -this.radius - 5;
    if (this.type === "TOWER") hpOff -= 25;
    else if (conf && conf.isGuild) hpOff -= 15;
    let hH = [];
    for (let i = 0; i < Game.activeHeroes.length; i++) {
      if (Game.activeHeroes[i].isHealingAt === this)
        hH.push(Game.activeHeroes[i]);
    }
    if (hH.length > 0) {
      const hY = Math.sin(Game.timeMs * 0.005) * 5;
      hH.forEach((h, i) => {
        const e =
          h.classType === "WARRIOR"
            ? "🧌"
            : h.classType === "ROGUE"
              ? "🥷"
              : "🧚";
        const off = (i - (hH.length - 1) / 2) * 30,
          bX = this.pos.x + off,
          bY = this.pos.y + hpOff - 25 + hY;
        const hSp = SpriteCache.get(e, 24);
        ctx.drawImage(hSp.img, bX - hSp.ox, bY - hSp.oy);
        const bSp = SpriteCache.get("🩹", 14, false, false);
        ctx.drawImage(bSp.img, bX + 12 - bSp.ox, bY - 5 - bSp.oy);
      });
    }
    this.drawHP(ctx, hpOff);
  }
  die() {
    super.die();
    if (this.type === "CASTLE") {
      Game.gameOver = true;
      Game.showStatsScreen(true);
    } else {
      Game.buildingDeaths++;
    }
  }
}

export class Flag extends Entity {
  constructor(x, y, t, tE = null, sourceTav = null) {
    super(x, y);
    this.isStatic = true;
    this.type = t;
    this.bounty = t === "FLAG_EXPLORE" ? 25 : t === "FLAG_DEFEND" ? 50 : 75;
    this.targetEntity = tE;
    this.maxTimer = 20.0;
    this.defendTimer = 20.0;
    this.name =
      t === "FLAG_EXPLORE"
        ? "Explore Quest ⚑"
        : t === "FLAG_DEFEND"
          ? "Defend Quest ⚑"
          : t === "FLAG_GROUP_ATTACK"
            ? "Group Quest ⚑"
            : "Attack Quest ⚑";
    this.sourceTavern = sourceTav;
    this.radius = 20;
    this.hitboxOffset = { x: 0, y: -15 };
  }
  update(dtSec) {
    if (this.targetEntity) {
      if (!this.targetEntity.active) this.active = false;
      else {
        this.pos.x = this.targetEntity.pos.x;
        this.pos.y = this.targetEntity.pos.y - 30;
      }
    }
    if (this.active) {
      let ass = [];
      let fleeingCount = 0;
      let readyCount = 0;
      let atTargCount = 0;
      let defs = [];
      let totalHeroesNoGroup = 0;
      let druidCountAssigned = 0;

      for (let i = 0; i < Game.activeHeroes.length; i++) {
        const h = Game.activeHeroes[i];
        if (!h.groupId) totalHeroesNoGroup++;
        if (h.currentQuest === this) {
          ass.push(h);
          if (h.state === "FLEE") fleeingCount++;
          if (
            ["WAITING_FOR_GROUP", "MOVE_TO_TARGET", "AT_TARGET"].includes(
              h.questPhase,
            )
          )
            readyCount++;
          if (h.questPhase === "AT_TARGET") atTargCount++;
          if (h.classType === "DRUID") druidCountAssigned++;
          if (
            this.type === "FLAG_DEFEND" &&
            this.targetEntity &&
            h.pos.distSq(this.targetEntity.pos) < 2500
          )
            defs.push(h);
        }
      }

      if (this.type === "FLAG_GROUP_ATTACK") {
        if (ass.length === 0) {
          let availableGroups = [];
          if (
            this.sourceTavern &&
            this.sourceTavern.active &&
            this.sourceTavern.groups
          ) {
            for (let i = 0; i < 3; i++) {
              let g = this.sourceTavern.groups[i];
              if (g && g.length > 0) {
                let groupMembers = [];
                for (let j = 0; j < g.length; j++)
                  if (!g[j].isDead) groupMembers.push(g[j]);
                if (
                  groupMembers.length > 0 &&
                  groupMembers.every((h) => !h.currentQuest)
                ) {
                  availableGroups.push(groupMembers);
                }
              }
            }
          }
          if (availableGroups.length > 0) {
            availableGroups.sort(
              (a, b) => a[0].pos.distSq(this.pos) - b[0].pos.distSq(this.pos),
            );
            let chosenGroup = availableGroups[0];
            chosenGroup.forEach((h) => {
              h.currentQuest = this;
              h.questPhase =
                h.target && h.target.faction === "ENEMY"
                  ? "FINISH_COMBAT"
                  : "HEAL_AT_BASE";
            });
          }
        } else {
          let maxReq = ass.length;
          if (fleeingCount >= Math.max(1, Math.floor(maxReq / 2))) {
            ass.forEach((a) => {
              a.currentQuest = null;
              a.questPhase = "NONE";
              a.target = a.tavern && a.tavern.active ? a.tavern : Game.base;
              a.state = "FLEE";
            });
            this.active = false;
            return;
          }
          if (readyCount >= maxReq) {
            ass.forEach((a) => {
              if (a.questPhase === "WAITING_FOR_GROUP")
                a.questPhase = "MOVE_TO_TARGET";
            });
          }

          if (atTargCount >= maxReq) {
            const tp = this.targetEntity ? this.targetEntity.pos : this.pos;
            const threats = Grid.getNearby(tp, 40000, "ENEMY");
            let isClear = true;
            for (let i = 0; i < threats.length; i++)
              if (threats[i].isVisible) isClear = false;

            if (isClear) {
              const s = Math.floor(this.bounty / Math.max(1, ass.length));
              ass.forEach((a) => {
                a.personalGold += s;
                a.lifetimeGold += s;
                a.gainXp(15);
                Game.spawnParticle(a.pos.x, a.pos.y, "#e53e3e");
                a.currentQuest = null;
                a.questPhase = "NONE";
                a.state = "IDLE";
              });
              this.active = false;
            }
          }
        }
        return;
      }

      const maxReq =
        this.type === "FLAG_EXPLORE"
          ? 1
          : Math.min(3, Math.max(1, totalHeroesNoGroup));
      if (maxReq === 0) return;

      if (ass.length < maxReq) {
        let av = [];
        for (let i = 0; i < Game.activeHeroes.length; i++) {
          const h = Game.activeHeroes[i];
          if (!h.currentQuest && !h.groupId) {
            if (this.type === "FLAG_EXPLORE" && h.classType === "DRUID")
              continue;
            if (
              this.type === "FLAG_ATTACK" &&
              h.classType === "DRUID" &&
              druidCountAssigned >= 1
            )
              continue;
            av.push(h);
          }
        }
        if (av.length > 0) {
          if (this.type === "FLAG_ATTACK") {
            av.sort((a, b) => {
              let scoreA =
                (10000 / Math.max(1, a.pos.distSq(Game.base.pos))) *
                (a.hp / a.maxHp);
              let scoreB =
                (10000 / Math.max(1, b.pos.distSq(Game.base.pos))) *
                (b.hp / b.maxHp);
              return scoreB - scoreA;
            });
          } else {
            av.sort((a, b) => {
              let getS = (h) =>
                h.target && h.target.faction === "ENEMY"
                  ? 2
                  : h.state === "IDLE"
                    ? 0
                    : 1;
              return (
                getS(a) - getS(b) ||
                b.hp / b.maxHp - a.hp / a.maxHp ||
                a.pos.distSq(this.pos) - b.pos.distSq(this.pos)
              );
            });
          }
          while (ass.length < maxReq && av.length > 0) {
            let h = av.shift();
            h.currentQuest = this;
            h.questPhase =
              h.target && h.target.faction === "ENEMY"
                ? "FINISH_COMBAT"
                : "HEAL_AT_BASE";
            ass.push(h);
            if (h.classType === "DRUID") druidCountAssigned++;
          }
        }
      }
      if (this.type === "FLAG_DEFEND") {
        if (defs.length > 0) {
          this.defendTimer -= dtSec;
          if (this.defendTimer <= 0) {
            const s = Math.floor(this.bounty / defs.length);
            defs.forEach((d) => {
              d.personalGold += s;
              d.lifetimeGold += s;
              d.gainXp(15);
              Game.spawnParticle(d.pos.x, d.pos.y, "#ecc94b");
              d.currentQuest = null;
              d.questPhase = "NONE";
              d.state = "IDLE";
            });
            this.active = false;
          }
        }
      } else if (this.type === "FLAG_ATTACK") {
        const fleeLimit = maxReq === 3 ? 2 : 1;
        if (fleeingCount >= fleeLimit) {
          ass.forEach((a) => {
            a.currentQuest = null;
            a.questPhase = "NONE";
            a.target =
              a.guild.active && a.guild.upgrades.includes("MED_TENT")
                ? a.guild
                : Game.base;
            a.state = "FLEE";
          });
          this.active = false;
          return;
        }
        if (ass.length >= maxReq) {
          if (readyCount >= maxReq) {
            ass.forEach((a) => {
              if (a.questPhase === "WAITING_FOR_GROUP")
                a.questPhase = "MOVE_TO_TARGET";
            });
          }

          if (atTargCount >= maxReq) {
            const tp = this.targetEntity ? this.targetEntity.pos : this.pos;
            const threats = Grid.getNearby(tp, 40000, "ENEMY");
            let isClear = true;
            for (let i = 0; i < threats.length; i++)
              if (threats[i].isVisible) isClear = false;

            if (isClear) {
              const s = Math.floor(this.bounty / Math.max(1, ass.length));
              ass.forEach((a) => {
                a.personalGold += s;
                a.lifetimeGold += s;
                a.gainXp(15);
                Game.spawnParticle(a.pos.x, a.pos.y, "#e53e3e");
                a.currentQuest = null;
                a.questPhase = "NONE";
                a.state = "IDLE";
              });
              this.active = false;
            }
          }
        }
      }
    }
  }
  draw(ctx) {
    const isHovered = Game.hoveredEntity === this;
    const isSelected = Game.selectedEntity === this;
    if (isHovered || isSelected) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.pos.x + 8, this.pos.y - 20, 25, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? "rgba(236,201,75,0.2)"
        : "rgba(144,238,144,0.2)";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ecc94b" : "#90ee90";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y);
    ctx.lineTo(this.pos.x, this.pos.y - 30);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y - 30);
    ctx.lineTo(this.pos.x + 15, this.pos.y - 22);
    ctx.lineTo(this.pos.x, this.pos.y - 15);
    ctx.fillStyle =
      this.type === "FLAG_ATTACK" || this.type === "FLAG_GROUP_ATTACK"
        ? "#e53e3e"
        : this.type === "FLAG_DEFEND"
          ? "#3182ce"
          : "#ecc94b";
    ctx.fill();
    if (this.type === "FLAG_GROUP_ATTACK") {
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("🍻", this.pos.x + 18, this.pos.y - 22);
    }
    if (this.type === "FLAG_DEFEND") {
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, 40, 0, Math.PI * 2);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = "rgba(49,130,206,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    let assCount = 0;
    let totalHNoGroup = 0;
    for (let i = 0; i < Game.activeHeroes.length; i++) {
      if (Game.activeHeroes[i].currentQuest === this) assCount++;
      if (!Game.activeHeroes[i].groupId) totalHNoGroup++;
    }
    const maxR =
      this.type === "FLAG_EXPLORE"
        ? 1
        : this.type === "FLAG_GROUP_ATTACK"
          ? assCount
          : Math.min(3, Math.max(1, totalHNoGroup));

    ctx.fillStyle = "white";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${assCount}/${maxR}`, this.pos.x, this.pos.y - 35);
    if (this.type === "FLAG_DEFEND" && this.defendTimer < 20) {
      ctx.fillStyle = "#ecc94b";
      ctx.font = "bold 12px Arial";
      ctx.fillText(
        `${Math.ceil(this.defendTimer)}s`,
        this.pos.x,
        this.pos.y - 48,
      );
    }
  }
}

export class Spawner extends Entity {
  constructor(x, y, t = "RAT_HOLE") {
    super(x, y);
    this.isStatic = true;
    this.spawnerType = t;
    this.name =
      t === "WEB"
        ? "Spider Web"
        : t === "SNAKE_NEST"
          ? "Snake Nest"
          : "Rat Hole";
    this.faction = "ENEMY";
    this.type = "SPAWNER";
    this.hp = this.maxHp = t === "SNAKE_NEST" ? 400 : 150;

    const mainB = GameBounds.getMain();
    this.inCorridor =
      x < mainB.x1 || x > mainB.x2 || y < mainB.y1 || y > mainB.y2;

    if (this.inCorridor) {
      this.maxHp += 25;
      this.hp += 25;
    }
    this.daysSurvived = 0;

    this.baseRadius = t === "SNAKE_NEST" ? 15 : 20;
    this.radius = this.baseRadius;
    this.spawnRate = t === "SNAKE_NEST" ? 14.0 : 8.0;
    this.spawnTimer = Math.random() * this.spawnRate;
  }
  update(dtSec) {
    const inBlackout = Game.dayTimer <= 10.0;
    if (!inBlackout) {
      this.spawnTimer += dtSec;
      if (this.spawnTimer >= this.spawnRate) {
        this.spawnTimer = 0;
        const spawnCount = this.inCorridor
          ? 1
          : 1 + Math.floor(Math.random() * (this.daysSurvived + 1));
        for (let i = 0; i < spawnCount; i++) {
          const mx = this.pos.x + (Math.random() - 0.5) * 10;
          const my = this.pos.y + (Math.random() - 0.5) * 10;
          Game.addEntity(
            new Monster(
              mx,
              my,
              this.spawnerType === "WEB"
                ? "SPIDER"
                : this.spawnerType === "SNAKE_NEST"
                  ? "SNAKE"
                  : "RAT",
              this.daysSurvived,
            ),
          );
        }
      }
    }
  }
  die() {
    if (!this.active) return;
    super.die();
    Game.spawnersKilled++;

    const validAttackers = [];
    this.attackers.forEach((a) => {
      if (a.active) validAttackers.push(a);
    });

    if (validAttackers.length > 0) {
      const gY = 50;
      const tA = Math.floor(gY * Game.taxRate);
      const hA = gY - tA;
      Game.gold += tA;

      const sharedGold = Math.floor(hA / validAttackers.length);
      const sharedXpBase = Math.floor(50 / validAttackers.length) || 1;

      validAttackers.forEach((hero) => {
        const xpGain = Math.floor(
          sharedXpBase * (hero.currentQuest ? 1.2 : 1.0),
        );
        hero.gainXp(xpGain);
        hero.personalGold += sharedGold;
        hero.lifetimeGold += sharedGold;
      });

      for (let i = 0; i < Game.activeFlags.length; i++) {
        const f = Game.activeFlags[i];
        if (
          ["FLAG_ATTACK", "FLAG_GROUP_ATTACK"].includes(f.type) &&
          f.targetEntity === this
        ) {
          const bountyShare = Math.floor(f.bounty / validAttackers.length);
          for (let j = 0; j < validAttackers.length; j++) {
            validAttackers[j].personalGold += bountyShare;
            validAttackers[j].lifetimeGold += bountyShare;
          }
          f.active = false;
        }
      }
    }
    for (let i = 0; i < 2; i++)
      Game.spawnParticle(this.pos.x, this.pos.y, "#ecc94b");
  }
  draw(ctx) {
    const scale = this.radius / this.baseRadius;
    ctx.save();
    ctx.fillStyle = "#3e2723";
    ctx.beginPath();
    ctx.ellipse(
      this.pos.x,
      this.pos.y + 15 * scale,
      25 * scale,
      10 * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
    const ic =
      this.spawnerType === "WEB"
        ? "🕸️"
        : this.spawnerType === "SNAKE_NEST"
          ? "🪹"
          : "🕳️";

    const outC =
      Game.selectedEntity === this
        ? "#ecc94b"
        : Game.hoveredEntity === this
          ? "#90ee90"
          : null;
    const sp = SpriteCache.get(
      ic,
      40 + this.daysSurvived * 4,
      true,
      true,
      outC,
    );
    ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);
    this.drawHP(ctx, -25 - this.daysSurvived * 2);
  }
}

export class Volcano extends Entity {
  constructor(x, y) {
    super(x, y);
    this.isStatic = true;
    this.spawnerType = "VOLCANO";
    this.name = "Volcano";
    this.faction = "ENEMY";
    this.type = "SPAWNER";
    this.hp = this.maxHp = 1500;
    this.radius = 40;
    this.attackTimer = 40.0;
    this.towerAttackTimer = 1.5;
    this.towerDamage = 30;
    this.attackRange = 110;
    this.lastTowerTarget = null;
    this.ashRadius = 110;
  }
  update(dtSec) {
    if (this.stunTimer > 0) {
      this.stunTimer -= dtSec;
      return;
    }
    this.attackTimer -= dtSec;
    if (this.attackTimer <= 0) {
      this.attackTimer = 40.0;
      let targets = [];
      for (let i = 0; i < Game.playerEntities.length; i++) {
        if (BUILDING_CONFIG[Game.playerEntities[i].type])
          targets.push(Game.playerEntities[i]);
      }
      if (targets.length > 0) {
        targets.sort(() => Math.random() - 0.5);
        const hitCount = Math.min(3, targets.length);
        const dmg = 40;
        for (let i = 0; i < hitCount; i++) {
          Game.projectiles.push(
            new Projectile(
              this.pos.x + (Math.random() - 0.5) * 40,
              this.pos.y - 40 + (Math.random() - 0.5) * 40,
              targets[i],
              dmg,
              this,
              "FIREBALL",
            ),
          );
        }
        Game.spawnFloatingText(
          this.pos.x,
          this.pos.y - 60,
          "ERUPTION!",
          "#e53e3e",
          2.0,
          24,
        );
      }
    }

    this.towerAttackTimer -= dtSec;
    if (this.towerAttackTimer <= 0) {
      this.towerAttackTimer = 1.5;
      let possibleTargets = [];
      let backupTargets = [];
      const arSq = this.attackRange ** 2;
      for (let i = 0; i < Game.activeHeroes.length; i++) {
        const h = Game.activeHeroes[i];
        if (!h.isDead && h.state !== "FLEE" && this.pos.distSq(h.pos) <= arSq) {
          backupTargets.push(h);
          if (h !== this.lastTowerTarget) possibleTargets.push(h);
        }
      }
      if (possibleTargets.length === 0) possibleTargets = backupTargets;

      if (possibleTargets.length > 0) {
        const target =
          possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        this.lastTowerTarget = target;
        Game.projectiles.push(
          new Projectile(
            this.pos.x,
            this.pos.y - 40,
            target,
            this.towerDamage,
            this,
            "LAVA_ROCK",
          ),
        );
      }
    }
  }
  die() {
    if (!this.active) return;
    super.die();
    Game.spawnersKilled++;

    const validAttackers = [];
    this.attackers.forEach((a) => {
      if (a.active) validAttackers.push(a);
    });

    if (validAttackers.length > 0) {
      const share = this.maxHp / validAttackers.length;
      validAttackers.forEach((a) => {
        if (a.faction === "PLAYER" && a.classType) {
          a.personalGold += share;
          a.lifetimeGold += share;
          Game.spawnParticle(a.pos.x, a.pos.y, "#ecc94b");
        }
      });
    }
    for (let i = 0; i < 30; i++)
      Game.spawnParticle(this.pos.x, this.pos.y, "#e53e3e");
  }
}
