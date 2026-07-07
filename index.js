// ─────────────────────────────────────────────────────────────────────────
// Caption Bot — post an image, collect anonymous captions, vote, announce a
// winner, and keep a per-server leaderboard. Contests survive a restart.
// ─────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const db = require('./db');
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
} = require('discord.js');

// ── Config ─────────────────────────────────────────────────────────────
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional: instant command registration in one server
const SUBMIT_MINUTES = parseFloat(process.env.CAPTION_SUBMIT_MINUTES || '10');
const VOTE_MINUTES = parseFloat(process.env.CAPTION_VOTE_MINUTES || '5');
const MAX_ENTRIES = 10; // capped so we can use single-digit number emoji reactions

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment variables.');
  process.exit(1);
}

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const MEDALS = ['🥇', '🥈', '🥉'];

// ── In-memory contest state (keyed by guild id), backed by db.js ────────
// One active contest per server at a time.
// contest = {
//   id, channelId, imageUrl, phase: 'submitting'|'voting',
//   captions: Map<userId, text>, submitMessageId, voteMessageId,
//   submitTimer, voteTimer, hostId, submitEndsAt, voteEndsAt, orderedEntries
// }
const contests = new Map();

function newContestId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function persistContest(guildId) {
  const contest = contests.get(guildId);
  if (contest) db.saveContest(guildId, contest);
}

// ── Slash command definitions ─────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('caption-new')
    .setDescription('Start a new caption contest with an image')
    .addAttachmentOption((opt) =>
      opt.setName('image').setDescription('The image to caption').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('caption-end')
    .setDescription('End submissions early and move to the voting phase')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('caption-results')
    .setDescription('End voting early and announce the winner')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('caption-cancel')
    .setDescription('Cancel the current caption contest')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('caption-status')
    .setDescription('Show the status of the current caption contest'),

  new SlashCommandBuilder()
    .setName('caption-leaderboard')
    .setDescription('Show the top caption-contest winners in this server'),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`Registered commands to guild ${GUILD_ID} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Registered global commands (may take up to 1 hour to appear).');
    }
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
}

// ── Discord client ─────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessageReactions],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  await registerCommands();
  await restoreContests();
});

// ── Restore any in-progress contests after a restart ────────────────────
async function restoreContests() {
  const stored = db.getAllContests();
  const guildIds = Object.keys(stored);
  if (guildIds.length === 0) return;

  console.log(`Restoring ${guildIds.length} contest(s) from disk...`);
  const now = Date.now();

  for (const guildId of guildIds) {
    const s = stored[guildId];
    const contest = {
      id: s.id,
      channelId: s.channelId,
      imageUrl: s.imageUrl,
      phase: s.phase,
      hostId: s.hostId,
      submitMessageId: s.submitMessageId,
      voteMessageId: s.voteMessageId,
      submitEndsAt: s.submitEndsAt,
      voteEndsAt: s.voteEndsAt,
      captions: new Map(Object.entries(s.captions || {})),
      orderedEntries: s.orderedEntries || null,
    };
    contests.set(guildId, contest);

    if (contest.phase === 'submitting') {
      const remaining = Math.max(0, (contest.submitEndsAt || now) - now);
      contest.submitTimer = setTimeout(() => startVotingPhase(guildId), remaining);
    } else if (contest.phase === 'voting') {
      const remaining = Math.max(0, (contest.voteEndsAt || now) - now);
      contest.voteTimer = setTimeout(() => announceResults(guildId), remaining);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────
function buildSubmitEmbed(contest, phaseNote) {
  return new EmbedBuilder()
    .setTitle('📸 Caption Contest!')
    .setDescription(
      `Click **Submit Caption** below to enter.\nOne entry per person — submitting again replaces your old caption.\n\n${phaseNote}`
    )
    .setImage(contest.imageUrl)
    .setColor(0x5865f2)
    .setFooter({ text: `Entries so far: ${contest.captions.size}/${MAX_ENTRIES}` });
}

function buildSubmitRow(contestId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`caption_submit:${contestId}`)
      .setLabel('Submit Caption')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✍️')
      .setDisabled(disabled)
  );
}

async function startVotingPhase(guildId) {
  const contest = contests.get(guildId);
  if (!contest || contest.phase !== 'submitting') return;
  contest.phase = 'voting';
  if (contest.submitTimer) clearTimeout(contest.submitTimer);

  const channel = await client.channels.fetch(contest.channelId).catch(() => null);
  if (!channel) return;

  // Lock the submit button on the original message
  try {
    const submitMsg = await channel.messages.fetch(contest.submitMessageId);
    await submitMsg.edit({
      embeds: [buildSubmitEmbed(contest, '🔒 Submissions are closed. Voting has started below!')],
      components: [buildSubmitRow(contest.id, true)],
    });
  } catch (_) {}

  if (contest.captions.size === 0) {
    await channel.send('😅 Nobody submitted a caption — contest cancelled.');
    contests.delete(guildId);
    db.deleteContest(guildId);
    return;
  }

  const entries = [...contest.captions.entries()].slice(0, MAX_ENTRIES);
  contest.orderedEntries = entries; // [ [userId, text], ... ] index = emoji index

  const description = entries
    .map(([, text], i) => `${NUMBER_EMOJIS[i]}  ${text}`)
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('🗳️ Vote for the best caption!')
    .setDescription(description)
    .setImage(contest.imageUrl)
    .setColor(0xfee75c)
    .setFooter({ text: `React below to vote • Results in ${VOTE_MINUTES} min` });

  const voteMsg = await channel.send({ embeds: [embed] });
  contest.voteMessageId = voteMsg.id;

  for (let i = 0; i < entries.length; i++) {
    await voteMsg.react(NUMBER_EMOJIS[i]);
  }

  contest.voteEndsAt = Date.now() + VOTE_MINUTES * 60 * 1000;
  contest.voteTimer = setTimeout(() => announceResults(guildId), VOTE_MINUTES * 60 * 1000);
  persistContest(guildId);
}

async function announceResults(guildId) {
  const contest = contests.get(guildId);
  if (!contest || contest.phase !== 'voting') return;
  if (contest.voteTimer) clearTimeout(contest.voteTimer);

  const channel = await client.channels.fetch(contest.channelId).catch(() => null);
  if (!channel) {
    contests.delete(guildId);
    db.deleteContest(guildId);
    return;
  }

  const voteMsg = await channel.messages.fetch(contest.voteMessageId).catch(() => null);
  if (!voteMsg) {
    await channel.send('⚠️ Could not find the voting message to tally results.');
    contests.delete(guildId);
    db.deleteContest(guildId);
    return;
  }

  const entries = contest.orderedEntries || [];
  let best = { count: -1, indices: [] };

  for (let i = 0; i < entries.length; i++) {
    const reaction = voteMsg.reactions.cache.get(NUMBER_EMOJIS[i]);
    const count = reaction ? Math.max(0, reaction.count - 1) : 0; // subtract bot's own reaction
    if (count > best.count) {
      best = { count, indices: [i] };
    } else if (count === best.count) {
      best.indices.push(i);
    }
  }

  if (entries.length === 0 || best.count <= 0) {
    await channel.send('🤷 No votes were cast — no winner this time!');
    contests.delete(guildId);
    db.deleteContest(guildId);
    return;
  }

  if (best.indices.length > 1) {
    const tiedText = best.indices.map((i) => `"${entries[i][1]}" (<@${entries[i][0]}>)`).join(', ');
    await channel.send(`🤝 It's a tie with ${best.count} vote(s) each between: ${tiedText}`);
    // No win recorded on a tie — nobody uniquely won.
  } else {
    const [winnerId, winnerText] = entries[best.indices[0]];
    const embed = new EmbedBuilder()
      .setTitle('🏆 We have a winner!')
      .setDescription(`**"${winnerText}"**\n\nSubmitted by <@${winnerId}>`)
      .setImage(contest.imageUrl)
      .setColor(0x57f287)
      .setFooter({ text: `${best.count} vote(s)` });
    await channel.send({ embeds: [embed] });
    db.addWin(guildId, winnerId);
  }

  contests.delete(guildId);
  db.deleteContest(guildId);
}

// ── Interaction handling ────────────────────────────────────────────────
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith('caption_submit:')) {
      await handleSubmitButton(interaction);
    } else if (interaction.isModalSubmit() && interaction.customId.startsWith('caption_modal:')) {
      await handleModalSubmit(interaction);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true }).catch(() => {});
    }
  }
});

async function handleSlashCommand(interaction) {
  const { commandName, guildId } = interaction;

  if (commandName === 'caption-new') {
    if (contests.has(guildId)) {
      return interaction.reply({
        content: '⚠️ There is already an active caption contest in this server. Use `/caption-cancel` first.',
        ephemeral: true,
      });
    }

    const attachment = interaction.options.getAttachment('image', true);
    if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
      return interaction.reply({ content: '⚠️ Please attach a valid image file.', ephemeral: true });
    }

    const contest = {
      id: newContestId(),
      channelId: interaction.channelId,
      imageUrl: attachment.url,
      phase: 'submitting',
      captions: new Map(),
      hostId: interaction.user.id,
      submitEndsAt: Date.now() + SUBMIT_MINUTES * 60 * 1000,
    };
    contests.set(guildId, contest);

    await interaction.reply({
      embeds: [buildSubmitEmbed(contest, `⏳ Submissions close in ${SUBMIT_MINUTES} min.`)],
      components: [buildSubmitRow(contest.id)],
    });
    const sentMsg = await interaction.fetchReply();
    contest.submitMessageId = sentMsg.id;

    contest.submitTimer = setTimeout(() => startVotingPhase(guildId), SUBMIT_MINUTES * 60 * 1000);
    persistContest(guildId);
    return;
  }

  if (commandName === 'caption-end') {
    const contest = contests.get(guildId);
    if (!contest || contest.phase !== 'submitting') {
      return interaction.reply({ content: '⚠️ No contest is currently accepting submissions.', ephemeral: true });
    }
    await interaction.reply({ content: '✅ Ending submissions and starting voting…', ephemeral: true });
    await startVotingPhase(guildId);
    return;
  }

  if (commandName === 'caption-results') {
    const contest = contests.get(guildId);
    if (!contest || contest.phase !== 'voting') {
      return interaction.reply({ content: '⚠️ No contest is currently in the voting phase.', ephemeral: true });
    }
    await interaction.reply({ content: '✅ Tallying votes…', ephemeral: true });
    await announceResults(guildId);
    return;
  }

  if (commandName === 'caption-cancel') {
    const contest = contests.get(guildId);
    if (!contest) {
      return interaction.reply({ content: '⚠️ No active contest to cancel.', ephemeral: true });
    }
    if (contest.submitTimer) clearTimeout(contest.submitTimer);
    if (contest.voteTimer) clearTimeout(contest.voteTimer);
    contests.delete(guildId);
    db.deleteContest(guildId);
    return interaction.reply({ content: '🗑️ Caption contest cancelled.' });
  }

  if (commandName === 'caption-status') {
    const contest = contests.get(guildId);
    if (!contest) {
      return interaction.reply({ content: 'No active caption contest right now.', ephemeral: true });
    }
    return interaction.reply({
      content: `**Phase:** ${contest.phase}\n**Entries:** ${contest.captions.size}/${MAX_ENTRIES}`,
      ephemeral: true,
    });
  }

  if (commandName === 'caption-leaderboard') {
    const top = db.getLeaderboard(guildId, 10);
    if (top.length === 0) {
      return interaction.reply({ content: 'No caption contest wins recorded in this server yet.' });
    }
    const lines = top.map(([userId, wins], i) => {
      const rank = MEDALS[i] || `${i + 1}.`;
      return `${rank} <@${userId}> — **${wins}** win${wins === 1 ? '' : 's'}`;
    });
    const embed = new EmbedBuilder()
      .setTitle('🏆 Caption Contest Leaderboard')
      .setDescription(lines.join('\n'))
      .setColor(0xf1c40f);
    return interaction.reply({ embeds: [embed] });
  }
}

async function handleSubmitButton(interaction) {
  const contestId = interaction.customId.split(':')[1];
  const contest = contests.get(interaction.guildId);

  if (!contest || contest.id !== contestId || contest.phase !== 'submitting') {
    return interaction.reply({ content: '⚠️ This contest is no longer accepting submissions.', ephemeral: true });
  }

  if (contest.captions.size >= MAX_ENTRIES && !contest.captions.has(interaction.user.id)) {
    return interaction.reply({
      content: `⚠️ Sorry, this contest is capped at ${MAX_ENTRIES} entries and it's full.`,
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`caption_modal:${contestId}`)
    .setTitle('Submit Your Caption');

  const input = new TextInputBuilder()
    .setCustomId('caption_text')
    .setLabel('Your caption')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(200)
    .setRequired(true);

  const existing = contest.captions.get(interaction.user.id);
  if (existing) input.setValue(existing);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  const contestId = interaction.customId.split(':')[1];
  const contest = contests.get(interaction.guildId);

  if (!contest || contest.id !== contestId || contest.phase !== 'submitting') {
    return interaction.reply({ content: '⚠️ This contest is no longer accepting submissions.', ephemeral: true });
  }

  const text = interaction.fields.getTextInputValue('caption_text').trim();
  if (!text) {
    return interaction.reply({ content: '⚠️ Caption cannot be empty.', ephemeral: true });
  }

  const isNew = !contest.captions.has(interaction.user.id);
  if (!isNew || contest.captions.size < MAX_ENTRIES) {
    contest.captions.set(interaction.user.id, text);
  } else {
    return interaction.reply({
      content: `⚠️ Sorry, this contest is capped at ${MAX_ENTRIES} entries and it's full.`,
      ephemeral: true,
    });
  }

  await interaction.reply({ content: '✅ Your caption has been submitted!', ephemeral: true });
  persistContest(interaction.guildId);

  // Update the entry counter on the original message
  const channel = await client.channels.fetch(contest.channelId).catch(() => null);
  if (channel) {
    const submitMsg = await channel.messages.fetch(contest.submitMessageId).catch(() => null);
    if (submitMsg) {
      await submitMsg
        .edit({
          embeds: [buildSubmitEmbed(contest, `⏳ Submissions are open.`)],
          components: [buildSubmitRow(contest.id)],
        })
        .catch(() => {});
    }
  }
}

// ── Tiny web server so Render's free/web-service tier sees an open port ─
const app = express();
app.get('/', (_req, res) => res.send('Caption bot is alive.'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Health check server listening on port ${port}`));

client.login(TOKEN);
