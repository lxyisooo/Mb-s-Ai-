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

    maybeReact(msg);

    const shouldRespond = evaluateMessage(msg);
    if (!shouldRespond) return;

    if (onCooldown(msg.channel.id)) return;
    cooldowns.set(msg.channel.id, Date.now());

    const prompt = extractPrompt(msg);

    await msg.channel.sendTyping();

    const thinking = await msg.reply("💭");

    const reply = await generateAI(prompt, msg);

    setTimeout(async () => {
      await thinking.edit(reply);
      maybeReact(thinking);
    }, humanDelay());
  });

  /* ================= SLASH COMMAND ================= */

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

  const isQuestion = text.includes("?");
  const isShort = msg.content.length < 120;

  const chance = Math.random();

  // 🔥 direct triggers ALWAYS respond
  if (mentioned || repliedToBot) return true;

  if (isQuestion && chance < 0.65) return true;

  // 🧠 real baseline presence (fix for silence issue)
  const baseChance = 0.05;

  if (isShort && chance < baseChance) return true;

  // 💬 rare spontaneous interjection
  if (chance < 0.01) return true;

  return false;
}

/* ================= CONTEXT MEMORY ================= */

function trackContext(msg) {
  const id = msg.channel.id;

  if (!channelMemory.has(id)) channelMemory.set(id, []);

  const mem = channelMemory.get(id);

  mem.push({
    user: msg.author.username,
    content: msg.content
  });

  if (mem.length > 15) mem.shift();
}

function getContext(channelId) {
  const mem = channelMemory.get(channelId) || [];
  return mem.map(m => `${m.user}: ${m.content}`).join("\n");
}

/* ================= PROMPT HANDLING ================= */

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

/* ================= AI CORE ================= */

async function generateAI(prompt, msg) {
  const username = msg.author.username;
  const context = getContext(msg.channel.id);

  try {
    const res = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a Discord AI personality living inside a server.

RULES:
- You are NOT human
- You behave like a real Discord member
- You are casual, funny, slightly sarcastic
- You respond naturally, not like a bot
- You prefer short, conversational replies
- You do not reply to everything

BEHAVIOR:
- react more than you talk
- join conversations only when relevant
- sometimes give short spontaneous comments
- read context before replying

TONE:
- chill Discord energy
- natural humor
- minimal slang, not forced

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

  } catch (err) {
    console.error(err);
    return "brain lagged 💀";
  }
}

/* ================= HUMAN BEHAVIOR ================= */

function onCooldown(channelId) {
  const last = cooldowns.get(channelId) || 0;
  return Date.now() - last < 4500;
}

function humanDelay() {
  return 600 + Math.random() * 1200;
}

/* ================= REACTIONS ================= */

function maybeReact(msg) {
  const reacts = ["😂", "💀", "🔥", "👍", "😭", "🤨"];

  if (Math.random() < 0.2) {
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

/* ================= SLASH COMMAND ================= */

module.exports.slashCommand = new SlashCommandBuilder()
  .setName("ai")
  .setDescription("Talk to the AI")
  .addStringOption(opt =>
    opt.setName("message")
      .setDescription("say something")
      .setRequired(true)
  );
