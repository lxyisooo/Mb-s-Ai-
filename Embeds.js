import { EmbedBuilder } from "discord.js";

export function embed(title, color = 0x5865F2) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();
}
