        const sp = SpriteCache.get(ic, this.baseFontSize, true, true, outC);
        ctx.drawImage(sp.img, dX - sp.ox, dY - sp.oy);
        this.drawHP(ctx, -20);
    }
}

class Hero extends Unit {
    constructor(x, y, cT, g) {
        super(x, y); this.faction = 'PLAYER'; this.classType = cT; this.guild = g; this.state = 'IDLE'; this.wanderAngle = Math.random()*Math.PI*2; this.stateTimer = 0;
        this.chargeCooldown = 0; this.chargeVfxTimer = 0; this.ratTrapCooldown = 0; this.regrowthCooldown = 0; this.regrowthCastVfxTimer = 0; this.regrowthHealVfxTimer = 0;
        this.purchasedItemVfxTimer = 0; this.purchasedItemIcon = ''; this.levelUpVfxTimer = 0;
        this.questPhase = 'NONE'; this.isHealingAt = null; this.level = 1; this.xp = 0; this.kills = 0; this.personalGold = 0; this.lifetimeGold = 0; this.items = []; this.checkThreatTimer = 0;
        this.isDead = false; this.tombstoneEntity = null; this.groupId = null; this.tavern = null;

        if (availableHeroNames.length === 0) { availableHeroNames = [...BASE_HERO_NAMES]; heroGeneration++; }
        this.name = availableHeroNames.splice(Math.floor(Math.random()*availableHeroNames.length), 1)[0] + getHeroSuffix(heroGeneration);

        const hConf = HERO_CONFIG[cT];
        this.hp = this.maxHp = hConf.maxHp;
        this.speed = hConf.speed;
        this.damage = hConf.damage;
        this.maxAttackCooldown = hConf.maxAttackCooldown;
        this.radius = hConf.radius;
        if (hConf.attackRange) this.attackRange = hConf.attackRange;
    }
    getDisplayState() {
        if (this.isDead) return 'Dead';
        if (this.state === 'FLEE') return 'Fleeing';
        if (this.state === 'ATTACK') return 'Attacking';
        if (this.isHealingAt) return 'Healing';
        if (this.questPhase === 'BUY_ITEMS') return 'Buying';
        if (this.questPhase === 'WAITING_FOR_GROUP') return 'Waiting';
        if (this.state === 'MOVE') return 'Moving';
        return 'Idling';
    }
    getVisionRange() { return 150; }
    takeDamage(amt, src) {
        if (!this.active) return;
        let red = this.items.includes('CHAINMAIL')?5:(this.items.includes('ARMOR') || this.items.includes('ROBE_OF_THORNS') || this.items.includes('ROGUES_DISGUISE')?2:0);
        let final = Math.max(1, amt - red);
        if (this.hp - final <= 0 && this.items.includes('ANKH')) {
            this.items.splice(this.items.indexOf('ANKH'),1);
            this.hp=this.maxHp;
            this.purchasedItemVfxTimer = 2.0;
            this.purchasedItemIcon = '☥️';
            if (Game.selectedEntity === this) Game.updateUI(true);
            for(let i=0;i<15;i++) Game.spawnParticle(this.pos.x,this.pos.y,'#ecc94b');
            return;
        }
        super.takeDamage(final, src);

        if (this.items.includes('ROBE_OF_THORNS') && src && src.active && src.faction === 'ENEMY') {
            const thornsDmg = Math.max(1, Math.floor(amt * 0.2));
            src.takeDamage(thornsDmg, this);
        }

        if (this.active && src && src.faction==='ENEMY' && this.state !== 'ATTACK' && this.state !== 'FLEE') { this.target = src; this.state = 'ATTACK'; }
    }
    gainXp(a) {
        this.xp += a;
        if (this.xp >= this.level*100) {
            this.xp -= this.level*100;
            this.level++;
            this.maxHp += 15;
            this.hp = this.maxHp;
            this.damage += 5;
            this.levelUpVfxTimer = 2.5;
            Game.spawnFloatingText(this.pos.x, this.pos.y - 35, 'LEVEL UP!', '#63b3ed', 2.0, 20);
            const colors = ['#ecc94b', '#63b3ed', '#48bb78', '#e2e8f0'];
            for(let i=0; i<15; i++) {
                Game.particles.push({
                    pos: new Vec2(this.pos.x + (Math.random()-0.5)*20, this.pos.y + (Math.random()-0.5)*20),
                    vel: {x: (Math.random()-0.5)*2, y: -(Math.random()*2.5 + 1)},
                    life: 1.0 + Math.random(), maxLife: 2.0, color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
        }
    }
    die() {
        if (!this.active) return;
        super.die();
        this.isDead = true;
        Game.heroDeaths++;
        Game.hallOfFame.push({ name: this.name, classType: this.classType, level: this.level, kills: this.kills, gold: this.lifetimeGold });
        let gN = this.guild.type === 'TAVERN' ? 'Tavern' : (this.guild.type === 'WARRIOR_GUILD' ? 'Warrior' : (this.guild.type === 'ROGUE_GUILD' ? 'Rogue' : 'Druid'));
        if (!this.guild.active) gN = 'Ruined ' + gN;
        this.tombstoneEntity = new Tombstone(this.pos.x, this.pos.y, this.name, gN, this.level, this.kills);
        Game.addEntity(this.tombstoneEntity);
    }
    update(dtSec) {
        if (this.currentQuest && !this.currentQuest.active) { this.currentQuest = null; this.questPhase = 'NONE'; }

        const timers = ['chargeCooldown','chargeVfxTimer','ratTrapCooldown','regrowthCooldown','regrowthCastVfxTimer','regrowthHealVfxTimer','purchasedItemVfxTimer','levelUpVfxTimer','stateTimer','checkThreatTimer'];
        timers.forEach(t => { if(this[t]>0) this[t]-=dtSec; });

        this.inAsh = false;
        for (let i = 0; i < Game.activeSpawners.length; i++) {
            const s = Game.activeSpawners[i];
            if (s.spawnerType === 'VOLCANO' && this.pos.distSq(s.pos) <= s.ashRadius * s.ashRadius) {
                this.inAsh = true;
                break;
            }
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= this.inAsh ? (dtSec * 0.5) : dtSec;
        }

        this.isHealingAt = null;

        const myBase = (this.groupId && this.tavern && this.tavern.active) ? this.tavern : this.guild;
        const hasHeal = this.groupId ? myBase.active : (myBase.active && myBase.upgrades && myBase.upgrades.includes('MED_TENT'));
        const fallbackBase = hasHeal ? myBase : Game.base;

        if (this.hp <= this.maxHp*0.25) {
            const pIdx = this.items.indexOf('POTION');
            if (pIdx !== -1) {
                this.items.splice(pIdx,1);
                this.hp=Math.min(this.maxHp, this.hp+50);
                this.purchasedItemVfxTimer = 2.0;
                this.purchasedItemIcon = '🧪';
                if (Game.selectedEntity === this) Game.updateUI(true);
                Game.spawnParticle(this.pos.x,this.pos.y,'#48bb78');
                if(this.state==='FLEE' && this.hp>=this.maxHp*0.4) this.state='IDLE';
            }
            else if (this.state !== 'FLEE') { if (this.currentQuest) { this.currentQuest=null; this.questPhase='NONE'; } this.state='FLEE'; let bestS = null; if (this.personalGold >= 50) { for(let i=0; i<Game.activeShops.length; i++) { if(Game.activeShops[i].slots.includes('POTION')) { bestS=Game.activeShops[i]; break; } } } this.target = bestS || fallbackBase; }
        }
        if (['IDLE','FLEE'].includes(this.state) || (this.state==='MOVE' && this.target===myBase)) {
            if (hasHeal && myBase.active && this.pos.distSq(myBase.pos) < (myBase.radius+15)**2) {
                if (this.hp < this.maxHp) { this.isHealingAt = myBase; this.hp = Math.min(this.maxHp, this.hp + (this.maxHp*0.1)*dtSec); if (this.hp === this.maxHp) this.state = 'IDLE'; }
            }
            else if (this.state==='FLEE' && this.target === Game.base && this.pos.distSq(Game.base.pos) < (Game.base.radius+15)**2) { if (this.hp < this.maxHp) { this.isHealingAt = Game.base; const healAmt = (this.maxHp*0.1)*dtSec, cost = 20*dtSec; this.hp = Math.min(this.maxHp, this.hp+healAmt); this.personalGold -= cost; Game.emergencyMedicalCosts += cost; if(this.hp===this.maxHp) this.state='IDLE'; } }
        }
        if (myBase.active && this.pos.distSq(myBase.pos) < (myBase.radius+15)**2) {
            if (this.hasAllRequiredItems() && this.personalGold > 0) {
                Game.guildBanks[this.classType] += this.personalGold; this.personalGold = 0; Game.spawnParticle(this.pos.x,this.pos.y,'#ecc94b'); if(this.state==='MOVE' && this.target===myBase) this.state='IDLE';
            } else if (!this.hasAllRequiredItems() && Game.guildBanks[this.classType] > 0 && this.personalGold < 300) {
                let amt = Math.min(Game.guildBanks[this.classType], 300 - this.personalGold); this.personalGold += amt; Game.guildBanks[this.classType] -= amt; Game.spawnParticle(this.pos.x,this.pos.y,'#ecc94b');
            }
        }
        if (this.guild.active && this.classType==='DRUID' && this.regrowthCooldown<=0 && this.guild.upgrades.includes('REGROWTH')) {
            let bestA = null, low = 1.0; for(let i=0; i<Game.activeHeroes.length; i++) { const e = Game.activeHeroes[i]; if(e.hp<e.maxHp && this.pos.distSq(e.pos)<=40000) { if(e.hp/e.maxHp < low) { low = e.hp/e.maxHp; bestA = e; } } }
            if (bestA) { bestA.hp=bestA.maxHp; this.regrowthCooldown=30.0; this.regrowthCastVfxTimer=1.5; bestA.regrowthHealVfxTimer=1.5; for(let i=0;i<5;i++) Game.spawnParticle(bestA.pos.x,bestA.pos.y,'#48bb78'); if(this.state==='MOVE' && this.target===bestA && !this.currentQuest) this.state='IDLE'; }
        }

        if (this.currentQuest && ['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(this.currentQuest.type) && this.state !== 'FLEE') {
            let activeEnemyTarget = null;
            for (let i = 0; i < Game.activeHeroes.length; i++) {
                const h = Game.activeHeroes[i];
                if (h.currentQuest === this.currentQuest && h.target && h.target.active && h.target.faction === 'ENEMY' && (h.state === 'ATTACK' || h.state === 'MOVE')) {
                    activeEnemyTarget = h.target;
                    break;
                }
            }
            if (activeEnemyTarget && this.target !== activeEnemyTarget) {
                this.target = activeEnemyTarget;
                if (this.state !== 'ATTACK') this.state = 'MOVE';
            }
        }

        if (this.currentQuest && this.state !== 'ATTACK' && this.state !== 'FLEE') {
            const chasingEnemy = (this.state === 'MOVE' && this.target && this.target.faction === 'ENEMY' && this.target.active);
            if (!chasingEnemy) {
                if (this.questPhase==='FINISH_COMBAT' && !(this.target && this.target.active && this.target.faction==='ENEMY')) this.questPhase='HEAL_AT_BASE';
                if (this.questPhase==='HEAL_AT_BASE') { if(this.hp<this.maxHp && hasHeal) { this.state='MOVE'; this.target=myBase; if(this.hp>=this.maxHp) this.questPhase='BUY_ITEMS'; } else this.questPhase='BUY_ITEMS'; }
                if (this.questPhase==='BUY_ITEMS') { let s = this.getDesiredShop(); if(s) { this.state='MOVE'; this.target=s; if(this.pos.distSq(s.pos) < (s.radius+15)**2) { this.buyFromShop(s); this.questPhase='WAITING_FOR_GROUP'; } } else this.questPhase='WAITING_FOR_GROUP'; }
                if (this.questPhase==='WAITING_FOR_GROUP') { if (!['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(this.currentQuest.type)) { this.questPhase='DO_QUEST'; } else { this.target=Game.base; this.state='MOVE'; } }
                if (this.questPhase==='DO_QUEST' || this.questPhase==='MOVE_TO_TARGET' || this.questPhase==='AT_TARGET') { this.target = (['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(this.currentQuest.type) && this.currentQuest.targetEntity) ? this.currentQuest.targetEntity : this.currentQuest; this.state='MOVE'; }
            }
        }
        switch(this.state) {
            case 'IDLE':
                if (this.isHealingAt) { this.pos.x = this.isHealingAt.pos.x; this.pos.y = this.isHealingAt.pos.y; break; }
                if (this.hp < this.maxHp*0.7) {
                    const pi = this.items.indexOf('POTION');
                    if(pi!==-1) {
                        this.items.splice(pi,1);
                        this.hp=Math.min(this.maxHp, this.hp+50);
                        this.purchasedItemVfxTimer = 2.0;
                        this.purchasedItemIcon = '🧪';
                        if (Game.selectedEntity === this) Game.updateUI(true);
                        Game.spawnParticle(this.pos.x,this.pos.y,'#48bb78');
                    }
                }
                if (this.stateTimer <= 0) { this.evaluateGoals(myBase, hasHeal); this.stateTimer = 0.5; }
                this.pos.x += Math.cos(this.wanderAngle)*0.2; this.pos.y += Math.sin(this.wanderAngle)*0.2; if(Math.random()<0.05) this.wanderAngle += (Math.random()-0.5);
                break;
            case 'MOVE':
                if (this.isHealingAt) { this.pos.x = this.isHealingAt.pos.x; this.pos.y = this.isHealingAt.pos.y; break; }
                if (!this.target || (this.target.active !== undefined && !this.target.active)) { this.state='IDLE'; break; }
                const dest = this.target.pos || this.target, reached = this.moveTowards(dest);
                if (reached && !(this.target.active !== undefined)) this.state = 'IDLE';
                if (this.currentQuest && (this.target === this.currentQuest || this.target === this.currentQuest.targetEntity || (this.target === Game.base && this.questPhase === 'WAITING_FOR_GROUP'))) {
                    if (this.questPhase === 'WAITING_FOR_GROUP') {
                        if (reached || this.pos.distSq(Game.base.pos) < 2500) { this.pos.x += Math.cos(this.wanderAngle)*0.5; this.pos.y += Math.sin(this.wanderAngle)*0.5; if(Math.random()<0.05) this.wanderAngle+=(Math.random()-0.5); }
                    } else {
                        const tPos = this.currentQuest.targetEntity ? this.currentQuest.targetEntity.pos : this.currentQuest.pos;
                        if (this.currentQuest.type==='FLAG_EXPLORE' && this.questPhase==='DO_QUEST' && (reached || this.pos.distSq(tPos)<400)) { this.personalGold += this.currentQuest.bounty; this.lifetimeGold += this.currentQuest.bounty; this.gainXp(10); Game.spawnParticle(this.pos.x,this.pos.y,'#ecc94b'); this.currentQuest.active=false; this.currentQuest=null; this.questPhase='NONE'; this.state='IDLE'; }
                        else if (this.currentQuest.type==='FLAG_DEFEND' && (reached || this.pos.distSq(tPos)<1600)) {
                            if(this.pos.distSq(tPos)>900) { const dx=tPos.x-this.pos.x, dy=tPos.y-this.pos.y, d=Math.sqrt(dx*dx+dy*dy); if(d>0){this.pos.x+=(dx/d)*0.5; this.pos.y+=(dy/d)*0.5;} } else { this.pos.x += Math.cos(this.wanderAngle)*0.5; this.pos.y += Math.sin(this.wanderAngle)*0.5; if(Math.random()<0.05) this.wanderAngle+=(Math.random()-0.5); }
                        }
                        else if (['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(this.currentQuest.type)) {
                            if (this.questPhase==='MOVE_TO_TARGET' && (reached || this.pos.distSq(tPos) < 22500)) this.questPhase='AT_TARGET';
                            if (this.questPhase==='AT_TARGET') {
                                if(this.pos.distSq(tPos)>10000) { const dx=tPos.x-this.pos.x, dy=tPos.y-this.pos.y, d=Math.sqrt(dx*dx+dy*dy); if(d>0){this.pos.x+=(dx/d)*0.5; this.pos.y+=(dy/d)*0.5;} } else { this.pos.x += Math.cos(this.wanderAngle)*0.5; this.pos.y += Math.sin(this.wanderAngle)*0.5; if(Math.random()<0.05) this.wanderAngle+=(Math.random()-0.5); }
                            }
                        }
                    }
                }
                if (this.target.type === 'SHOP' && (reached || this.pos.distSq(this.target.pos)<625)) { this.buyFromShop(this.target); this.state='IDLE'; }
                if (this.target.faction === 'ENEMY') { const ds = this.pos.distSq(this.target.pos), ar = (this.attackRange + this.target.radius)**2; if(ds<=ar) this.state='ATTACK'; else if(this.classType==='WARRIOR' && (this.guild.active && this.guild.upgrades.includes('CHARGE')) && this.chargeCooldown<=0 && ds<=10000) { const dx=this.target.pos.x-this.pos.x, dy=this.target.pos.y-this.pos.y, d=Math.sqrt(dx*dx+dy*dy); if(d>0){ this.pos.x = this.target.pos.x - (dx/d)*(this.target.radius+this.radius+2); this.pos.y = this.target.pos.y - (dy/d)*(this.target.radius+this.radius+2); } this.target.takeDamage(this.damage, this); this.target.stunTimer=2.0; this.chargeCooldown=20.0; this.chargeVfxTimer=1.0; for(let i=0;i<8;i++) Game.spawnParticle(this.pos.x,this.pos.y,'#a0aec0'); this.state='ATTACK'; } }
                else if (this.questPhase==='NONE'||this.questPhase==='DO_QUEST'||this.questPhase==='MOVE_TO_TARGET'||this.questPhase==='AT_TARGET') {
                    if(this.checkThreatTimer<=0) {
                        this.checkThreatTimer=0.1;
                        let aggroSq = 40000;
                        const enemies = Grid.getNearby(this.pos, aggroSq, 'ENEMY');
                        for(let i=0; i<enemies.length; i++) {
                            if(enemies[i].isVisible || this.pos.distSq(enemies[i].pos) <= 22500) {
                                this.target=enemies[i]; this.state='MOVE'; break;
                            }
                        }
                    }
                }
                if (this.stateTimer <= 0) { this.evaluateGoals(myBase, hasHeal); this.stateTimer = 1.0; }
                break;
            case 'ATTACK':
                if (!this.target || !this.target.active) { this.state='IDLE'; break; }
                if (this.pos.distSq(this.target.pos) > (this.attackRange+this.target.radius+5)**2) { this.state='MOVE'; break; }
                if (this.attackCooldown <= 0) { let d = this.damage, cr = false; if(this.classType==='ROGUE'&&this.items.includes('DAGGER')&&Math.random()<0.05) { d*=2; cr=true; } if(this.classType==='DRUID') Game.projectiles.push(new Projectile(this.pos.x,this.pos.y,this.target,d,this)); else { this.target.takeDamage(d,this); if(cr) Game.spawnParticle(this.target.pos.x,this.target.pos.y,'#e53e3e'); } this.attackCooldown = this.maxAttackCooldown; }
                break;
            case 'FLEE':
                if (this.isHealingAt) { this.pos.x = this.isHealingAt.pos.x; this.pos.y = this.isHealingAt.pos.y; break; }
                if (this.target === Game.base && hasHeal) this.target = myBase;
                if (!this.target || !this.target.active) this.target = fallbackBase;
                if (this.target && this.target.active) { const r = this.moveTowards(this.target.pos); if(this.target.type==='SHOP' && (r || this.pos.distSq(this.target.pos)<625)) { this.buyFromShop(this.target); if(this.hp<this.maxHp*0.4 && !this.items.includes('POTION')) this.target = fallbackBase; else this.state='IDLE'; } if(r || this.pos.distSq(this.target.pos)<(this.target.radius+15)**2) { this.pos.x += Math.cos(this.wanderAngle)*0.2; this.pos.y += Math.sin(this.wanderAngle)*0.2; if(Math.random()<0.05) this.wanderAngle+=(Math.random()-0.5); if(this.target===myBase && hasHeal) { if(this.hp>=this.maxHp) this.state='IDLE'; } else if(this.target===Game.base) { if(this.hp>=this.maxHp) this.state='IDLE'; } else if(this.hp>=this.maxHp*0.6) this.state='IDLE'; } }
                else this.state='IDLE';
                break;
        }

        this.applySoftCollision();
        this.pos = GameBounds.clamp(this.pos.x, this.pos.y, this.radius);
    }
    evaluateGoals(myBase, hasHeal) {
        if (this.currentQuest && !this.currentQuest.active) { this.currentQuest=null; this.questPhase='NONE'; } if (this.currentQuest && this.questPhase!=='NONE' && this.questPhase!=='DO_QUEST') return;

        if (this.groupId) {
            let activeEnemyTarget = null;
            for (let i = 0; i < Game.activeHeroes.length; i++) {
                const h = Game.activeHeroes[i];
                if (h.groupId === this.groupId && h.target && h.target.active && h.target.faction === 'ENEMY') {
                    activeEnemyTarget = h.target;
                    break;
                }
            }
            if (activeEnemyTarget) {
                this.target = activeEnemyTarget;
                this.state = 'MOVE';
                return;
            }
        }

        let bS = -1, bT = null, isQ = false;
        const enemies = Grid.getNearby(this.pos, 40000, 'ENEMY');
        for(let i=0; i<enemies.length; i++) {
            if(!enemies[i].isVisible && this.pos.distSq(enemies[i].pos) > 22500) continue;
            const ds = this.pos.distSq(enemies[i].pos);
            let s = 1000/Math.sqrt(ds);
            if(this.classType==='WARRIOR') s*=2;
            if(s>bS) { bS=s; bT=enemies[i]; }
        }
        if(bT) { this.target=bT; this.state='MOVE'; return; } if(this.currentQuest) return;
        if(this.hp<this.maxHp*0.6 && hasHeal) { const d=Math.sqrt(this.pos.distSq(myBase.pos)); let s=((this.maxHp-this.hp)/this.maxHp)*3000/Math.max(d,10); if(s>bS) { bS=s; bT=myBase; } }
        for(let i=0; i<Game.activeFlags.length; i++) {
            const f = Game.activeFlags[i];
            if (this.groupId && f.type !== 'FLAG_GROUP_ATTACK') continue;
            if (!this.groupId && f.type === 'FLAG_GROUP_ATTACK') continue;

            let totalNoGroup = 0;
            let assCount = 0;
            let betterCandidates = 0;
            const myScore = Math.sqrt(this.pos.distSq(f.pos)) / Math.max(0.01, this.hp / this.maxHp);

            for (let j = 0; j < Game.activeHeroes.length; j++) {
                const e = Game.activeHeroes[j];
                if (!e.groupId) totalNoGroup++;
                if (e.currentQuest === f) assCount++;
                else if (!e.currentQuest && !e.groupId) {
                    const eScore = Math.sqrt(e.pos.distSq(f.pos)) / Math.max(0.01, e.hp / e.maxHp);
                    if (eScore < myScore) betterCandidates++;
                }
            }

            const maxReq = f.type==='FLAG_EXPLORE' ? 1 : Math.min(3, Math.max(1, totalNoGroup));
            if(assCount >= maxReq) continue;
            if(betterCandidates >= maxReq - assCount) continue;

            const d=Math.sqrt(this.pos.distSq(f.pos)); let s=(f.bounty/Math.max(d,10))*10*(this.hp/this.maxHp); if(this.hp/this.maxHp<0.4) s*=0.1; if(this.classType==='ROGUE') s*=3; if(['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(f.type) && this.classType==='WARRIOR') s*=2.5; if(s>bS && s>0.5) { bS=s; bT=f; isQ=true; }
        }
        if(!isQ) { let sO = this.getDesiredShop(); if(sO) { const d=Math.sqrt(this.pos.distSq(sO.pos)); let s=500/Math.max(d,10); if(this.hp<this.maxHp*0.4) s*=5; if(s>bS) { bS=s; bT=sO; } } if(this.hasAllRequiredItems()&&this.personalGold>0 && myBase.active) { const d=Math.sqrt(this.pos.distSq(myBase.pos)); let s=(this.personalGold/Math.max(d,10))*5; if(s>bS) { bS=s; bT=myBase; } } else if(!this.hasAllRequiredItems() && Game.guildBanks[this.classType]>0 && this.personalGold<300 && myBase.active) { const d=Math.sqrt(this.pos.distSq(myBase.pos)); let s=250/Math.max(d,10); if(s>bS) { bS=s; bT=myBase; } } }
        if(bT) { this.target=bT; this.state='MOVE'; } else { const baseP = myBase.active ? myBase.pos : Game.base.pos; this.target = new Vec2(baseP.x+(Math.random()-0.5)*200, baseP.y+(Math.random()-0.5)*200); this.state='MOVE'; }
    }
    getDesiredShop() {
        let bS = null, bSc = -1;
        for(let j=0; j<Game.activeShops.length; j++) {
            const s = Game.activeShops[j];
            let want = false;
            for(let itemId of s.slots) {
                if (itemId === 'NONE') continue;
                const item = ITEM_CONFIG[itemId];
                if (!item || !item.classes.includes(this.classType) || this.items.includes(itemId) || this.personalGold < item.cost) continue;
                if (item.downgradeOf && item.downgradeOf.some(u => this.items.includes(u))) continue;
                want = true; break;
            }
            if(want) { const d=Math.sqrt(this.pos.distSq(s.pos)); let sc=500/Math.max(d,10); if(sc>bSc) { bSc=sc; bS=s; } }
        }
        return bS;
    }
    hasAllRequiredItems() { return HERO_CONFIG[this.classType].requiredItems.every(i => this.items.includes(i)); }
    buyFromShop(s) {
        for(let itemId of s.slots) {
            if (itemId === 'NONE') continue;
            const item = ITEM_CONFIG[itemId];
            if (!item || !item.classes.includes(this.classType) || this.items.includes(itemId) || this.personalGold < item.cost) continue;
            if (item.downgradeOf && item.downgradeOf.some(u => this.items.includes(u))) continue;

            this.personalGold -= item.cost;
            Game.gold += item.cost;

            if (item.replaces && this.items.includes(item.replaces)) {
                this.items.splice(this.items.indexOf(item.replaces), 1);
                const oldItem = ITEM_CONFIG[item.replaces];
                if (oldItem.statBonus) {
                    if (oldItem.statBonus.maxHp) { this.maxHp -= oldItem.statBonus.maxHp; this.hp -= oldItem.statBonus.maxHp; }
                    if (oldItem.statBonus.damage) this.damage -= oldItem.statBonus.damage;
                }
            }

            this.items.push(itemId);

            if (item.statBonus) {
                if (item.statBonus.maxHp) { this.maxHp += item.statBonus.maxHp; this.hp += item.statBonus.hp || item.statBonus.maxHp; }
                if (item.statBonus.damage) this.damage += item.statBonus.damage;
                if (item.statBonus.attackRange) this.attackRange += item.statBonus.attackRange;
            }

            Game.spawnParticle(this.pos.x, this.pos.y, item.color || '#e2e8f0');
            this.purchasedItemVfxTimer = 2.0;
            this.purchasedItemIcon = item.icon;
            Game.spawnFloatingText(s.pos.x, s.pos.y - 30, '🪙', '#ecc94b', 1.0, 22);
            break;
        }
    }
    draw(ctx) {
        if (this.isHealingAt) return;
        const e = HERO_CONFIG[this.classType].icon; let dX=this.pos.x, dY=this.pos.y, rot=0;
        if(this.classType==='DRUID') dY+=Math.sin(Game.timeMs*0.006)*3;
        if(this.state==='ATTACK'&&this.attackCooldown>this.maxAttackCooldown-0.25) { if(this.classType==='ROGUE') dX+=Math.sin(this.attackCooldown*90)*5; else if(this.classType==='WARRIOR'&&this.target) { const dir=this.target.pos.x>this.pos.x?1:-1; rot=0.5*dir; dX+=dir*3; } }
        ctx.save(); ctx.translate(dX, dY); if(rot) ctx.rotate(rot);

        const outC = Game.selectedEntity === this ? '#ecc94b' : (Game.hoveredEntity === this ? '#90ee90' : null);
        const sp = SpriteCache.get(e, 30, true, true, outC);
        ctx.drawImage(sp.img, -sp.ox, -sp.oy); ctx.restore();

        if (this.inAsh && Game.frames % 30 === 0) {
            Game.spawnParticle(this.pos.x, this.pos.y + 10, '#a0aec0');
        }

        if(this.purchasedItemVfxTimer>0){ const piY=Math.sin(Game.timeMs*0.01)*4; const pI = SpriteCache.get(this.purchasedItemIcon, 20, false, false); ctx.drawImage(pI.img, dX - pI.ox, dY - 50 + piY - pI.oy); }
        if(this.state==='FLEE'){ const fY=Math.sin(Game.timeMs*0.01)*4; const fl = SpriteCache.get('🏳️', 20, false, false); ctx.drawImage(fl.img, dX - fl.ox, dY - 45 + fY - fl.oy); }
        if(this.chargeVfxTimer>0){ const sv = SpriteCache.get('⚔️', 20, false, false); ctx.drawImage(sv.img, dX - sv.ox, dY - 35 - sv.oy); }
        if(this.regrowthCastVfxTimer>0){ const lf = SpriteCache.get('🥬', 20, false, false); ctx.drawImage(lf.img, dX - lf.ox, dY - 35 - lf.oy); }
        if(this.regrowthHealVfxTimer>0){ const lh = SpriteCache.get('🍃', 20, false, false); ctx.drawImage(lh.img, dX - lh.ox, dY - (this.chargeVfxTimer>0?55:35) - lh.oy); }
        if(this.levelUpVfxTimer>0){ const luY=Math.sin(Game.timeMs*0.01)*4; const lu = SpriteCache.get('🎉', 24, false, false); ctx.drawImage(lu.img, dX - lu.ox, dY - 60 + luY - lu.oy); }
        if(this.currentQuest && this.currentQuest.active && this.state !== 'FLEE'){
            ctx.save();ctx.translate(dX,dY-40);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-12);ctx.strokeStyle='#e2e8f0';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(10,-8);ctx.lineTo(0,-4);ctx.fillStyle=this.currentQuest.type==='FLAG_EXPLORE'?'#ecc94b':(this.currentQuest.type==='FLAG_DEFEND'?'#3182ce':'#e53e3e');ctx.fill();
            if(this.currentQuest.type === 'FLAG_GROUP_ATTACK') { ctx.fillStyle='white'; ctx.font = '12px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('🍻', 12, -8); }
            ctx.restore();
        }
        this.drawHP(ctx, -25);
    }
}

class Building extends Entity {
    constructor(x, y, t) {
        super(x, y); this.isStatic = true; this.faction = 'PLAYER'; this.type = t; this.heroes = []; this.maxHeroes = 3; this.upgrades = []; const c = BUILDING_CONFIG[t]; this.hp = this.maxHp = c ? c.hp : 100; this.radius = c ? c.radius : 25;
        this.isRepairing = false; this.repairTimer = 0; this.fireTimer = 0;
        if (t === 'SHOP') this.slots = ['NONE', 'NONE', 'NONE']; else if (t === 'TOWER') { this.attackRange = 250; this.attackCooldown = 0; this.target = null; } else if (t === 'TAVERN') { this.groups = [null, null, null]; }
        this.isUpgraded = false;

        if (c && c.yOffset) {
            this.hitboxOffset = {x: 0, y: -c.yOffset/2};
        }
    }
    getVisionRange() { return BUILDING_CONFIG[this.type] ? BUILDING_CONFIG[this.type].vision : 200; }
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
                        Game.spawnFloatingText(this.pos.x - 15, this.pos.y - 40, "-10g", "#e53e3e");
                        Game.spawnFloatingText(this.pos.x + 15, this.pos.y - 40, "+30 HP", "#48bb78");
                    } else {
                        this.isRepairing = false;
                    }
                }
            }
        }

        if (this.type === 'TOWER') {
            if (this.attackCooldown > 0) this.attackCooldown -= dtSec;

            if (this.attackCooldown <= 0) {
                const enemies = Grid.getNearby(this.pos, this.attackRange**2, 'ENEMY');
                let validEnemies = [];
                for (let i = 0; i < enemies.length; i++) {
                    const e = enemies[i];
                    if (e.isVisible && e.type !== 'SPAWNER' && this.pos.distSq(e.pos) <= this.attackRange**2) {
                        validEnemies.push(e);
                    }
                }

                if (validEnemies.length > 0) {
                    validEnemies.sort((a,b) => this.pos.distSq(a.pos) - this.pos.distSq(b.pos));
                    const targetsToShoot = this.isUpgraded ? Math.min(3, validEnemies.length) : 1;

                    for (let i = 0; i < targetsToShoot; i++) {
                        Game.projectiles.push(new Projectile(this.pos.x, this.pos.y - 20, validEnemies[i], 20, this, 'MAGIC_MISSILE'));
                    }
                    this.attackCooldown = 1.0;
                }
            }
        }
    }
    draw(ctx) {
        const conf = BUILDING_CONFIG[this.type];
        if (conf) {
            ctx.save(); ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.ellipse(this.pos.x, this.pos.y + conf.yOffset, conf.foundationRx, conf.foundationRy, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();

            const iconToDraw = (this.isUpgraded && conf.upgradedIcon) ? conf.upgradedIcon : conf.icon;
            const outC = Game.selectedEntity === this ? '#ecc94b' : (Game.hoveredEntity === this ? '#90ee90' : null);
            const sp = SpriteCache.get(iconToDraw, parseInt(conf.fontSize), true, true, outC);
            ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);

            if (this.type === 'TOWER') {
                const hY = Math.sin(Game.timeMs * 0.006) * 4;
                const topIcon = this.isUpgraded ? '🚦' : '🖲️';
                const tSp = SpriteCache.get(topIcon, 26);
                ctx.drawImage(tSp.img, this.pos.x - tSp.ox, this.pos.y - 20 + hY - tSp.oy);
            }
            if (this.type === 'TAVERN') { const bSp = SpriteCache.get('🍻', 28, false, false); ctx.drawImage(bSp.img, this.pos.x - bSp.ox, this.pos.y + 10 - bSp.oy); }
            if (conf.isGuild) {
                if (this.heroes.length < this.maxHeroes) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px Arial'; ctx.fillStyle = '#ecc94b'; ctx.strokeStyle = 'black'; ctx.lineWidth = 3; const text = `${this.heroes.length}/${this.maxHeroes}`; ctx.strokeText(text, this.pos.x, this.pos.y - 55); ctx.fillText(text, this.pos.x, this.pos.y - 55); }
                if (this.heroes.some(h => h.isDead)) { const pY = Math.sin(Game.timeMs * 0.008) * 5; const pSp = SpriteCache.get('🙏', 28, false, false); ctx.drawImage(pSp.img, this.pos.x - pSp.ox, this.pos.y - 75 + pY - pSp.oy); }
            }
        }

        if (this.fireTimer > 0) {
            const bounce = Math.abs(Math.sin(Game.timeMs * 0.01)) * 15;
            const fSp = SpriteCache.get('🔥', 40, false, false);
            ctx.drawImage(fSp.img, this.pos.x - fSp.ox, this.pos.y - this.radius - 15 - bounce - fSp.oy);
        }

        if (this.isRepairing && this.hp < this.maxHp) {
            const hoverY = Math.abs(Math.sin(Game.timeMs * 0.01)) * 8;
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(this.pos.x + 15, this.pos.y - 30, 10, 4, 0, 0, Math.PI*2); ctx.fill();
            const rSp = SpriteCache.get('🛠️', 24, false, false); ctx.drawImage(rSp.img, this.pos.x + 15 - rSp.ox, this.pos.y - 30 - hoverY - rSp.oy);
        }

        let hpOff = -this.radius - 5; if (this.type === 'TOWER') hpOff -= 25; else if (conf && conf.isGuild) hpOff -= 15;
        let hH = [];
        for (let i = 0; i < Game.activeHeroes.length; i++) {
            if (Game.activeHeroes[i].isHealingAt === this) hH.push(Game.activeHeroes[i]);
        }
        if (hH.length > 0) {
            const hY = Math.sin(Game.timeMs * 0.005) * 5;
            hH.forEach((h, i) => {
                const e = h.classType==='WARRIOR'?'🧌':(h.classType==='ROGUE'?'🥷':'🧚');
                const off = (i - (hH.length-1)/2)*30, bX = this.pos.x + off, bY = this.pos.y + hpOff - 25 + hY;
                const hSp = SpriteCache.get(e, 24); ctx.drawImage(hSp.img, bX - hSp.ox, bY - hSp.oy);
                const bSp = SpriteCache.get('🩹', 14, false, false); ctx.drawImage(bSp.img, bX + 12 - bSp.ox, bY - 5 - bSp.oy);
            });
        }
        this.drawHP(ctx, hpOff);
    }
    die() { super.die(); if (this.type === 'CASTLE') { Game.gameOver = true; Game.showStatsScreen(true); } else { Game.buildingDeaths++; } }
}

class Flag extends Entity {
    constructor(x, y, t, tE = null, sourceTav = null) {
        super(x, y); this.isStatic = true; this.type = t; this.bounty = t==='FLAG_EXPLORE' ? 25 : (t==='FLAG_DEFEND' ? 50 : 75); this.targetEntity = tE; this.maxTimer = 20.0; this.defendTimer = 20.0;
        this.name = t === 'FLAG_EXPLORE' ? 'Explore Quest ⚑' : (t === 'FLAG_DEFEND' ? 'Defend Quest ⚑' : (t === 'FLAG_GROUP_ATTACK' ? 'Group Quest ⚑' : 'Attack Quest ⚑'));
        this.sourceTavern = sourceTav;
        this.radius = 20;
        this.hitboxOffset = {x: 0, y: -15};
    }
    update(dtSec) {
        if (this.targetEntity) { if (!this.targetEntity.active) this.active = false; else { this.pos.x = this.targetEntity.pos.x; this.pos.y = this.targetEntity.pos.y - 30; } }
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
                    if (h.state === 'FLEE') fleeingCount++;
                    if (['WAITING_FOR_GROUP', 'MOVE_TO_TARGET', 'AT_TARGET'].includes(h.questPhase)) readyCount++;
                    if (h.questPhase === 'AT_TARGET') atTargCount++;
                    if (h.classType === 'DRUID') druidCountAssigned++;
                    if (this.type === 'FLAG_DEFEND' && this.targetEntity && h.pos.distSq(this.targetEntity.pos) < 2500) defs.push(h);
                }
            }

            if (this.type === 'FLAG_GROUP_ATTACK') {
                if (ass.length === 0) {
                    let availableGroups = [];
                    if (this.sourceTavern && this.sourceTavern.active && this.sourceTavern.groups) {
                        for(let i=0; i<3; i++) {
                            let g = this.sourceTavern.groups[i];
                            if (g && g.length > 0) {
                                let groupMembers = [];
                                for (let j=0; j<g.length; j++) if (!g[j].isDead) groupMembers.push(g[j]);
                                if (groupMembers.length > 0 && groupMembers.every(h => !h.currentQuest)) {
                                    availableGroups.push(groupMembers);
                                }
                            }
                        }
                    }
                    if (availableGroups.length > 0) {
                        availableGroups.sort((a,b) => a[0].pos.distSq(this.pos) - b[0].pos.distSq(this.pos));
                        let chosenGroup = availableGroups[0];
                        chosenGroup.forEach(h => { h.currentQuest = this; h.questPhase = (h.target && h.target.faction==='ENEMY')?'FINISH_COMBAT':'HEAL_AT_BASE'; });
                    }
                } else {
                    let maxReq = ass.length;
                    if (fleeingCount >= Math.max(1, Math.floor(maxReq / 2))) {
                        ass.forEach(a => { a.currentQuest = null; a.questPhase = 'NONE'; a.target = (a.tavern && a.tavern.active) ? a.tavern : Game.base; a.state = 'FLEE'; });
                        this.active = false;
                        return;
                    }
                    if (readyCount >= maxReq) { ass.forEach(a => { if (a.questPhase === 'WAITING_FOR_GROUP') a.questPhase = 'MOVE_TO_TARGET'; }); }

                    if (atTargCount >= maxReq) {
                        const tp = this.targetEntity ? this.targetEntity.pos : this.pos;
                        const threats = Grid.getNearby(tp, 40000, 'ENEMY');
                        let isClear = true; for(let i=0; i<threats.length; i++) if(threats[i].isVisible) isClear = false;

                        if (isClear) {
                            const s = Math.floor(this.bounty / Math.max(1, ass.length));
                            ass.forEach(a => { a.personalGold += s; a.lifetimeGold += s; a.gainXp(15); Game.spawnParticle(a.pos.x, a.pos.y, '#e53e3e'); a.currentQuest = null; a.questPhase = 'NONE'; a.state = 'IDLE'; });
                            this.active = false;
                        }
                    }
                }
                return;
            }

            const maxReq = this.type === 'FLAG_EXPLORE' ? 1 : Math.min(3, Math.max(1, totalHeroesNoGroup));
            if (maxReq === 0) return;

            if (ass.length < maxReq) {
                let av = [];
                for (let i = 0; i < Game.activeHeroes.length; i++) {
                    const h = Game.activeHeroes[i];
                    if (!h.currentQuest && !h.groupId) {
                        if (this.type === 'FLAG_EXPLORE' && h.classType === 'DRUID') continue;
                        if (this.type === 'FLAG_ATTACK' && h.classType === 'DRUID' && druidCountAssigned >= 1) continue;
                        av.push(h);
                    }
                }
                if (av.length > 0) {
                    if (this.type === 'FLAG_ATTACK') {
                        av.sort((a,b) => {
                            let scoreA = (10000 / Math.max(1, a.pos.distSq(Game.base.pos))) * (a.hp / a.maxHp);
                            let scoreB = (10000 / Math.max(1, b.pos.distSq(Game.base.pos))) * (b.hp / b.maxHp);
                            return scoreB - scoreA;
                        });
                    } else {
                        av.sort((a,b) => { let getS = h => (h.target && h.target.faction==='ENEMY')?2:(h.state==='IDLE'?0:1); return getS(a) - getS(b) || (b.hp/b.maxHp - a.hp/a.maxHp) || a.pos.distSq(this.pos) - b.pos.distSq(this.pos); });
                    }
                    while (ass.length < maxReq && av.length > 0) {
                        let h = av.shift(); h.currentQuest = this; h.questPhase = (h.target && h.target.faction==='ENEMY')?'FINISH_COMBAT':'HEAL_AT_BASE'; ass.push(h);
                        if (h.classType === 'DRUID') druidCountAssigned++;
                    }
                }
            }
            if (this.type === 'FLAG_DEFEND') {
                if (defs.length > 0) { this.defendTimer -= dtSec; if (this.defendTimer <= 0) { const s = Math.floor(this.bounty / defs.length); defs.forEach(d => { d.personalGold += s; d.lifetimeGold += s; d.gainXp(15); Game.spawnParticle(d.pos.x, d.pos.y, '#ecc94b'); d.currentQuest = null; d.questPhase = 'NONE'; d.state = 'IDLE'; }); this.active = false; } }
            } else if (this.type === 'FLAG_ATTACK') {
                const fleeLimit = maxReq === 3 ? 2 : 1;
                if (fleeingCount >= fleeLimit) {
                    ass.forEach(a => { a.currentQuest = null; a.questPhase = 'NONE'; a.target = (a.guild.active && a.guild.upgrades.includes('MED_TENT')) ? a.guild : Game.base; a.state = 'FLEE'; });
                    this.active = false;
                    return;
                }
                if (ass.length >= maxReq) {
                    if (readyCount >= maxReq) { ass.forEach(a => { if (a.questPhase === 'WAITING_FOR_GROUP') a.questPhase = 'MOVE_TO_TARGET'; }); }

                    if (atTargCount >= maxReq) {
                        const tp = this.targetEntity ? this.targetEntity.pos : this.pos;
                        const threats = Grid.getNearby(tp, 40000, 'ENEMY');
                        let isClear = true; for(let i=0; i<threats.length; i++) if(threats[i].isVisible) isClear = false;

                        if (isClear) {
                            const s = Math.floor(this.bounty / Math.max(1, ass.length));
                            ass.forEach(a => { a.personalGold += s; a.lifetimeGold += s; a.gainXp(15); Game.spawnParticle(a.pos.x, a.pos.y, '#e53e3e'); a.currentQuest = null; a.questPhase = 'NONE'; a.state = 'IDLE'; });
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
            ctx.arc(this.pos.x + 8, this.pos.y - 20, 25, 0, Math.PI*2);
            ctx.fillStyle = isSelected ? 'rgba(236,201,75,0.2)' : 'rgba(144,238,144,0.2)';
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#ecc94b' : '#90ee90';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
        ctx.beginPath(); ctx.moveTo(this.pos.x, this.pos.y); ctx.lineTo(this.pos.x, this.pos.y-30); ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(this.pos.x, this.pos.y-30); ctx.lineTo(this.pos.x+15, this.pos.y-22); ctx.lineTo(this.pos.x, this.pos.y-15); ctx.fillStyle=(this.type==='FLAG_ATTACK'||this.type==='FLAG_GROUP_ATTACK')?'#e53e3e':(this.type==='FLAG_DEFEND'?'#3182ce':'#ecc94b'); ctx.fill();
        if (this.type === 'FLAG_GROUP_ATTACK') { ctx.fillStyle='white'; ctx.font='16px Arial'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('🍻', this.pos.x + 18, this.pos.y - 22); }
        if (this.type==='FLAG_DEFEND') { ctx.beginPath(); ctx.arc(this.pos.x, this.pos.y, 40, 0, Math.PI*2); ctx.setLineDash([5,5]); ctx.strokeStyle='rgba(49,130,206,0.5)'; ctx.lineWidth=1; ctx.stroke(); ctx.setLineDash([]); }

        let assCount = 0;
        let totalHNoGroup = 0;
        for (let i = 0; i < Game.activeHeroes.length; i++) {
            if (Game.activeHeroes[i].currentQuest === this) assCount++;
            if (!Game.activeHeroes[i].groupId) totalHNoGroup++;
        }
        const maxR = this.type === 'FLAG_EXPLORE' ? 1 : (this.type === 'FLAG_GROUP_ATTACK' ? assCount : Math.min(3, Math.max(1, totalHNoGroup)));

        ctx.fillStyle='white'; ctx.font='11px Arial'; ctx.textAlign='center'; ctx.fillText(`${assCount}/${maxR}`, this.pos.x, this.pos.y-35);
        if (this.type==='FLAG_DEFEND' && this.defendTimer<20) { ctx.fillStyle='#ecc94b'; ctx.font='bold 12px Arial'; ctx.fillText(`${Math.ceil(this.defendTimer)}s`, this.pos.x, this.pos.y-48); }
    }
}

class Spawner extends Entity {
    constructor(x, y, t = 'RAT_HOLE') {
        super(x, y); this.isStatic = true; this.spawnerType = t; this.name = t==='WEB'?'Spider Web':(t==='SNAKE_NEST'?'Snake Nest':'Rat Hole'); this.faction = 'ENEMY'; this.type = 'SPAWNER'; this.hp = this.maxHp = t==='SNAKE_NEST'?400:150;

        const mainB = GameBounds.getMain();
        this.inCorridor = (x < mainB.x1 || x > mainB.x2 || y < mainB.y1 || y > mainB.y2);

        if (this.inCorridor) {
            this.maxHp += 25; this.hp += 25;
        }
        this.daysSurvived = 0;

        this.baseRadius = t==='SNAKE_NEST'?15:20; this.radius = this.baseRadius; this.spawnRate = t==='SNAKE_NEST'?14.0:8.0; this.spawnTimer = Math.random() * this.spawnRate;
    }
    update(dtSec) {
        const inBlackout = Game.dayTimer <= 10.0;
        if (!inBlackout) {
            this.spawnTimer += dtSec;
            if (this.spawnTimer >= this.spawnRate) {
                this.spawnTimer = 0;
                const spawnCount = this.inCorridor ? 1 : 1 + Math.floor(Math.random() * (this.daysSurvived + 1));
                for (let i = 0; i < spawnCount; i++) {
                    const mx = this.pos.x + (Math.random() - 0.5) * 10;
                    const my = this.pos.y + (Math.random() - 0.5) * 10;
                    Game.addEntity(new Monster(mx, my, this.spawnerType==='WEB'?'SPIDER':(this.spawnerType==='SNAKE_NEST'?'SNAKE':'RAT'), this.daysSurvived));
                }
            }
        }
    }
    die() {
        if (!this.active) return; super.die(); Game.spawnersKilled++;

        const validAttackers = [];
        this.attackers.forEach(a => { if (a.active) validAttackers.push(a); });

        if (validAttackers.length > 0) {
            const gY = 50;
            const tA = Math.floor(gY * Game.taxRate);
            const hA = gY - tA;
            Game.gold += tA;

            const sharedGold = Math.floor(hA / validAttackers.length);
            const sharedXpBase = Math.floor(50 / validAttackers.length) || 1;

            validAttackers.forEach(hero => {
                const xpGain = Math.floor(sharedXpBase * (hero.currentQuest ? 1.2 : 1.0));
                hero.gainXp(xpGain);
                hero.personalGold += sharedGold;
                hero.lifetimeGold += sharedGold;
            });

            for (let i = 0; i < Game.activeFlags.length; i++) {
                const f = Game.activeFlags[i];
                if (['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(f.type) && f.targetEntity === this) {
                    const bountyShare = Math.floor(f.bounty / validAttackers.length);
                    for (let j = 0; j < validAttackers.length; j++) {
                        validAttackers[j].personalGold += bountyShare;
                        validAttackers[j].lifetimeGold += bountyShare;
                    }
                    f.active = false;
                }
            }
        }
        for(let i=0;i<2;i++) Game.spawnParticle(this.pos.x, this.pos.y, '#ecc94b');
    }
    draw(ctx) {
        const scale = this.radius / this.baseRadius; ctx.save(); ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.ellipse(this.pos.x, this.pos.y+(15*scale), 25*scale, 10*scale, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        const ic = this.spawnerType==='WEB'?'🕸️':(this.spawnerType==='SNAKE_NEST'?'🪹':'🕳️');

        const outC = Game.selectedEntity === this ? '#ecc94b' : (Game.hoveredEntity === this ? '#90ee90' : null);
        const sp = SpriteCache.get(ic, 40+(this.daysSurvived*4), true, true, outC);
        ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);
        this.drawHP(ctx, -25-(this.daysSurvived*2));
    }
}

class Volcano extends Entity {
    constructor(x, y) {
        super(x, y); this.isStatic = true; this.spawnerType = 'VOLCANO'; this.name = 'Volcano'; this.faction = 'ENEMY'; this.type = 'SPAWNER';
        this.hp = this.maxHp = 1500; this.radius = 40; this.attackTimer = 40.0;
        this.towerAttackTimer = 1.5; this.towerDamage = 30; this.attackRange = 110;
        this.lastTowerTarget = null;
        this.ashRadius = 110;
    }
    update(dtSec) {
        if (this.stunTimer > 0) { this.stunTimer -= dtSec; return; }
        this.attackTimer -= dtSec;
        if (this.attackTimer <= 0) {
            this.attackTimer = 40.0;
            let targets = [];
            for (let i = 0; i < Game.playerEntities.length; i++) {
                if (BUILDING_CONFIG[Game.playerEntities[i].type]) targets.push(Game.playerEntities[i]);
            }
            if (targets.length > 0) {
                targets.sort(() => Math.random() - 0.5);
                const hitCount = Math.min(3, targets.length);
                const dmg = 40;
                for (let i = 0; i < hitCount; i++) {
                    Game.projectiles.push(new Projectile(this.pos.x + (Math.random()-0.5)*40, this.pos.y - 40 + (Math.random()-0.5)*40, targets[i], dmg, this, 'FIREBALL'));
                }
                Game.spawnFloatingText(this.pos.x, this.pos.y - 60, "ERUPTION!", "#e53e3e", 2.0, 24);
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
                if (!h.isDead && h.state !== 'FLEE' && this.pos.distSq(h.pos) <= arSq) {
                    backupTargets.push(h);
                    if (h !== this.lastTowerTarget) possibleTargets.push(h);
                }
            }
            if (possibleTargets.length === 0) possibleTargets = backupTargets;

            if (possibleTargets.length > 0) {
                const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                this.lastTowerTarget = target;
                Game.projectiles.push(new Projectile(this.pos.x, this.pos.y - 40, target, this.towerDamage, this, 'LAVA_ROCK'));
            }
        }
    }
    die() {
        if (!this.active) return; super.die(); Game.spawnersKilled++;

        const validAttackers = [];
        this.attackers.forEach(a => { if (a.active) validAttackers.push(a); });

        if (validAttackers.length > 0) {
            const gY = 200;
            const tA = Math.floor(gY * Game.taxRate); const hA = gY - tA; Game.gold += tA;
            const sharedGold = Math.floor(hA / validAttackers.length);
            const sharedXpBase = Math.floor(200 / validAttackers.length) || 1;
            validAttackers.forEach(hero => {
                hero.kills++; hero.gainXp(Math.floor(sharedXpBase * (hero.currentQuest ? 1.2 : 1.0)));
                hero.personalGold += sharedGold; hero.lifetimeGold += sharedGold;
            });
            for (let i = 0; i < Game.activeFlags.length; i++) {
                const f = Game.activeFlags[i];
                if (['FLAG_ATTACK', 'FLAG_GROUP_ATTACK'].includes(f.type) && f.targetEntity === this) {
                    const bountyShare = Math.floor(f.bounty / validAttackers.length);
                    for (let j = 0; j < validAttackers.length; j++) {
                        validAttackers[j].personalGold += bountyShare;
                        validAttackers[j].lifetimeGold += bountyShare;
                    }
                    f.active = false;
                }
            }
        }
        for(let i=0;i<10;i++) Game.spawnParticle(this.pos.x, this.pos.y, '#e53e3e');
        for(let i=0;i<10;i++) Game.spawnParticle(this.pos.x, this.pos.y, '#ecc94b');
    }
    draw(ctx) {
        const ash = SpriteCache.getAshPit(this.ashRadius);
        ctx.drawImage(ash.img, this.pos.x - ash.ox, this.pos.y - ash.oy);

        ctx.save(); ctx.fillStyle = '#3e2723'; ctx.beginPath(); ctx.ellipse(this.pos.x, this.pos.y+20, 50, 15, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();

        const outC = Game.selectedEntity === this ? '#ecc94b' : (Game.hoveredEntity === this ? '#90ee90' : null);
        const sp = SpriteCache.get('🗻', 80, true, true, outC);
        ctx.drawImage(sp.img, this.pos.x - sp.ox, this.pos.y - sp.oy);

        ctx.fillStyle = '#e53e3e'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center';
        ctx.fillText(Math.ceil(this.attackTimer) + "s", this.pos.x, this.pos.y - 60);
        this.drawHP(ctx, -40);
    }
}

const Game = {
    gold: 500, taxRate: 0.5, day: 1, dayTimer: 65.0, passiveGoldTimer: 10.0, frames: 0, timeMs: 0, mode: 'NONE', isPaused: false, fogOfWar: true,
    shopActiveSlot: null, tavernActiveSlot: null, tavernDraftGroup: [], entities: [], playerEntities: [], enemyEntities: [], flags: [], shops: [], particles: [], projectiles: [], floatingTexts: [],
    renderStatic: [], renderDynamic: [], staticDirty: true,
    activeHeroes: [], activeShops: [], activeFlags: [], activeSpawners: [], corridors: [], bgBounds: {x: 0, y: 0},
    guildBanks: { WARRIOR: 0, ROGUE: 0, DRUID: 0 }, base: null, selectedEntity: null, hoveredEntity: null, gameOver: false,
    heroDeaths: 0, buildingDeaths: 0, spawnersKilled: 0, emergencyMedicalCosts: 0, hallOfFame: [], selectedTavernForGroupQuest: null,

    addEntity(ent) {
        this.entities.push(ent);
        if (ent.isStatic) this.staticDirty = true;
    },

    cycleGroupQuestTavern() {
        const validTaverns = this.playerEntities.filter(e => {
            if (e.type !== 'TAVERN' || !e.groups) return false;
            for (let i = 0; i < 3; i++) {
                if (e.groups[i] && e.groups[i].length > 0 && e.groups[i].every(h => !h.isDead && !h.currentQuest)) return true;
            }
            return false;
        });

        if (validTaverns.length === 0) {
            this.selectedTavernForGroupQuest = null;
            return;
        }

        if (!this.selectedTavernForGroupQuest || validTaverns.indexOf(this.selectedTavernForGroupQuest) === -1) {
            this.selectedTavernForGroupQuest = validTaverns[0];
        } else {
            let idx = validTaverns.indexOf(this.selectedTavernForGroupQuest);
            this.selectedTavernForGroupQuest = validTaverns[(idx + 1) % validTaverns.length];
        }
    },

    getGuildCost(type) {
        const conf = BUILDING_CONFIG[type];
        if (!conf) return 0;
        let c = conf.baseCost;
        if (conf.isGuild) {
            c += this.playerEntities.filter(e => e.type === type).length * 100;
        }
        return c;
    },

    getPopulation() {
        let cur = 0, max = 0;
        for (let i = 0; i < this.playerEntities.length; i++) {
            const e = this.playerEntities[i];
            if (e.classType || e.type === 'TOWER') cur++;
            if (e.type === 'TOWER' && e.isUpgraded) cur++;
            if (e.type === 'CASTLE') max += 5;
            else if (e.type === 'FARM') max += (e.isUpgraded ? 6 : 3);
        }
        return { cur, max };
    },

    setTaxRate(rate) {
        this.taxRate = rate;
        [0, 25, 50, 75, 100].forEach(r => { UI.setClass(`btn-tax-${r}`, 'active', r === rate * 100); });
    },
    toggleRepair() {
        const e = this.selectedEntity;
        if (e && BUILDING_CONFIG[e.type] && e.faction === 'PLAYER') {
            if (!e.isRepairing && e.hp >= e.maxHp) return;
            e.isRepairing = !e.isRepairing;
            this.updateUI(true);
        }
    },
    positionUI() {
        const panel = document.getElementById('info-panel');
        if (this.selectedEntity && this.selectedEntity.active && panel.style.display !== 'none') {
            const e = this.selectedEntity;
            const screenX = (e.pos.x - Camera.x) * Camera.zoom + canvas.width / 2;
            const screenY = (e.pos.y - Camera.y) * Camera.zoom + canvas.height / 2;
            const radiusScaled = e.radius * Camera.zoom;
            let px = screenX + radiusScaled + 15, py = screenY - radiusScaled - 10;
            if (px + panel.offsetWidth > window.innerWidth - 10) px = screenX - radiusScaled - panel.offsetWidth - 15;
            if (px < 10) px = 10; if (py < 40) py = 40; if (py + panel.offsetHeight > window.innerHeight - 100) py = window.innerHeight - panel.offsetHeight - 100;
            panel.style.left = px + 'px'; panel.style.top = py + 'px';
        }
    },
    updateUI(force = false) {
        if (!force && this.frames % 15 !== 0) return;
        UI.setText('gold-display', Math.floor(this.gold));
        let secs = Math.ceil(this.dayTimer); UI.setText('day-timer-display', secs.toString().padStart(2, '0'));
        UI.setText('day-text', `Day ${this.day}:`);

        const {cur: currentPop, max: maxPop} = this.getPopulation();

        UI.setText('pop-display', `${currentPop}/${maxPop}`);
        const updateBtn = (id, cost) => {
            const btn = document.getElementById(id);
            if (btn) {
                let canAfford = this.gold >= cost; if (id === 'btn-tower') canAfford = canAfford && currentPop < maxPop;
                if (id === 'btn-flag-group-attack') {
                    let hasAnyGroup = false;
                    for (let i = 0; i < this.playerEntities.length; i++) {
                        const e = this.playerEntities[i];
                        if (e.type === 'TAVERN' && e.groups) {
                            for (let j = 0; j < 3; j++) {
                                if (e.groups[j] && e.groups[j].length > 0 && e.groups[j].every(h => !h.isDead && !h.currentQuest)) {
                                    hasAnyGroup = true; break;
                                }
                            }
                        }
                        if (hasAnyGroup) break;
                    }
                    canAfford = canAfford && hasAnyGroup;
                }
                UI.setDisabled(btn, !canAfford); const costSpan = btn.querySelector('.build-btn-cost');
                if (costSpan) {
                    UI.setColor(costSpan, this.gold >= cost ? '#ecc94b' : '#e53e3e');
                    if (id.startsWith('btn-') && !['btn-flag-explore','btn-flag-defend','btn-flag-attack','btn-flag-group-attack'].includes(id)) {
                        UI.setText(costSpan, id === 'btn-tower' ? `🪙${cost} | 1 🫂` : `🪙${cost}`);
                    }
                }
            }
        };
        ['btn-warrior-guild','btn-rogue-guild','btn-druid-guild','btn-shop','btn-farm','btn-tower','btn-tavern'].forEach(id => updateBtn(id, id === 'btn-tower' ? 500 : (id === 'btn-tavern' ? 200 : this.getGuildCost(id.replace('btn-', '').toUpperCase().replace(/-/g,'_')))));
        ['btn-flag-explore','btn-flag-defend','btn-flag-attack', 'btn-flag-group-attack'].forEach(id => updateBtn(id, id === 'btn-flag-explore' ? 25 : (id === 'btn-flag-defend' ? 50 : 75)));

        const panel = document.getElementById('info-panel');
        if (this.selectedEntity && this.selectedEntity.active) {
            UI.setDisplay(panel, 'block'); const e = this.selectedEntity;
            const displayIcon = e.isUpgraded && BUILDING_CONFIG[e.type].upgradedIcon ? BUILDING_CONFIG[e.type].upgradedIcon : (BUILDING_CONFIG[e.type] ? BUILDING_CONFIG[e.type].icon : '');
            let displayName = e.name || (BUILDING_CONFIG[e.type] ? `${BUILDING_CONFIG[e.type].name} ${displayIcon}` : e.type || e.classType || 'Entity');

            if (e.faction === 'PLAYER' && BUILDING_CONFIG[e.type]) {
                UI.setDisplay('btn-repair', 'block');
                UI.setClass('btn-repair', 'active', !!e.isRepairing);
            } else {
                UI.setDisplay('btn-repair', 'none');
            }
            UI.setDisplay('btn-abandon', e.type.startsWith('FLAG_') ? 'block' : 'none');

            const toggle = (id, show) => UI.setDisplay(id, show ? 'flex' : 'none');
            ['stat-tombstone','stat-level','stat-xp','stat-gold','stat-kills','stat-dmg','stat-items','stat-state','stat-tower-dmg'].forEach(id => toggle(id, false));
            UI.setDisplay('shop-config', 'none'); UI.setDisplay('guild-config', 'none'); UI.setDisplay('tavern-config', 'none'); UI.setDisplay('farm-config', 'none'); UI.setDisplay('tower-config', 'none');

            if (e.type === 'TOMBSTONE') { UI.setHTML('info-name', `Tombstone 🪦`); UI.setHTML('stat-tombstone', `"Here Lies ${e.name} of the ${e.guildName} Guild.<br>They were level ${e.level}, and killed ${e.kills} monsters."`); UI.setDisplay('stat-tombstone', 'block'); }
            else {
                let bountyStr = '';
                if (e.faction === 'ENEMY') {
                    const gY = e.type === 'MONSTER' ? Math.floor(15 * Math.pow(1.1, e.buffStacks)) : 50;
                    bountyStr = `<span style="color:#ecc94b; font-size:0.9rem;">🪙${gY}</span>`;
                }
                UI.setHTML('info-name', `<span style="width:100%; display:flex; justify-content:space-between;"><span>${displayName} <span style="font-size: 0.75rem; color: #a0aec0;">[${Math.floor(e.hp)}/${e.maxHp} HP]</span></span>${bountyStr}</span>`);
            }
            if (e.faction === 'PLAYER' && e.classType) {
                UI.setText('val-level', e.level); UI.setText('val-xp', `${e.xp} / ${e.level * 100}`);
                UI.setText('val-gold', `${Math.floor(e.personalGold)}g`); UI.setColor('val-gold', e.personalGold < 0 ? '#e53e3e' : '#ecc94b');
                UI.setText('val-kills', e.kills); UI.setText('val-dmg', e.damage);
                UI.setText('val-items', e.items.length > 0 ? e.items.join(', ') : 'None'); UI.setText('val-state', e.getDisplayState());
                ['stat-level','stat-xp','stat-gold','stat-kills','stat-dmg','stat-items','stat-state'].forEach(id => toggle(id, true));
            } else if (e.type === 'TOWER') {
                toggle('stat-tower-dmg', true);
                UI.setText('val-tower-dmg', e.isUpgraded ? '20x3 (Magic)' : '20 (Magic)');

                UI.setDisplay('tower-config', 'block');
                const upgBtn = document.getElementById('btn-upg-tower');
                if (e.isUpgraded) {
                    UI.setDisabled(upgBtn, true);
                    UI.setText('tower-upg-cost', 'Upgraded');
                    UI.setColor('tower-upg-cost', '#a0aec0');
                } else {
                    const canAfford = this.gold >= 800 && currentPop < maxPop;
                    UI.setDisabled(upgBtn, !canAfford);
                    UI.setText('tower-upg-cost', '🪙800 | 1 🫂');
                    UI.setColor('tower-upg-cost', this.gold >= 800 ? '#ecc94b' : '#e53e3e');
                }
            }

            if (e.type === 'SHOP') {
                UI.setDisplay('shop-config', 'block');
                if (Game.shopActiveSlot !== null) { UI.setDisplay('shop-select-ui', 'block'); UI.setDisplay('shop-slots-ui', 'none'); Object.keys(ITEM_CONFIG).forEach(id => { UI.setDisabled(`btn-shop-${id}`, this.gold < ITEM_CONFIG[id].cost); }); }
                else { UI.setDisplay('shop-select-ui', 'none'); UI.setDisplay('shop-slots-ui', 'block'); for(let i=0;i<3;i++) { UI.setHTML(`shop-slot-${i}`, e.slots[i] === 'NONE' ? 'Empty' : `<span style="font-size:1.5rem">${ITEM_CONFIG[e.slots[i]].icon}</span>`); } }
            } else if (['WARRIOR_GUILD','ROGUE_GUILD','DRUID_GUILD'].includes(e.type)) {
                UI.setDisplay('guild-config', 'block'); const br = document.getElementById('btn-recruit');
                const hClass = BUILDING_CONFIG[e.type].heroClass; const hConf = HERO_CONFIG[hClass];

                const deadHero = e.heroes.find(h => h.isDead);
                const homelessHeroes = Game.activeHeroes.filter(h => !h.isDead && h.classType === hClass && !h.guild.active);
                let btnCost = hConf.recruitCost;

                if (homelessHeroes.length > 0 && e.heroes.length < e.maxHeroes) {
                    UI.setDisplay('btn-adopt', 'block');
                } else {
                    UI.setDisplay('btn-adopt', 'none');
                }

                if (deadHero) {
                    btnCost = hConf.recruitCost + ((deadHero.level - 1) * 100);
                    UI.setText('recruit-icon', '🪦');
                    UI.setText('recruit-cost', `🪙${btnCost} | 1 🫂`);
                    br.setAttribute('onclick', 'Game.reviveHero()');

                    const hd = br.querySelector('.build-btn-hotkey'); if(hd) hd.innerText = 'G';
                    const td = br.querySelector('.build-btn-title'); if(td) td.innerText = 'Revive';

                    br.onmouseenter = (ev) => Game.showTooltip(ev, `Revive ${deadHero.name}`, `Revive your fallen hero.<br><span style="color:#ecc94b; font-style:italic;">Requires 1 🫂 (Population). Revive cost includes level penalty.</span>`);

                    UI.setDisabled(br, this.gold < btnCost || currentPop >= maxPop);
                } else {
                    UI.setText('recruit-icon', hConf.icon);
                    UI.setText('recruit-cost', `🪙${btnCost} | 1 🫂`);
                    br.setAttribute('onclick', 'Game.recruitHero()');

                    const hd = br.querySelector('.build-btn-hotkey'); if(hd) hd.innerText = 'T';
                    const td = br.querySelector('.build-btn-title'); if(td) td.innerText = 'Train';

                    br.onmouseenter = (ev) => Game.showTooltip(ev, 'Train Hero', `Recruit a new hero to join this guild.<br><span style="color:#ecc94b; font-style:italic;">Requires 1 🫂 (Population)</span>`);

                    UI.setDisabled(br, this.gold < btnCost || e.heroes.length >= e.maxHeroes || currentPop >= maxPop);
                }

                UI.setHTML('guild-roster', `Roster: ${e.heroes.length}/${e.maxHeroes} | Guild Bank: <span style="color:#ecc94b">${Game.guildBanks[hClass]}g</span>`);

                let rosterHTML = '';
                e.heroes.forEach(h => {
                    const icon = h.isDead ? '🪦' : hConf.icon;
                    rosterHTML += `<div class="roster-icon" onmouseenter="Game.showHeroTooltip(event, '${h.id}')" onmousemove="Game.moveTooltip(event)" onmouseleave="Game.hideTooltip()">${icon}</div>`;
                });
                UI.setHTML('guild-roster-icons', rosterHTML);

                const upgs = ['CHARGE','RAT_TRAP','REGROWTH','MED_TENT']; upgs.forEach(u => UI.setDisplay(`btn-upg-${u}`, 'none'));

                const showUpg = (u) => { if (!e.upgrades.includes(u)) { UI.setDisplay(`btn-upg-${u}`, 'block'); UI.setDisabled(`btn-upg-${u}`, this.gold < UPGRADE_CONFIG[u].cost); } };
                if (hClass === 'WARRIOR') { showUpg('CHARGE'); showUpg('MED_TENT'); }
                else if (hClass === 'ROGUE') { showUpg('RAT_TRAP'); showUpg('MED_TENT'); }
                else if (hClass === 'DRUID') { showUpg('REGROWTH'); showUpg('MED_TENT'); }

                const updateCostColor = (bId, c) => { const b = document.getElementById(bId); if(b && b.style.display !== 'none') { const cs = b.querySelector('.build-btn-cost'); if(cs) UI.setColor(cs, this.gold >= c ? '#ecc94b' : '#e53e3e'); } };
                updateCostColor('btn-recruit', btnCost); upgs.forEach(u => updateCostColor(`btn-upg-${u}`, UPGRADE_CONFIG[u].cost));
            } else if (e.type === 'TAVERN') {
                UI.setDisplay('tavern-config', 'block');

                if (Game.tavernActiveSlot !== null) {
                    UI.setDisplay('tavern-select-ui', 'block');
                    UI.setDisplay('tavern-slots-ui', 'none');

                    let gridHTML = '';
                    const availableHeroes = Game.activeHeroes.filter(h => !h.isDead && !h.groupId);
                    availableHeroes.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id));

                    availableHeroes.forEach(h => {
                        const isSelected = Game.tavernDraftGroup.includes(h.id);
                        const hConf = HERO_CONFIG[h.classType];
                        gridHTML += `<button class="shop-item-btn ${isSelected ? 'selected' : ''}" style="border-width: 2px; padding: 4px;" onclick="Game.toggleTavernHero('${h.id}')">
                            <span class="item-icon">${hConf.icon}</span>
                            <span class="item-cost" style="color: white; font-size: 0.65rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center; display: block;">${h.name}</span>
                            <span class="item-classes" style="color: #ecc94b; font-weight: bold;">Lvl ${h.level}</span>
                        </button>`;
                    });
                    if (availableHeroes.length === 0) gridHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #a0aec0; font-size: 0.8rem; padding: 10px;">No available heroes.</div>`;
                    UI.setHTML('tavern-hero-grid', gridHTML);

                    UI.setDisabled('btn-form-group', Game.tavernDraftGroup.length < 2 || Game.tavernDraftGroup.length > 4 || this.gold < 100);
                } else {
                    UI.setDisplay('tavern-select-ui', 'none');
                    UI.setDisplay('tavern-slots-ui', 'block');
                    let slotsHTML = '';
                    for (let i=0; i<3; i++) {
                        const grp = e.groups[i];
                        if (!grp || grp.length === 0) {
                            const canAfford = this.gold >= 100;
                            slotsHTML += `<div style="display: flex; align-items: center; gap: 10px; background: #2d3748; padding: 6px; border: 1px solid #4a5568; border-radius: 4px; height: 50px; box-sizing: border-box;">
                                <button class="menu-btn build-btn" style="width: 40px; height: 40px; margin: 0; flex-shrink: 0; display: flex; justify-content: center; align-items: center;" onclick="Game.openTavernDraft(${i})" ${canAfford ? '' : 'disabled'}>
                                    <div style="font-size: 1.5rem; margin-top: -5px;">+</div>
                                    <div class="build-btn-cost-badge" style="bottom: -8px; padding: 1px 4px;"><span class="build-btn-cost" style="color: ${canAfford ? '#ecc94b' : '#e53e3e'}; font-size: 0.6rem;">🪙100</span></div>
                                </button>
                                <span style="color: #a0aec0; font-size: 0.8rem; font-style: italic; margin-left: 5px;">Empty Group Slot</span>
                            </div>`;
                        } else {
                            let iconsHTML = '';
                            grp.forEach(h => {
                                const hConf = HERO_CONFIG[h.classType];
                                const icon = h.isDead ? '🪦' : hConf.icon;
                                iconsHTML += `<div class="roster-icon" onmouseenter="Game.showHeroTooltip(event, '${h.id}')" onmousemove="Game.moveTooltip(event)" onmouseleave="Game.hideTooltip()">${icon}</div>`;
                            });
                            slotsHTML += `<div style="display: flex; align-items: center; gap: 8px; background: #2d3748; padding: 6px; border: 1px solid #4a5568; border-radius: 4px; height: 50px; box-sizing: border-box; overflow-x: auto;">
                                ${iconsHTML}
                            </div>`;
                        }
                    }
                    UI.setHTML('tavern-groups-container', slotsHTML);
                }
            } else if (e.type === 'FARM') {
                UI.setDisplay('farm-config', 'block');
                const upgBtn = document.getElementById('btn-upg-farm');
                if (e.isUpgraded) {
                    UI.setDisabled(upgBtn, true);
                    UI.setText('farm-upg-cost', 'Upgraded');
                    UI.setColor('farm-upg-cost', '#a0aec0');
                } else {
                    UI.setDisabled(upgBtn, this.gold < 150);
                    UI.setText('farm-upg-cost', '🪙150');
                    UI.setColor('farm-upg-cost', this.gold >= 150 ? '#ecc94b' : '#e53e3e');
                }
            } else { if (Game.shopActiveSlot !== null || Game.tavernActiveSlot !== null) Game.hideTooltip(); Game.shopActiveSlot = null; Game.tavernActiveSlot = null; }
            this.positionUI();
        } else { UI.setDisplay(panel, 'none'); this.selectedEntity = null; if (this.shopActiveSlot !== null || this.tavernActiveSlot !== null) this.hideTooltip(); this.shopActiveSlot = null; this.tavernActiveSlot = null; }
    },
    openTavernDraft(slot) { this.tavernActiveSlot = slot; this.tavernDraftGroup = []; this.updateUI(true); },
    toggleTavernHero(id) {
        const idx = this.tavernDraftGroup.indexOf(id);
        if (idx > -1) {
            this.tavernDraftGroup.splice(idx, 1);
        } else {
            if (this.tavernDraftGroup.length < 4) this.tavernDraftGroup.push(id);
        }
        this.updateUI(true);
    },
    formTavernGroup() {
        if (this.selectedEntity && this.selectedEntity.type === 'TAVERN' && this.tavernActiveSlot !== null) {
            if (this.tavernDraftGroup.length >= 2 && this.tavernDraftGroup.length <= 4 && this.gold >= 100) {
                this.gold -= 100;
                const heroes = this.tavernDraftGroup.map(id => this.activeHeroes.find(h => h.id === id)).filter(h => h);
                const groupId = this.selectedEntity.id + '-' + this.tavernActiveSlot;
                heroes.forEach(h => {
                    if (h.guild && h.guild.heroes) {
                        const idx = h.guild.heroes.indexOf(h);
                        if (idx > -1) h.guild.heroes.splice(idx, 1);
                    }
                    h.groupId = groupId;
                    h.tavern = this.selectedEntity;
                    h.guild = this.selectedEntity;
                });
                this.selectedEntity.groups[this.tavernActiveSlot] = heroes;
                this.tavernActiveSlot = null;
                this.tavernDraftGroup = [];
                this.updateUI(true);
            }
        }
    },
    abandonQuest() {
        const e = this.selectedEntity;
        if (e && e.type.startsWith('FLAG_')) {
            e.active = false;
            this.selectedEntity = null;
            this.hideTooltip();
            this.updateUI(true);
        }
    },
    upgradeFarm() {
        const e = this.selectedEntity;
        if (e && e.type === 'FARM' && !e.isUpgraded && this.gold >= 150) {
            this.gold -= 150;
            e.isUpgraded = true;
            e.maxHp *= 2;
            e.hp += BUILDING_CONFIG.FARM.hp;
            this.updateUI(true);
            for(let i=0;i<10;i++) Game.spawnParticle(e.pos.x, e.pos.y, '#ecc94b');
            Game.spawnFloatingText(e.pos.x, e.pos.y - 40, "Upgraded!", "#63b3ed", 2.0, 20);
        }
    },
    upgradeTower() {
        const e = this.selectedEntity;
        if (e && e.type === 'TOWER' && !e.isUpgraded) {
            const {cur: currentPop, max: maxPop} = this.getPopulation();
            if (this.gold >= 800 && currentPop < maxPop) {
                this.gold -= 800;
                e.isUpgraded = true;
                e.maxHp += 200;
                e.hp += 200;
                this.updateUI(true);
                for(let i=0;i<10;i++) Game.spawnParticle(e.pos.x, e.pos.y, '#ecc94b');
                Game.spawnFloatingText(e.pos.x, e.pos.y - 40, "Upgraded!", "#63b3ed", 2.0, 20);
            }
        }
    },
    adoptHero() {
        if (this.selectedEntity && ['WARRIOR_GUILD','ROGUE_GUILD','DRUID_GUILD'].includes(this.selectedEntity.type)) {
            const g = this.selectedEntity;
            if (g.heroes.length >= g.maxHeroes) return;
            const hClass = BUILDING_CONFIG[g.type].heroClass;
            const homelessHero = this.activeHeroes.find(h => !h.isDead && h.classType === hClass && !h.guild.active);
            if (homelessHero) {
                homelessHero.guild = g;
                homelessHero.groupId = null;
                homelessHero.tavern = null;
                if (homelessHero.currentQuest && homelessHero.currentQuest.type === 'FLAG_GROUP_ATTACK') {
                    homelessHero.currentQuest = null;
                    homelessHero.questPhase = 'NONE';
                }
                g.heroes.push(homelessHero);
                this.updateUI(true);
                Game.spawnParticle(g.pos.x, g.pos.y, '#ecc94b');
            }
        }
    },
    recruitHero() {
        if (this.selectedEntity && ['WARRIOR_GUILD','ROGUE_GUILD','DRUID_GUILD'].includes(this.selectedEntity.type)) {
            const g = this.selectedEntity;
            if (g.heroes.find(h => h.isDead)) return;
            const hClass = BUILDING_CONFIG[g.type].heroClass; const cost = HERO_CONFIG[hClass].recruitCost;

            const {cur: curP, max: maxP} = this.getPopulation();
            if (this.gold >= cost && g.heroes.length < g.maxHeroes && curP < maxP) {
                this.gold -= cost;
                let h = new Hero(g.pos.x, g.pos.y + 40, hClass, g);
                if (Game.guildBanks[hClass] > 0) { const amt = Math.min(Game.guildBanks[hClass], 250); h.personalGold += amt; Game.guildBanks[hClass] -= amt; }
                g.heroes.push(h); this.addEntity(h); this.updateUI(true);
            }
        }
    },
    reviveHero() {
        if (this.selectedEntity && ['WARRIOR_GUILD','ROGUE_GUILD','DRUID_GUILD'].includes(this.selectedEntity.type)) {
            const g = this.selectedEntity;
            const deadHero = g.heroes.find(h => h.isDead);
            if (!deadHero) return;

            const hClass = BUILDING_CONFIG[g.type].heroClass;
            const cost = HERO_CONFIG[hClass].recruitCost + ((deadHero.level - 1) * 100);

            const {cur: curP, max: maxP} = this.getPopulation();

            if (this.gold >= cost && curP < maxP) {
                this.gold -= cost;
                deadHero.isDead = false;
                deadHero.active = true;
                deadHero.hp = deadHero.maxHp;
                deadHero.items = [];
                deadHero.pos.x = g.pos.x;
                deadHero.pos.y = g.pos.y + 40;
                deadHero.state = 'IDLE';
                deadHero.target = null;
                deadHero.currentQuest = null;
                deadHero.questPhase = 'NONE';

                if (deadHero.tombstoneEntity) {
                    deadHero.tombstoneEntity.active = false;
                    deadHero.tombstoneEntity = null;
                }

                this.addEntity(deadHero);
                this.updateUI(true);
                for(let i=0;i<10;i++) Game.spawnParticle(deadHero.pos.x, deadHero.pos.y, '#ecc94b');
            }
        }
    },
    buyShopItem(id, c) { if (this.selectedEntity && this.selectedEntity.type === 'SHOP' && this.shopActiveSlot !== null && this.gold >= ITEM_CONFIG[id].cost) { this.gold -= ITEM_CONFIG[id].cost; this.selectedEntity.slots[this.shopActiveSlot] = id; this.shopActiveSlot = null; this.hideTooltip(); this.updateUI(true); } },
    researchUpgrade(u) { if (this.selectedEntity && ['WARRIOR_GUILD','ROGUE_GUILD','DRUID_GUILD'].includes(this.selectedEntity.type)) { const c = UPGRADE_CONFIG[u].cost; if (this.gold >= c && !this.selectedEntity.upgrades.includes(u)) { this.gold -= c; this.selectedEntity.upgrades.push(u); this.updateUI(true); } } },
    togglePause() {
        this.isPaused = !this.isPaused;
        UI.setText('btn-pause', this.isPaused ? '▶️' : '⏸️');
        UI.setDisplay('pause-overlay', 'none');
        if (this.isPaused && !this.gameOver) {
            this.showStatsScreen(false);
        } else if (!this.isPaused && !this.gameOver) {
            UI.setDisplay('game-over', 'none');
        }
        UI.setClass(document.body, 'is-paused', this.isPaused);
    },
    isPosVisible(p) { for (let i = 0; i < this.playerEntities.length; i++) { const e = this.playerEntities[i]; if (typeof e.getVisionRange === 'function') { let v = e.getVisionRange(); if (v > 0 && p.distSq(e.pos) <= v * v) return true; } } return false; },
    canPlaceBuilding(x, y, radius) {
        const clamped = GameBounds.clamp(x, y, radius);
        if (clamped.x !== x || clamped.y !== y) return false;

        const pos = new Vec2(x, y);
        for (let i = 0; i < this.playerEntities.length; i++) {
            const e = this.playerEntities[i];
            if (BUILDING_CONFIG[e.type]) {
                const minDistance = radius + e.radius + 15;
                if (pos.distSq(e.pos) < minDistance * minDistance) return false;
            }
        }
        for (let i = 0; i < this.activeSpawners.length; i++) {
            const e = this.activeSpawners[i];
            if (e.spawnerType === 'VOLCANO') {
                const minDistance = radius + e.ashRadius;
                if (pos.distSq(e.pos) < minDistance * minDistance) return false;
            }
        }
        return true;
    },
    spawnHole(t = 'RAT_HOLE', forceCorridor = false, specificCorridor = null) {
        const margin = t === 'SNAKE_NEST' ? 160 : 190;
        let sx, sy, valid = false, attempts = 0, r = t === 'SNAKE_NEST' ? 15 : 20;

        while (!valid && attempts < 200) {
            if (forceCorridor && Game.corridors.length > 0) {
                const c = specificCorridor || Game.corridors[Math.floor(Math.random() * Game.corridors.length)].dir;
                const area = GameBounds.getCorridor(c);
                const m = 40;
                sx = area.x1 + m + Math.random() * (area.x2 - area.x1 - m * 2);
                sy = area.y1 + m + Math.random() * (area.y2 - area.y1 - m * 2);
            } else {
                if (Math.random() > 0.5) { sx = Math.random() > 0.5 ? margin : WORLD_WIDTH - margin; sy = margin + Math.random() * (WORLD_HEIGHT - margin * 2); }
                else { sx = margin + Math.random() * (WORLD_WIDTH - margin * 2); sy = Math.random() > 0.5 ? margin : WORLD_HEIGHT - margin; }
            }

            valid = true;
            const tp = new Vec2(sx, sy);
            const clearance = forceCorridor ? -10 : 15;

            for (let i = 0; i < this.entities.length; i++) {
                const e = this.entities[i];
                if (e.type === 'SPAWNER' || BUILDING_CONFIG[e.type]) {
                    if (tp.distSq(e.pos) < (r + e.radius + clearance)**2) {
                        valid = false; break;
                    }
                }
            }
            attempts++;
        }
        if (valid) this.addEntity(new Spawner(sx, sy, t));
    },
    spawnVolcano(dir) {
        const area = GameBounds.getCorridor(dir);
        let x, y;
        const m = 50;
        if (dir === 'NORTH') { x = (area.x1 + area.x2)/2; y = area.y1 + m; }
        if (dir === 'SOUTH') { x = (area.x1 + area.x2)/2; y = area.y2 - m; }
        if (dir === 'WEST') { x = area.x1 + m; y = (area.y1 + area.y2)/2; }
        if (dir === 'EAST') { x = area.x2 - m; y = (area.y1 + area.y2)/2; }
        this.addEntity(new Volcano(x, y));
    },
    spawnParticle(x, y, c) { this.particles.push({ pos: new Vec2(x, y), vel: {x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2}, life: 0.5, maxLife: 0.5, color: c }); },
    spawnFloatingText(x, y, text, color, life = 1.5, size = 16) {
        const el = document.createElement('div');
        el.className = 'floating-text';
        el.style.color = color;
        el.style.fontSize = size + 'px';
        el.innerText = text;
        document.getElementById('floating-text-layer').appendChild(el);

        this.floatingTexts.push({
            el: el,
            pos: new Vec2(x, y),
            vel: {x: 0, y: -0.5},
            life: life,
            maxLife: life
        });
    },
    showHeroTooltip(e, heroId) {
        const g = this.selectedEntity;
        let h = null;
        if (g && g.heroes) h = g.heroes.find(x => x.id === heroId);
        if (!h && g && g.groups) {
            for (let i = 0; i < 3; i++) {
                if (g.groups[i]) {
                    let found = g.groups[i].find(x => x.id === heroId);
                    if (found) { h = found; break; }
                }
            }
        }
        if (!h) h = this.activeHeroes.find(x => x.id === heroId) || this.entities.find(x => x.id === heroId);

        if (h) {
            const desc = `<span style="color:#ecc94b;">Currently ${h.getDisplayState()}</span><br><span style="color:#ecc94b; font-style:italic;">Level ${h.level}</span>`;
            this.showTooltip(e, h.name, desc);
        }
    },
    showTooltip(e, t, d = '', isB = false, sT = '') {
        const tt = document.getElementById('tooltip'); let h = sT ? `<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:3px;"><div class="tooltip-title" style="margin-bottom:0;">${t}</div><div style="font-size:0.75rem; color:#a0aec0; margin-left:10px; white-space:nowrap;">${sT}</div></div>` : `<div class="tooltip-title">${t}</div>`;
        if (d) h += `<div class="tooltip-desc">${d}</div>`; tt.innerHTML = h; tt.classList.toggle('building-tooltip', isB); tt.style.display = 'block'; this.moveTooltip(e);
    },
    moveTooltip(e) {
        const tt = document.getElementById('tooltip'); if (tt.style.display === 'block') {
            const w = tt.offsetWidth, h = tt.offsetHeight, off = 15; let x = e.clientX, y = e.clientY;
            if (y - off - h > 0 && x - off - w > 0) { x -= off + w; y -= off + h; }
            else if (y - off - h > 0 && x + off + w < window.innerWidth) { x += off; y -= off + h; }
            else if (y + off + h < window.innerHeight && x - off - w > 0) { x -= off + w; y += off; }
            else { x += off; y += off; if (x + w > window.innerWidth) x = window.innerWidth - w - 5; if (y + h > window.innerHeight) y = window.innerHeight - h - 5; }
            tt.style.left = x + 'px'; tt.style.top = y + 'px';
        }
    },
    hideTooltip() { document.getElementById('tooltip').style.display = 'none'; },
    showStatsScreen(isGameOver) {
        const hall = [...this.hallOfFame, ...this.playerEntities.filter(e => e.classType).map(h => ({ name: h.name, classType: h.classType, level: h.level, kills: h.kills, gold: h.lifetimeGold }))];
        hall.sort((a,b) => b.level - a.level || b.kills - a.kills);
        const top10 = hall.slice(0, 10);

        const titleText = isGameOver ? "KINGDOM DESTROYED" : "GAME STATS";
        const btnText = isGameOver ? "Rebuild Kingdom" : "Resume Game";
        const btnAction = isGameOver ? "location.reload()" : "Game.togglePause()";
        const themeColor = isGameOver ? "#e53e3e" : "#3182ce";

        let html = `<div class="go-title" style="color: ${themeColor}; border-bottom-color: ${themeColor};">${titleText}</div><div class="score-grid">`;
        html += `<div class="stat-box" style="flex-grow:1;"><h3 style="margin-top: 0; margin-bottom: 5px;">Top 10 Highest Level Heroes</h3><div class="go-table-container"><table class="go-table"><tr><th>Hero</th><th>Class</th><th>Level</th><th>Monsters Killed</th><th>Gold Generated</th></tr>`;
        const classNames = { 'WARRIOR': 'Warrior', 'ROGUE': 'Rogue', 'DRUID': 'Druid' };
        top10.forEach(h => html += `<tr><td>${h.name}</td><td>${classNames[h.classType] || h.classType}</td><td>${h.level}</td><td>${h.kills}</td><td>${Math.floor(h.gold)}g</td></tr>`);
        html += `</table></div></div>`;
        html += `<div class="stat-box"><h3 style="margin-top: 0; margin-bottom: 5px;">Kingdom Statistics</h3>`;
        const stats = [
            ["Days Lasted", this.day],
            ["Hero Deaths", this.heroDeaths],
            ["Buildings Lost", this.buildingDeaths],
            ["Monster Spawners Killed", this.spawnersKilled],
            ["Emergency Triage Costs", `<span style="color:#e53e3e">${Math.floor(this.emergencyMedicalCosts)}g</span>`]
        ];
        stats.forEach(s => html += `<div class="stat-row"><span class="stat-label">${s[0]}</span><span class="stat-val">${s[1]}</span></div>`);
        html += `</div><button class="btn" style="width:100%; margin-top:2px; font-size:1.1rem; padding:8px; flex-shrink:0;" onclick="${btnAction}">${btnText}</button></div>`;

        const go = document.getElementById('game-over'); go.innerHTML = html; go.style.borderColor = themeColor; go.style.display = 'flex';
    }
};

function switchMenu(m) { UI.setDisplay('menu-build', m==='BUILD'?'flex':'none'); UI.setDisplay('menu-command', m==='COMMAND'?'flex':'none'); }
function setMode(m) {
    if (m === 'FLAG_GROUP_ATTACK') {
        Game.cycleGroupQuestTavern();
        if (!Game.selectedTavernForGroupQuest) return;
    } else {
        Game.selectedTavernForGroupQuest = null;
    }
    Game.mode = m;
    if (m !== 'NONE' && Game.selectedEntity) { Game.selectedEntity = null; Game.hideTooltip(); Game.updateUI(true); }
    document.querySelectorAll('#bottom-bar button').forEach(b => UI.setClass(b, 'active', false));
    const id = {'BUILD_WARRIOR':'btn-warrior-guild','BUILD_ROGUE':'btn-rogue-guild','BUILD_DRUID':'btn-druid-guild','BUILD_SHOP':'btn-shop','BUILD_FARM':'btn-farm','BUILD_TOWER':'btn-tower','BUILD_TAVERN':'btn-tavern','FLAG_EXPLORE':'btn-flag-explore','FLAG_DEFEND':'btn-flag-defend','FLAG_ATTACK':'btn-flag-attack','FLAG_GROUP_ATTACK':'btn-flag-group-attack'}[m];
    if(id) UI.setClass(id, 'active', true);
}

canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mouseleave', () => { screenMousePos.x = canvas.width/2; screenMousePos.y = canvas.height/2; isPanning = false; });
window.addEventListener('wheel', e => { if(Game.isPaused) return; e.preventDefault(); const z = 1.1; if(e.deltaY > 0) Camera.targetZoom /= z; else Camera.targetZoom *= z; Camera.targetZoom = Math.max(0.3, Math.min(2.5, Camera.targetZoom)); }, { passive: false });
window.addEventListener('mouseup', e => { if (e.button === 1 || e.button === 2) isPanning = false; });
canvas.addEventListener('mousedown', e => {
    if (Game.gameOver || Game.isPaused) return;
    if (e.button === 1 || e.button === 2) { isPanning = true; panStart = new Vec2(e.clientX, e.clientY); cameraStart = new Vec2(Camera.x, Camera.y); if(e.button===2) { if(Game.mode!=='NONE') setMode('NONE'); else { Game.selectedEntity=null; Game.updateUI(true); } } return; }
    const r = canvas.getBoundingClientRect(); const cp = screenToWorld(e.clientX-r.left, e.clientY-r.top);
    let clE = null; for(let i=Game.entities.length-1;i>=0;i--) { const ent=Game.entities[i]; if(ent.faction==='ENEMY'&&ent.isVisible===false) continue; const hx = ent.pos.x + (ent.hitboxOffset ? ent.hitboxOffset.x : 0); const hy = ent.pos.y + (ent.hitboxOffset ? ent.hitboxOffset.y : 0); if((cp.x - hx)**2 + (cp.y - hy)**2 <= (ent.radius+10)**2) { clE=ent; break; } }
    if (Game.mode === 'NONE') { Game.selectedEntity = clE; Game.updateUI(true); return; }
    const bM = {'BUILD_WARRIOR':'WARRIOR_GUILD','BUILD_ROGUE':'ROGUE_GUILD','BUILD_DRUID':'DRUID_GUILD','BUILD_SHOP':'SHOP','BUILD_FARM':'FARM','BUILD_TOWER':'TOWER','BUILD_TAVERN':'TAVERN'};
    if (bM[Game.mode]) {
        const bt = bM[Game.mode], cnf = BUILDING_CONFIG[bt], c = Game.getGuildCost(bt);
        const pop = Game.getPopulation();
        if (bt==='TOWER' && pop.cur >= pop.max) return; if (Game.gold >= c && Game.canPlaceBuilding(cp.x, cp.y, cnf.radius)) { Game.gold-=c; Game.addEntity(new Building(cp.x, cp.y, bt)); setMode('NONE'); }
        return;
    }
    const clampedFlag = GameBounds.clamp(cp.x, cp.y, 0);
    if (Game.mode==='FLAG_EXPLORE' && Game.gold>=25) { Game.gold-=25; Game.addEntity(new Flag(clampedFlag.x, clampedFlag.y, 'FLAG_EXPLORE')); setMode('NONE'); Game.updateUI(true); }
    else if (Game.mode==='FLAG_DEFEND' && Game.gold>=50 && clE && clE.faction==='PLAYER' && !['HERO','TRAP'].includes(clE.type)) { Game.gold-=50; Game.addEntity(new Flag(cp.x,cp.y,'FLAG_DEFEND',clE)); setMode('NONE'); Game.updateUI(true); }
    else if (Game.mode==='FLAG_ATTACK' && Game.gold>=75) { Game.gold-=75; Game.addEntity(new Flag(clampedFlag.x, clampedFlag.y, 'FLAG_ATTACK')); setMode('NONE'); Game.updateUI(true); }
    else if (Game.mode==='FLAG_GROUP_ATTACK' && Game.gold>=75 && Game.selectedTavernForGroupQuest) { Game.gold-=75; Game.addEntity(new Flag(clampedFlag.x, clampedFlag.y, 'FLAG_GROUP_ATTACK', null, Game.selectedTavernForGroupQuest)); setMode('NONE'); Game.updateUI(true); }
});
canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect(); screenMousePos.x=e.clientX-r.left; screenMousePos.y=e.clientY-r.top;
    if(isPanning){const dx=(e.clientX-panStart.x)/Camera.zoom,dy=(e.clientY-panStart.y)/Camera.zoom; Camera.x=cameraStart.x-dx; Camera.y=cameraStart.y-dy;}
    const wp=screenToWorld(screenMousePos.x,screenMousePos.y); mousePos.x=wp.x; mousePos.y=wp.y;
    let hE = null;
    for(let i=Game.entities.length-1;i>=0;i--) {
        const ent=Game.entities[i];
        if(ent.faction==='ENEMY'&&ent.isVisible===false) continue;
        const hx = ent.pos.x + (ent.hitboxOffset ? ent.hitboxOffset.x : 0);
        const hy = ent.pos.y + (ent.hitboxOffset ? ent.hitboxOffset.y : 0);
        if((wp.x - hx)**2 + (wp.y - hy)**2 <= (ent.radius+10)**2) { hE = ent; break; }
    }
    Game.hoveredEntity = hE;
});

let lastTimestamp = 0, accumulator = 0; const TIME_STEP = 1000/60, visionCache = {};
const fogCanvas = document.createElement('canvas'); const fogCtx = fogCanvas.getContext('2d');
function getVisionImage(r) { if(visionCache[r]) return visionCache[r]; const c=document.createElement('canvas'); c.width=r*2; c.height=r*2; const ctx=c.getContext('2d'), g=ctx.createRadialGradient(r,r,r*0.4,r,r,r); g.addColorStop(0,'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,r*2,r*2); visionCache[r]=c; return c; }
function init() { generateTerrain(); Game.base = new Building(WORLD_WIDTH/2, WORLD_HEIGHT/2, 'CASTLE'); Game.addEntity(Game.base); Game.spawnHole(); requestAnimationFrame(loop); }
function loop(timestamp) {
    if (Game.gameOver) return; requestAnimationFrame(loop); if(!lastTimestamp) lastTimestamp=timestamp; let dt=timestamp-lastTimestamp; lastTimestamp=timestamp; if(Game.isPaused) return; if(dt>250) dt=250; accumulator+=dt; let updated=false;
    while (accumulator >= TIME_STEP) {
        Game.frames++; const dtS = TIME_STEP/1000; Game.timeMs+=TIME_STEP; Camera.zoom+=(Camera.targetZoom-Camera.zoom)*0.1;
        if (!isPanning) { const ps=15/Camera.zoom; if(keys['w']||keys['arrowup']) Camera.y-=ps; if(keys['s']||keys['arrowdown']) Camera.y+=ps; if(keys['a']||keys['arrowleft']) Camera.x-=ps; if(keys['d']||keys['arrowright']) Camera.x+=ps; }
        Camera.x=Math.max(-800,Math.min(WORLD_WIDTH+800,Camera.x)); Camera.y=Math.max(-800,Math.min(WORLD_HEIGHT+800,Camera.y));
        Game.dayTimer-=dtS; if(Game.dayTimer<=0) {
            Game.day++; Game.dayTimer=65.0;

            let eRats=0, eSpiders=0, eSnakes=0;
            const mainB = GameBounds.getMain();
            Game.entities.forEach(e=>{
                if(e.type==='SPAWNER' && e.spawnerType !== 'VOLCANO'){
                    e.daysSurvived++; e.radius=e.baseRadius+(e.daysSurvived*2);
                    e.maxHp += 50; e.hp += 50;
                    if (e.pos.x >= mainB.x1 && e.pos.x <= mainB.x2 && e.pos.y >= mainB.y1 && e.pos.y <= mainB.y2) {
                        if(e.spawnerType==='RAT_HOLE') eRats++; else if(e.spawnerType==='WEB') eSpiders++; else if(e.spawnerType==='SNAKE_NEST') eSnakes++;
                    }
                }
            });

            const triggerDays = [9, 15, 20, 25];
            if (triggerDays.includes(Game.day)) {
                const expectedCorridors = triggerDays.indexOf(Game.day) + 1;
                if (Game.corridors.length < expectedCorridors) {
                    const dirs = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
                    const availableDirs = dirs.filter(d => !Game.corridors.find(c => c.dir === d));
                    if (availableDirs.length > 0) {
                        const pick = availableDirs[Math.floor(Math.random() * availableDirs.length)];

                        Game.corridors.push({ dir: pick, dayOpened: Game.day });

                        Game.activeSpawners.forEach(s => {
                            if (s.spawnerType === 'VOLCANO') {
                                s.maxHp += 250;
                                s.hp += 250;
                                s.towerDamage += 10;
                            }
                        });

                        generateTerrain();
                        Game.spawnFloatingText(WORLD_WIDTH/2, WORLD_HEIGHT/2 - 100, "A new path has opened!", "#ecc94b", 4.0, 30);

                        Game.spawnVolcano(pick);

                        Game.spawnHole('RAT_HOLE', true, pick);
                        Game.spawnHole('WEB', true, pick);
                        Game.spawnHole('SNAKE_NEST', true, pick);
                    }
                }
            }

            let ed=Math.min(Game.day,10), ns=ed>=4?Math.floor((ed-2)/2):0, nr=ed-ns, nsn=0;
            if(Game.day>10){nr=Math.max(0,nr-2);nsn=Game.day-10;}

            if (Game.corridors.length > 0) {
                nr = Math.max(0, nr - 1);
                ns = Math.max(0, ns - 1);
            }

            for(let i=0;i<Math.max(0, nr-eRats);i++) Game.spawnHole('RAT_HOLE', false);
            for(let i=0;i<Math.max(0, ns-eSpiders);i++) Game.spawnHole('WEB', false);
            for(let i=0;i<Math.max(0, nsn-eSnakes);i++) Game.spawnHole('SNAKE_NEST', false);

            Game.corridors.forEach(c => {
                const area = GameBounds.getCorridor(c.dir);
                let counts = { 'RAT_HOLE': 0, 'WEB': 0, 'SNAKE_NEST': 0, 'VOLCANO': 0 };

                Game.entities.forEach(s => {
                    if (s.type === 'SPAWNER' && s.pos.x >= area.x1 && s.pos.x <= area.x2 && s.pos.y >= area.y1 && s.pos.y <= area.y2) {
                        if (s.spawnerType === 'VOLCANO') counts['VOLCANO']++;
                        else counts[s.spawnerType] = (counts[s.spawnerType] || 0) + 1;
                    }
                });

                if (counts['VOLCANO'] === 0) Game.spawnVolcano(c.dir);

                let daysOpen = Game.day - c.dayOpened + 1;
                let targetRats = Math.min(2, daysOpen);
                let targetSpiders = daysOpen >= 3 ? 2 : 1;
                let targetSnakes = daysOpen >= 4 ? 2 : 1;

                for (let i = counts['RAT_HOLE']; i < targetRats; i++) Game.spawnHole('RAT_HOLE', true, c.dir);
                for (let i = counts['WEB']; i < targetSpiders; i++) Game.spawnHole('WEB', true, c.dir);
                for (let i = counts['SNAKE_NEST']; i < targetSnakes; i++) Game.spawnHole('SNAKE_NEST', true, c.dir);
            });
        }
        Game.passiveGoldTimer-=dtS; if(Game.passiveGoldTimer<=0){Game.passiveGoldTimer+=10.0; if(Game.day===1){let gain=0; Game.playerEntities.forEach(e=>{if(e.type==='CASTLE')gain+=25;else if(['WARRIOR_GUILD','ROGUE_GUILD','DRUID_GUILD','FARM'].includes(e.type))gain+=10;}); Game.gold+=gain;}}

        let updateStatic = Game.staticDirty;
        if (updateStatic) Game.renderStatic.length = 0;
        Game.renderDynamic.length = 0;

        Game.playerEntities.length = 0; Game.enemyEntities.length = 0; Game.activeHeroes.length = 0; Game.activeShops.length = 0; Game.activeFlags.length = 0; Game.activeSpawners.length = 0; Game.shops.length = 0; Game.flags.length = 0; Grid.clear();
        for(let i = Game.entities.length - 1; i >= 0; i--) {
            const e = Game.entities[i];
            if(!e.active) {
                if (e.isStatic) Game.staticDirty = true;
                Game.entities[i] = Game.entities[Game.entities.length - 1];
                Game.entities.pop();
                continue;
            }
            Grid.insert(e);
            if(e.faction==='PLAYER') Game.playerEntities.push(e);
            else if(e.faction==='ENEMY') { Game.enemyEntities.push(e); e.isVisible = !Game.fogOfWar || Game.isPosVisible(e.pos); }
            if(e.classType) Game.activeHeroes.push(e);
            if(e.type==='SHOP') { Game.activeShops.push(e); Game.shops.push(e); }
            if(e.type.startsWith('FLAG_')) { Game.activeFlags.push(e); Game.flags.push(e); }
            if(e.type==='SPAWNER') Game.activeSpawners.push(e);

            if (e.isStatic) {
                if (updateStatic) Game.renderStatic.push(e);
            } else {
                Game.renderDynamic.push(e);
            }
        }

        if (updateStatic) {
            Game.renderStatic.sort((a,b) => a.pos.y - b.pos.y);
            Game.staticDirty = false;
        }
        Game.renderDynamic.sort((a,b) => a.pos.y - b.pos.y);

        Game.updateUI(); for(let i=0; i<Game.entities.length; i++) Game.entities[i].update(dtS);
        Game.projectiles.forEach(p=>p.update(dtS));
        for(let i=Game.projectiles.length-1; i>=0; i--) {
            if(!Game.projectiles[i].active) {
                Game.projectiles[i] = Game.projectiles[Game.projectiles.length - 1];
                Game.projectiles.pop();
            }
        }
        for(let i=Game.particles.length-1; i>=0; i--) {
            const p = Game.particles[i];
            p.pos.x += p.vel.x; p.pos.y += p.vel.y; p.life -= dtS;
            if(p.life <= 0) {
                Game.particles[i] = Game.particles[Game.particles.length - 1];
                Game.particles.pop();
            }
        }
        for(let i=Game.floatingTexts.length-1; i>=0; i--) {
            const ft = Game.floatingTexts[i];
            ft.pos.x += ft.vel.x; ft.pos.y += ft.vel.y; ft.life -= dtS;
            if(ft.life <= 0) {
                ft.el.remove();
                Game.floatingTexts[i] = Game.floatingTexts[Game.floatingTexts.length - 1];
                Game.floatingTexts.pop();
            }
        }
        Game.entities.forEach(e=>{if(e.faction==='ENEMY')e.isVisible = !Game.fogOfWar || Game.isPosVisible(e.pos);});
        accumulator-=TIME_STEP; updated=true;
    }
    if (!updated) return; ctx.clearRect(0,0,canvas.width,canvas.height); ctx.save(); ctx.translate(canvas.width/2,canvas.height/2); ctx.scale(Camera.zoom,Camera.zoom); ctx.translate(-Camera.x,-Camera.y);

    ctx.drawImage(bgCanvas, Game.bgBounds.x, Game.bgBounds.y);

    if (Game.fogOfWar) {
        fogCanvas.width = canvas.width; fogCanvas.height = canvas.height;
        fogCtx.fillStyle='rgba(0,0,0,0.7)'; fogCtx.fillRect(0, 0, canvas.width, canvas.height);
        fogCtx.globalCompositeOperation='destination-out';
        fogCtx.save();
        fogCtx.translate(canvas.width/2,canvas.height/2); fogCtx.scale(Camera.zoom,Camera.zoom); fogCtx.translate(-Camera.x,-Camera.y);
        for(let e of Game.playerEntities){let v=e.getVisionRange(); if(v>0)fogCtx.drawImage(getVisionImage(v),e.pos.x-v,e.pos.y-v);}
        fogCtx.restore();
        fogCtx.globalCompositeOperation='source-over';
        ctx.restore();
        ctx.drawImage(fogCanvas, 0, 0);
        ctx.save();
        ctx.translate(canvas.width/2,canvas.height/2); ctx.scale(Camera.zoom,Camera.zoom); ctx.translate(-Camera.x,-Camera.y);
    }

    let sIdx = 0, dIdx = 0;
    while (sIdx < Game.renderStatic.length || dIdx < Game.renderDynamic.length) {
        let sEnt = Game.renderStatic[sIdx];
        let dEnt = Game.renderDynamic[dIdx];

        while (sEnt && sEnt.faction === 'ENEMY' && !sEnt.isVisible) { sIdx++; sEnt = Game.renderStatic[sIdx]; }
        while (dEnt && dEnt.faction === 'ENEMY' && !dEnt.isVisible) { dIdx++; dEnt = Game.renderDynamic[dIdx]; }

        if (!sEnt && !dEnt) break;

        if (sEnt && dEnt) {
            if (sEnt.pos.y <= dEnt.pos.y) {
                sEnt.draw(ctx); sIdx++;
            } else {
                dEnt.draw(ctx); dIdx++;
            }
        } else if (sEnt) {
            sEnt.draw(ctx); sIdx++;
        } else {
            dEnt.draw(ctx); dIdx++;
        }
    }

    Game.projectiles.forEach(p=>p.draw(ctx));
    Game.particles.forEach(p=>{if(!Game.isPosVisible(p.pos))return; ctx.globalAlpha=p.life/p.maxLife; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.pos.x,p.pos.y,3,0,Math.PI*2); ctx.fill();});

    ctx.globalAlpha=1.0;
    if (Game.mode!=='NONE'){
        const bM={'BUILD_WARRIOR':'WARRIOR_GUILD','BUILD_ROGUE':'ROGUE_GUILD','BUILD_DRUID':'DRUID_GUILD','BUILD_SHOP':'SHOP','BUILD_FARM':'FARM','BUILD_TOWER':'TOWER','BUILD_TAVERN':'TAVERN'};
        if(bM[Game.mode]){
            const bt=bM[Game.mode],cnf=BUILDING_CONFIG[bt];
            let canP=Game.canPlaceBuilding(mousePos.x,mousePos.y,cnf.radius);
            if(bt==='TOWER'){
                const pop = Game.getPopulation();
                if(pop.cur>=pop.max)canP=false;
            }
            ctx.globalAlpha=canP?0.8:0.3; ctx.strokeStyle=canP?'#39ff14':'#ff0000'; ctx.lineWidth=2; ctx.beginPath(); ctx.rect(mousePos.x-cnf.radius, mousePos.y-cnf.radius, cnf.radius*2, cnf.radius*2); ctx.stroke(); if(!canP){ctx.fillStyle='rgba(255,0,0,0.15)'; ctx.fill();} ctx.font=cnf.fontSize+' Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(cnf.icon,mousePos.x,mousePos.y); if(bt==='TOWER'){ctx.save();const hY=Math.sin(Game.timeMs*0.006)*4;ctx.translate(mousePos.x,mousePos.y-20+hY);ctx.font='26px Arial';ctx.fillText('🖲️',0,0);ctx.restore();} if(bt==='TAVERN'){ctx.save();ctx.font='28px Arial';ctx.fillText('🍻',mousePos.x,mousePos.y+10);ctx.restore();}
        }
        else if(['FLAG_EXPLORE','FLAG_ATTACK','FLAG_DEFEND','FLAG_GROUP_ATTACK'].includes(Game.mode)){
            ctx.globalAlpha=0.5;ctx.beginPath();ctx.moveTo(mousePos.x,mousePos.y);ctx.lineTo(mousePos.x,mousePos.y-30);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=(Game.mode==='FLAG_ATTACK'||Game.mode==='FLAG_GROUP_ATTACK')?'#e53e3e':(Game.mode==='FLAG_DEFEND'?'#3182ce':'#ecc94b');ctx.beginPath();ctx.moveTo(mousePos.x,mousePos.y-30);ctx.lineTo(mousePos.x+15,mousePos.y-22);ctx.lineTo(mousePos.x,mousePos.y-15);ctx.fill();
            if (Game.mode === 'FLAG_GROUP_ATTACK') { ctx.fillStyle='white'; ctx.font='16px Arial'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('🍻', mousePos.x + 18, mousePos.y - 22); }
            if(Game.mode==='FLAG_DEFEND'){ctx.beginPath();ctx.arc(mousePos.x,mousePos.y,40,0,Math.PI*2);ctx.setLineDash([5,5]);ctx.strokeStyle='rgba(49,130,206,0.5)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='white';ctx.font='12px Arial';ctx.fillText("Click Building",mousePos.x+30,mousePos.y-15);}

            if (Game.mode === 'FLAG_GROUP_ATTACK' && Game.selectedTavernForGroupQuest) {
                ctx.globalAlpha=1.0;
                const t = Game.selectedTavernForGroupQuest;
                const bounceY = Math.sin(Game.timeMs * 0.01) * 8;
                ctx.save();
                ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
                ctx.shadowBlur = 15;
                ctx.font = '30px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('👇', t.pos.x, t.pos.y - t.radius - 40 + bounceY);
                ctx.restore();
            }
        }
        ctx.globalAlpha=1.0;
    }
    ctx.restore();

    Game.floatingTexts.forEach(ft => {
        if(!Game.isPosVisible(ft.pos)) {
            ft.el.style.display = 'none';
        } else {
            ft.el.style.display = 'block';
            const screenX = (ft.pos.x - Camera.x) * Camera.zoom + canvas.width / 2;
            const screenY = (ft.pos.y - Camera.y) * Camera.zoom + canvas.height / 2;
            ft.el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%) scale(${Camera.zoom})`;
            ft.el.style.opacity = ft.life / ft.maxLife;
        }
    });

    Game.positionUI();
}
window.addEventListener('resize', () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; });
window.onload = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; init(); };
</script>
</body>
</html>
