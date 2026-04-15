const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const mongoose = require("mongoose");
require("dotenv").config();
const cfg = require("./config");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

mongoose.connect(process.env.MONGO_URI);

/* ───── DATABASE ───── */
const User = mongoose.model("User", new mongoose.Schema({
  userId: String,
  cash: Number,
  pet: Object,
  pets: Array,
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  cooldowns: Object,
  accepted: Boolean
}));

const Raid = mongoose.model("Raid", new mongoose.Schema({
  guildId: String,
  bank: Number
}));

const Season = mongoose.model("Season", new mongoose.Schema({
  start: Number,
  end: Number
}));

/* ───── NPC AI RESPONSE SYSTEM 🧠 */
const npc = [
  "The dealer eyes you suspiciously...",
  "A gambler whispers: 'today feels lucky...'",
  "The economy shifts slightly...",
  "A pet growls in the distance...",
  "The bank security weakens for a moment..."
];

const say = () => npc[Math.floor(Math.random()*npc.length)];

/* ───── HELPERS ───── */
const E = (t,d,c="#ff004c") =>
  new EmbedBuilder().setTitle(t).setDescription(d).setColor(c);

const cd = (u,k,t)=>{
  if(!u.cooldowns) u.cooldowns={};
  if(u.cooldowns[k] && Date.now()<u.cooldowns[k])
    return Math.ceil((u.cooldowns[k]-Date.now())/1000);
  u.cooldowns[k]=Date.now()+t;
  return 0;
};

const multi = u =>
  1 + (u.pet?.multi || 0);

/* ───── READY ───── */
client.once("ready",()=>{
  console.log("🔥 HOUSE OF MB V2 — REALITY ENGINE ONLINE");
});

/* ───── COMMAND ROUTER ───── */
client.on("messageCreate", async m=>{
  if(!m.content.startsWith(cfg.prefix)||m.author.bot) return;

  const args=m.content.slice(cfg.prefix.length).trim().split(/ +/);
  const cmd=args.shift()?.toLowerCase();

  let u=await User.findOne({userId:m.author.id});
  if(!u) u=await User.create({userId:m.author.id,cash:cfg.economy.startCash,pets:[],cooldowns:{}});

  const flavor = say();

  /* ───── HELP (REALISTIC UI) ───── */
  if(cmd==="help"){
    const row=new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("casino").setLabel("🎰 Casino").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("pets").setLabel("🐾 Pets").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("raid").setLabel("🏦 Raids").setStyle(ButtonStyle.Secondary)
    );

    return m.reply({
      embeds:[E("🏠 House of MB",`${flavor}\n\nEconomy simulation active.`)],
      components:[row]
    });
  }

  if(!u.accepted && cmd!=="accept")
    return m.reply("⚠️ You must open help first.");

  /* ───── BAL ───── */
  if(cmd==="bal")
    return m.reply(E("💰 Wallet",`Cash: $${u.cash}\n${flavor}`));

  /* ───── DAILY ───── */
  if(cmd==="daily"){
    const w=cd(u,"daily",86400000);
    if(w) return m.reply(`⏳ ${flavor}`);

    u.cash+=Math.floor(cfg.economy.daily*multi(u));
    await u.save();

    return m.reply(E("🎁 Daily Collected",flavor));
  }

  /* ───── CASINO ───── */
  if(cmd==="slots"){
    const bet=parseInt(args[0]);
    const win=Math.random()<0.5;

    u.cash+=win?bet*cfg.casino.slotsMulti:-bet;
    u.wins+=win?1:0;
    u.losses+=win?0:1;

    await u.save();

    return m.reply(E("🎰 Slots",`${flavor}\n${win?"WIN":"LOSS"}`));
  }

  if(cmd==="blackjack"){
    const bet=parseInt(args[0]);
    const p=Math.floor(Math.random()*21)+1;
    const d=Math.floor(Math.random()*21)+1;

    const win=p>d&&p<=21;

    u.cash+=win?bet*2:-bet;
    await u.save();

    return m.reply(E("🃏 Blackjack",`${flavor}\nYou:${p} Dealer:${d}`));
  }

  if(cmd==="jackpot"){
    const bet=parseInt(args[0]);
    const win=Math.random()<cfg.casino.jackpotChance;

    u.cash+=win?bet*10:-bet;
    await u.save();

    return m.reply(E("🎲 Jackpot",`${flavor}\n${win?"MEGA WIN":"TRY AGAIN"}`));
  }

  /* ───── PETS ───── */
  if(cmd==="pets"){
    return m.reply(E("🐾 Pet Market","cat • wolf • dragon"));
  }

  if(cmd==="buypet"){
    const p=cfg.pets.list[args[0]];
    if(!p||u.cash<p.cost) return m.reply("❌ not available");

    u.cash-=p.cost;
    u.pet=p;

    await u.save();
    return m.reply(E("🐾 Pet Acquired",flavor));
  }

  if(cmd==="fuse"){
    if(u.pets.length<2) return m.reply("❌ need more pets");

    const a=u.pets.pop();
    const b=u.pets.pop();

    const fused={
      name:`${a.name}-${b.name}`,
      multi:(a.multi+b.multi)*1.8
    };

    u.pet=fused;
    await u.save();

    return m.reply(E("🧬 Fusion Success",flavor));
  }

  /* ───── RAID SYSTEM ───── */
  if(cmd==="raid"){
    let r=await Raid.findOne({guildId:m.guild.id});
    if(!r) r=await Raid.create({guildId:m.guild.id,bank:cfg.raids.baseBank});

    const win=Math.random()<0.5;

    u.cash+=win?r.bank:-5000;
    r.bank=win?0:r.bank+5000;

    await r.save();
    await u.save();

    return m.reply(E("🏦 Raid Event",`${flavor}\n${win?"BANK BROKEN":"DEFENDED"}`));
  }

  /* ───── ADMIN ───── */
  if(cmd==="inject"&&cfg.admins.includes(m.author.id)){
    u.cash+=parseInt(args[0]);
    await u.save();
    return m.reply("💉 injected reality shift");
  }

  if(cmd==="wipe"&&cfg.admins.includes(m.author.id)){
    await User.deleteMany({});
    return m.reply("☢️ world reset");
  }

  await u.save();
});

client.login(process.env.TOKEN);
