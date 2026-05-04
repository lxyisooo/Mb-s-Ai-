const { SlashCommandBuilder } = require("discord.js");
require("dotenv").config();
const OpenAI = require("openai");

const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ================= STATE ================= */

const channelMemory = new Map();
const cooldowns = new Map();

module.exports = (client) => {

  const PREFIX = "?ai";

  /* ================= MESSAGE FLOW ================= */

  client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    trackContext(msg);

    const shouldRespond = evaluateMessage(msg);

    // 👀 passive reactions always allowed
    maybeReact(msg);

    if (!shouldRespond) return;

    if (onCooldown(msg.channel.id)) return;

    cooldowns.set(msg.channel.id, Date.now());

    let prompt = extractPrompt(msg);

    await naturalDelay();

    await msg.channel.sendTyping();

    const thinking = await msg.reply("…");

    const reply = await generateAI(prompt, msg);

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

/* ================= DECISION ENGINE (FIXED) ================= */

function evaluateMessage(msg) {
  const text = msg.content.toLowerCase();

  const mentioned = msg.mentions.has(msg.client.user);
  const repliedToBot = msg.reference?.messageId;

  const isQuestion = text.includes("?");
  const isChatty = text.length > 25;

  const chance = Math.random();

  // 🎯 always respond to direct interaction
  if (mentioned || repliedToBot) return true;

  if (isQuestion && chance < 0.55) return true;

  /* 🔥 FIX: add activity-based presence scaling */
  const activityBoost = Math.min(0.25, (msg.channel.lastMessageCount || 10) / 80);

  if (isChatty && chance < (0.03 + activityBoost)) return true;

  // 💬 rare "opinion flicker"
  if (chance < (0.008 + activityBoost)) return true;

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

  if (mem.length > 15) mem.shift(); // slightly more memory = better flow
}

/* ================= AI CORE ================= */

async function generateAI(prompt, msg) {

  const username =
    msg.author?.username ||
    msg.user?.username ||
    "user";

  const context = getContext(msg.channel.id);

  try {
    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a Discord server AI personality.

CORE:
- You are NOT human
- You behave like a real Discord member
- You are observant, funny, slightly sarcastic
- You do not reply to everything
- You prefer short, natural responses

BEHAVIOR:
- mostly react energy
- sometimes comment naturally
- joins conversations only when relevant
- adapts to chat context

TONE:
- casual Discord vibe
- light humor
- natural flow, not scripted slang spam

CONTEXT:
${context}
          `
        },
        {
          role: "user",
          content: `${username}: ${prompt}`
        }
      ],
      temperature: 1.1
    });

    return polish(res.choices[0].message.content);

  } catch (e) {
    console.error(e);
    return "brain lagged 💀";
  }
}

/* ================= CONTEXT ================= */

function getContext(channelId) {
  const mem = channelMemory.get(channelId) || [];
  return mem.map(m => `${m.user}: ${m.content}`).join("\n");
}

/* ================= FIX: MISSING FUNCTION ================= */

function extractPrompt(msg) {
  const PREFIX = "?ai";

  if (msg.content.startsWith(PREFIX)) {
    return msg.content.slice(PREFIX.length).trim();
  }

  if (msg.mentions.has(msg.client.user)) {
    return msg.content.replace(`<@${msg.client.user.id}>`, "").trim();
  }

  return msg.content;
}

/* ================= HUMAN BEHAVIOR ================= */

function onCooldown(channelId) {
  const last = cooldowns.get(channelId) || 0;
  return Date.now() - last < 4500;
}

function humanDelay() {
  return 500 + Math.random() * 1400;
}

async function naturalDelay() {
  await new Promise(r => setTimeout(r, 150 + Math.random() * 600));
}

/* ================= REACTIONS ================= */

function maybeReact(msg) {
  const reacts = ["😂", "💀", "🔥", "👍", "😭", "🤨"];

  if (Math.random() < 0.22) {
    msg.react(reacts[Math.floor(Math.random() * reacts.length)])
      .catch(() => {});
  }
}

/* ================= STYLE ================= */

function polish(text) {
  const endings = ["", " fr", " ngl", " 💀", " 😭"];

  if (Math.random() < 0.3) {
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
