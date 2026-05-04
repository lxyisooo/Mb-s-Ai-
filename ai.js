const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const OpenAI = require("openai");

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ================= STATE ================= */

const channelMemory = new Map(); // last messages per channel
const cooldowns = new Map();

module.exports = (client) => {

  const PREFIX = "?ai";

  /* ================= MESSAGE FLOW ================= */

  client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    trackContext(msg);

    const shouldRespond = evaluateMessage(msg);

    if (!shouldRespond) {
      maybeReact(msg);
      return;
    }

    if (onCooldown(msg.channel.id)) return;

    cooldowns.set(msg.channel.id, Date.now());

    let prompt = extractPrompt(msg);

    await naturalDelay();

    await msg.channel.sendTyping();

    const reply = await generateAI(prompt, msg);

    const thinking = await msg.reply("…");

    setTimeout(async () => {
      await thinking.edit(reply);
      maybeReact(thinking);
    }, humanDelay());
  });

  /* ================= SLASH ================= */

  client.on("interactionCreate", async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName !== "ai") return;

    await i.deferReply();

    const reply = await generateAI(i.options.getString("message"), i);

    await i.editReply(reply);
  });

};

/* ================= DECISION ENGINE ================= */

function evaluateMessage(msg) {
  const text = msg.content.toLowerCase();

  const mentioned = msg.mentions.has(msg.client.user);
  const repliedToBot = msg.reference?.messageId;

  const questions = /\?$/.test(text);
  const conversational = text.length > 30;

  const chance = Math.random();

  // priority triggers
  if (mentioned || repliedToBot) return true;
  if (questions && chance < 0.6) return true;

  // low probability "lurking participation"
  if (conversational && chance < 0.04) return true;

  return false;
}

/* ================= MEMORY ================= */

function trackContext(msg) {
  const id = msg.channel.id;

  if (!channelMemory.has(id)) channelMemory.set(id, []);

  const mem = channelMemory.get(id);

  mem.push({
    user: msg.author.username,
    content: msg.content
  });

  if (mem.length > 12) mem.shift();
}

/* ================= AI CORE ================= */

async function generateAI(prompt, msg) {
  const username = msg.user?.username || msg.author?.username || "user";
  const context = getContext(msg.channel.id);

  try {
    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a Discord server AI personality.

CORE BEHAVIOR:
- You are NOT human
- You are a conversational server AI
- You behave like a real Discord user in tone and timing
- You are observant, humorous, and context-aware
- You do not over-explain
- You do not respond to everything

SOCIAL BEHAVIOR:
- You prefer reacting over replying
- You join conversations only when relevant
- You occasionally make short comments naturally
- You adapt to ongoing conversation context

TONE:
- casual Discord chat energy
- light humor
- subtle sarcasm
- natural Gen Z tone (not forced slang)

CONTEXT:
${context}
          `
        },
        {
          role: "user",
          content: `${username}: ${prompt}`
        }
      ],
      temperature: 1.05
    });

    return polish(res.choices[0].message.content);

  } catch (e) {
    return "brain lagged 💀";
  }
}

/* ================= CONTEXT ================= */

function getContext(channelId) {
  const mem = channelMemory.get(channelId) || [];
  return mem.map(m => `${m.user}: ${m.content}`).join("\n");
}

/* ================= HUMAN BEHAVIOR SIM ================= */

function onCooldown(channelId) {
  const last = cooldowns.get(channelId) || 0;
  return Date.now() - last < 5000;
}

function humanDelay() {
  return 600 + Math.random() * 1800;
}

async function naturalDelay() {
  await new Promise(r => setTimeout(r, 200 + Math.random() * 800));
}

/* ================= REACTIONS ================= */

function maybeReact(msg) {
  const reacts = ["😂", "💀", "🔥", "👍", "😭","🤤","👀"];

  if (Math.random() < 0.18) {
    msg.react(reacts[Math.floor(Math.random() * reacts.length)])
      .catch(() => {});
  }
}

/* ================= STYLE ================= */

function polish(text) {
  const endings = ["", " fr", " ngl", " 💀", " 😭"];

  if (Math.random() < 0.25) {
    text += endings[Math.floor(Math.random() * endings.length)];
  }

  return text;
}

/* ================= SLASH ================= */

module.exports.slashCommand = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Talk to the server AI")
  .addStringOption(opt =>
    opt.setName("message")
      .setDescription("say something")
      .setRequired(true)
  );
