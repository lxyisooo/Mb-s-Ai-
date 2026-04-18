// Load environment variables (ESM-safe)
import 'dotenv/config';

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  REST,
  Routes
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

/* ─────────────── 🛡️ SLASH COMMAND REGISTRATION ─────────────── */

const commands = [
  {
    name: 'setup-roles',
    description: 'Deploys the full community role interface'
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔄 Deploying Slash Commands...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Commands Synced!');
  } catch (err) {
    console.error(err);
  }
})();

/* ─────────────── 🤖 INTERACTIONS ─────────────── */

client.on('interactionCreate', async (interaction) => {

  /* ── SLASH COMMAND ── */
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-roles') {

    const roleEmbed = new EmbedBuilder()
      .setTitle('💫 Community Role Center')
      .setDescription('Select your roles below to personalize your profile and get notified!')
      .setColor('#2b2d31')
      .addFields(
        { name: '👨‍👩‍👧 Family & Identity', value: 'Niece/Nephew & Pronouns', inline: true },
        { name: '🎂 Age & Specials', value: 'Age Groups & Special Access', inline: true },
        { name: '🌈 Appearance', value: 'Choose your name color', inline: false }
      )
      .setFooter({ text: '⚠️ 17–18+ must verify @ mods' });

    const menu1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('group_family_identity')
        .setPlaceholder('👨‍👩‍👧 Family & 👤 Identity')
        .addOptions(
          { label: 'Niece', value: '1385412634748260423', emoji: '👧' },
          { label: 'Nephew', value: '1385412386793717780', emoji: '👦' },
          { label: 'He/Him', value: '1385044928375029780', emoji: '🔹' },
          { label: 'She/Her', value: '1385044992866914427', emoji: '🌸' },
          { label: 'They/Them', value: '1385045047791325285', emoji: '✨' },
          { label: 'Ask for Pronouns', value: '1385045182155722872', emoji: '💬' }
        )
    );

    const menu2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('group_age_pings')
        .setPlaceholder('🎂 Age Group & 🔔 Pings')
        .addOptions(
          { label: 'Age 13', value: '1447238138413187188', emoji: '🎂' },
          { label: 'Age 14', value: '1447238234173079817', emoji: '🎂' },
          { label: 'Age 15', value: '1447238264846291027', emoji: '🎂' },
          { label: 'Age 16', value: '1447238292377440487', emoji: '🎂' },
          { label: 'Chat Revive', value: '1402280746273734859', emoji: '🔔' }
        )
    );

    const menu3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('group_specials')
        .setPlaceholder('✨ Special Roles')
        .addOptions(
          { label: 'Tuffest People in Chat', value: '1474660849447866410', emoji: ':001criipyimcool:' },
          { label: 'Doritos', value: '1477694222307168326', emoji: ':nerd~1:' },
          { label: 'Morvani Automative LLC', value: '1477700900138254608', emoji: ':0096_damn:' }
        )
    );

    const menu4 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('group_colors')
        .setPlaceholder('🌈 Appearance – Colors')
        .addOptions(
          { label: 'Red', value: '1441761480923152564', emoji: '🔴' },
          { label: 'Cyan', value: '1444433605274239128', emoji: '🐋' },
          { label: 'Yellow', value: '1441762293611495444', emoji: '🟡' },
          { label: 'Green', value: '1441761726323494983', emoji: '🟢' },
          { label: 'Blue', value: '1441761656186212422', emoji: '🔵' },
          { label: 'Purple', value: '1441761788784803860', emoji: '🟣' },
          { label: 'Pink', value: '1441761972562427995', emoji: '🌸' }
        )
    );

    return interaction.reply({
      embeds: [roleEmbed],
      components: [menu1, menu2, menu3, menu4]
    });
  }

  /* ── ROLE HANDLER ── */
  if (interaction.isStringSelectMenu()) {
    const roleId = interaction.values[0];
    const role = interaction.guild.roles.cache.get(roleId);

    if (!role) {
      return interaction.reply({ content: '❌ Role not found.', ephemeral: true });
    }

    try {
      if (interaction.member.roles.cache.has(roleId)) {
        await interaction.member.roles.remove(roleId);
        return interaction.reply({ content: `✅ Removed **${role.name}**`, ephemeral: true });
      } else {
        await interaction.member.roles.add(roleId);
        return interaction.reply({ content: `✅ Added **${role.name}**`, ephemeral: true });
      }
    } catch {
      return interaction.reply({
        content: '❌ Permission denied. Check role hierarchy.',
        ephemeral: true
      });
    }
  }
});

client.login(TOKEN);
