const cooldowns = new Map();

export function checkCooldown(userId, command, time = 3000) {
  const key = `${userId}-${command}`;

  if (cooldowns.has(key)) return true;

  cooldowns.set(key, true);
  setTimeout(() => cooldowns.delete(key), time);

  return false;
}
