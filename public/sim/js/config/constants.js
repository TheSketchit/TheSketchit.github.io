export const WORLD_WIDTH = 1500;
export const WORLD_HEIGHT = 1000;

export const UI = {
  colors: {
    hpBg: "#2d3748",
    hpFg: "#48bb78",
    manaBg: "#2d3748",
    manaFg: "#4299e1",
    shieldBg: "#4a5568",
    shieldFg: "#cbd5e0",
    expBg: "#2d3748",
    expFg: "#9f7aea",
    gold: "#ecc94b",
    textShadow: "rgba(0,0,0,0.8)",
  },
  barWidth: 32,
  barHeight: 4,
  drawBar(ctx, x, y, width, height, ratio, bg, fg, border = true) {
    if (border) {
      ctx.fillStyle = "#1a202c";
      ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
    }
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), height);
  },
  drawText(ctx, text, x, y, font, color, align = "center", outline = true) {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    if (outline) {
      ctx.fillStyle = "black";
      ctx.fillText(text, x - 1, y - 1);
      ctx.fillText(text, x + 1, y - 1);
      ctx.fillText(text, x - 1, y + 1);
      ctx.fillText(text, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  },
};

export const ITEM_CONFIG = {
  POTION: { name: "Health Potion", cost: 50, icon: "🧪", slot: "consumable" },
  WOODEN_SWORD: {
    name: "Wooden Sword",
    cost: 50,
    icon: "🗡️",
    slot: "weapon",
    stat: "atk",
    val: 5,
  },
  IRON_SWORD: {
    name: "Iron Sword",
    cost: 150,
    icon: "⚔️",
    slot: "weapon",
    stat: "atk",
    val: 12,
    replaces: "WOODEN_SWORD",
  },
  LEATHER_ARMOR: {
    name: "Leather Armor",
    cost: 75,
    icon: "🦺",
    slot: "armor",
    stat: "hp",
    val: 20,
  },
  IRON_ARMOR: {
    name: "Iron Armor",
    cost: 200,
    icon: "🛡️",
    slot: "armor",
    stat: "hp",
    val: 50,
    replaces: "LEATHER_ARMOR",
  },
  MAGIC_WAND: {
    name: "Magic Wand",
    cost: 60,
    icon: "🪄",
    slot: "weapon",
    stat: "atk",
    val: 4,
  },
  OAK_STAFF: {
    name: "Oak Staff",
    cost: 160,
    icon: "🦯",
    slot: "weapon",
    stat: "atk",
    val: 10,
    replaces: "MAGIC_WAND",
  },
  ROBES: {
    name: "Apprentice Robes",
    cost: 50,
    icon: "👘",
    slot: "armor",
    stat: "hp",
    val: 10,
  },
  MYSTIC_ROBES: {
    name: "Mystic Robes",
    cost: 150,
    icon: "🧥",
    slot: "armor",
    stat: "hp",
    val: 30,
    replaces: "ROBES",
  },
  DAGGERS: {
    name: "Iron Daggers",
    cost: 55,
    icon: "🔪",
    slot: "weapon",
    stat: "atk",
    val: 6,
  },
  STEEL_DAGGERS: {
    name: "Steel Daggers",
    cost: 170,
    icon: "🗡️",
    slot: "weapon",
    stat: "atk",
    val: 14,
    replaces: "DAGGERS",
  },
  CLOAK: {
    name: "Thief Cloak",
    cost: 65,
    icon: "🧥",
    slot: "armor",
    stat: "hp",
    val: 15,
  },
  SHADOW_CLOAK: {
    name: "Shadow Cloak",
    cost: 180,
    icon: "🥷",
    slot: "armor",
    stat: "hp",
    val: 40,
    replaces: "CLOAK",
  },
  ROGUES_DISGUISE: {
    name: "Rogue's Disguise",
    cost: 100,
    icon: "🎭",
    slot: "accessory",
    desc: "Provides stealth against some enemies.",
  },
};

export const HERO_CONFIG = {
  WARRIOR: {
    icon: "⚔️",
    hp: 120,
    atk: 12,
    spd: 75,
    range: 30,
    color: "#e53e3e",
    desiredItems: ["POTION", "WOODEN_SWORD", "LEATHER_ARMOR"],
    upgradeItems: ["IRON_SWORD", "IRON_ARMOR"],
    attackType: "MELEE",
    atkRate: 1.5,
  },
  ROGUE: {
    icon: "🥷",
    hp: 80,
    atk: 18,
    spd: 100,
    range: 25,
    color: "#38b2ac",
    desiredItems: ["POTION", "DAGGERS", "CLOAK", "ROGUES_DISGUISE"],
    upgradeItems: ["STEEL_DAGGERS", "SHADOW_CLOAK"],
    attackType: "MELEE",
    atkRate: 0.8,
  },
  DRUID: {
    icon: "🌿",
    hp: 90,
    atk: 10,
    spd: 80,
    range: 150,
    color: "#48bb78",
    desiredItems: ["POTION", "MAGIC_WAND", "ROBES"],
    upgradeItems: ["OAK_STAFF", "MYSTIC_ROBES"],
    attackType: "RANGED_MAGIC",
    atkRate: 2.0,
  },
};

export const UPGRADE_CONFIG = {
  CHARGE: { name: "Charge", cost: 150, desc: "Warriors charge at targets." },
  RAT_TRAP: { name: "Rat Trap", cost: 150, desc: "Rogues place rat traps." },
  REGROWTH: { name: "Regrowth", cost: 200, desc: "Druids periodically heal." },
  MED_TENT: {
    name: "Medical Tent",
    cost: 100,
    desc: "Heals heroes at this guild.",
  },
};

export const BUILDING_CONFIG = {
  WARRIOR_GUILD: {
    type: "WARRIOR_GUILD",
    name: "Warrior Guild",
    icon: "⚔️",
    cost: 300,
    radius: 45,
    color: "#9b2c2c",
    maxHp: 500,
    heroClass: "WARRIOR",
  },
  ROGUE_GUILD: {
    type: "ROGUE_GUILD",
    name: "Rogue Guild",
    icon: "🥷",
    cost: 300,
    radius: 45,
    color: "#285e61",
    maxHp: 400,
    heroClass: "ROGUE",
  },
  DRUID_GUILD: {
    type: "DRUID_GUILD",
    name: "Druid Guild",
    icon: "🌿",
    cost: 300,
    radius: 45,
    color: "#276749",
    maxHp: 400,
    heroClass: "DRUID",
  },
  SHOP: {
    type: "SHOP",
    name: "Shop",
    icon: "🏦",
    cost: 100,
    radius: 40,
    color: "#b7791f",
    maxHp: 300,
  },
  FARM: {
    type: "FARM",
    name: "Farm",
    icon: "🏡",
    cost: 150,
    radius: 35,
    color: "#744210",
    maxHp: 200,
  },
  TOWER: {
    type: "TOWER",
    name: "Tower",
    icon: "🖲️",
    cost: 500,
    radius: 30,
    color: "#4a5568",
    maxHp: 400,
  },
  TAVERN: {
    type: "TAVERN",
    name: "Tavern",
    icon: "🎪",
    cost: 200,
    radius: 45,
    color: "#805ad5",
    maxHp: 400,
  },
};

export const BASE_HERO_NAMES = [
  "Thorek",
  "Elara",
  "Kael",
  "Lyra",
  "Grom",
  "Sira",
  "Faelan",
  "Nyx",
  "Aric",
  "Vanya",
  "Bram",
  "Cora",
  "Doran",
  "Elin",
  "Finn",
  "Gael",
  "Hala",
  "Ilan",
  "Jace",
  "Kira",
  "Leon",
  "Mira",
  "Nero",
  "Orin",
  "Pia",
  "Quin",
  "Rian",
  "Zara",
];
