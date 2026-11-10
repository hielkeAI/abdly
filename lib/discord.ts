import { requiredEnv } from "@/lib/config";

function discordConfig() {
  return {
    token: requiredEnv("DISCORD_BOT_TOKEN"),
    guildId: requiredEnv("DISCORD_GUILD_ID"),
  };
}

async function updateRole(userId: string, roleId: string, method: "PUT" | "DELETE") {
  const { token, guildId } = discordConfig();
  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
    { method, headers: { Authorization: `Bot ${token}` }, cache: "no-store" },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord role ${method === "PUT" ? "assignment" : "removal"} failed (${response.status}): ${detail}`);
  }
}

export const assignDiscordRole = (userId: string, roleId: string) => updateRole(userId, roleId, "PUT");
export const revokeDiscordRole = (userId: string, roleId: string) => updateRole(userId, roleId, "DELETE");

export async function getDiscordMember(userId: string) {
  const { token, guildId } = discordConfig();
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Discord member lookup failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<{ user: { id: string; username: string }; roles: string[] }>;
}

export async function getGuildRoles() {
  const { token, guildId } = discordConfig();
  const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Discord role lookup failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<{ id: string; name: string; managed: boolean }[]>;
}

export async function getGuildRole(roleId: string) {
  const roles = await getGuildRoles();
  return roles.find((role) => role.id === roleId) ?? null;
}
