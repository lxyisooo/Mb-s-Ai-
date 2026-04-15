const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
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
  cash: { type: Number, default: cfg.economy.startCash },
  pets: { type: Array, default: [] }
}));

const Jackpot = mongoose.model("Jackpot", new mongoose.Schema({
  userId: String,
  amount: Number,
  time: Number
}));

const Raid = mongoose.model("Raid", new mongoose.Schema({
  guildId: String,
  bank: Number,
  active: Boolean
}));

/* ───── HELPERS ───── */
const E = (t,d,c="#ff004c") => new EmbedBuilder().setTitle(t).setDescription(d).setColor(c);
const rand = arr => arr[Math.floor(Math.random()*arr.length)];

/* ───── JACKPOT LEADERBOARD 😈 ───── */
async function addJackpot(userId, amount){
  await Jackpot.create({userId, amount, time:Date.now()});
}

/* ───── PET FUSION 🧬 ───── */
function fusePets(u){
  if(u.pets.length < 2) return null;

  const p1 = u.pets.pop();
  const p2 = u.pets.pop();

  return {
    name: `${p1.name}-${p2.name}-FUSED`,
    power: (p1.power + p2.power) * cfg.pets.fusionMultiplier,
    multi: (p1.multi + p2.multi) * cfg.pets.fusionMultiplier
  };
}

/* ───── BLACKJACK AI 🎰 ───── */
function drawCard(){
  return Math.floor(Math.random()*11)+1;
}

function dealerPlay(){
  let hand = [drawCard(), drawCard()];
  while(hand.reduce((a,b)=>a+b,0) < cfg.blackjack.dealerStand){
    hand.push(drawCard());
  }
  return hand.reduce((a,b)=>a+b,0);
}

/* ───── RAID SYSTEM 🏦 ───── */
async function getRaid(guildId){
  let r = await Raid.findOne({guildId});
  if(!r) r = await Raid.create({guildId, bank: 100000, active:false});
  return r;
}

/* ───── READY ───── */
client.once("ready",()=>console.log("🔥 HOUSE OF MB — FINAL GOD CORE ONLINE"));

/* ───── COMMANDS ───── */
client.on("messageCreate", async m=>{
  if(!m.content.startsWith(cfg.prefix)||m.author.bot) return;

  const args = m.content.slice(cfg.prefix.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();

  let u = await User.findOne({userId:m.author.id});
  if(!u) u = await User.create({userId:m.author.id});

  /* 🎲 JACKPOT */
  if(cmd==="jackpot"){
    const bet = parseInt(args[0]);
    const win = Math.random() < 0.4;

    if(win){
      const reward = bet*5;
      u.cash += reward;
      await addJackpot(m.author.id,reward);
    } else {
      u.cash -= bet;
    }

    await u.save();
    return m.reply({embeds:[E("🎲 Jackpot", win?`WIN +$${bet*5}`:`LOSS -$${bet}`)]});
  }

  /* 🧬 PET FUSION */
  if(cmd==="fuse"){
    const fused = fusePets(u);
    if(!fused) return m.reply("Need 2 pets");

    u.pets.push(fused);
    await u.save();

    return m.reply({embeds:[E("🧬 Fusion Complete",`${fused.name} created!`)]});
  }

  /* 🏦 RAID SYSTEM */
  if(cmd==="raid"){
    const r = await getRaid(m.guild.id);

    const success = Math.random() < 0.5;
    if(success){
      u.cash += r.bank;
      r.bank = 0;
    } else {
      u.cash -= 5000;
      r.bank += 5000;
    }

    await r.save();
    await u.save();

    return m.reply({
      embeds:[E("🏦 RAID RESULT", success?"YOU STOLE THE BANK":"FAILED RAID")]
    });
  }

  /* 🎰 BLACKJACK */
  if(cmd==="blackjack"){
    const bet = parseInt(args[0]);

    let player = [drawCard(), drawCard()];
    let dealer = dealerPlay();

    let p = player.reduce((a,b)=>a+b,0);

    const win = p <= 21 && (p > dealer || dealer > 21);

    u.cash += win ? bet*2 : -bet;
    await u.save();

    return m.reply({
      embeds:[
        E("🎰 Blackjack",
          `You: ${p}\nDealer: ${dealer}\n\n${win?"WIN":"LOSS"}`)
      ]
    });
  }

  /* JACKPOT LEADERBOARD */
  if(cmd==="topjackpot"){
    const top = await Jackpot.find().sort({amount:-1}).limit(5);

    return m.reply({
      embeds:[E("🏆 Jackpot Legends",
        top.map((x,i)=>`#${i+1} <@${x.userId}> — $${x.amount}`).join("\n")
      )]
    });
  }

  await u.save();
});

client.login(process.env.TOKEN);
