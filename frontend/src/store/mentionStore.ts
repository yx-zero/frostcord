import { create } from 'zustand'

// A lightweight name registry so the markdown renderer can turn Discord's
// numeric mention syntax (<@id>, <#id>, <@&id>) into readable names.
// Populated as we learn names from READY, channel lists, and message authors.
interface MentionState {
  users: Record<string, string> // id -> display name
  channels: Record<string, string> // id -> channel name
  roles: Record<string, string> // id -> role name
  roleColors: Record<string, string> // id -> "#rrggbb"
  addUser: (id: string, name: string) => void
  addUsers: (entries: Record<string, string>) => void
  addChannel: (id: string, name: string) => void
  addChannels: (entries: Record<string, string>) => void
  addRole: (id: string, name: string) => void
  addRoles: (entries: Record<string, string>) => void
  addRoleColors: (entries: Record<string, string>) => void
}

export const useMentionStore = create<MentionState>((set) => ({
  users: {},
  channels: {},
  roles: {},
  roleColors: {},
  addUser: (id, name) =>
    set((s) => ({ users: { ...s.users, [id]: name } })),
  addUsers: (entries) =>
    set((s) => ({ users: { ...s.users, ...entries } })),
  addChannel: (id, name) =>
    set((s) => ({ channels: { ...s.channels, [id]: name } })),
  addChannels: (entries) =>
    set((s) => ({ channels: { ...s.channels, ...entries } })),
  addRole: (id, name) =>
    set((s) => ({ roles: { ...s.roles, [id]: name } })),
  addRoles: (entries) =>
    set((s) => ({ roles: { ...s.roles, ...entries } })),
  addRoleColors: (entries) =>
    set((s) => ({ roleColors: { ...s.roleColors, ...entries } })),
}))

// Non-hook accessors for use inside render helpers.
export function resolveUser(id: string): string | undefined {
  return useMentionStore.getState().users[id]
}
export function resolveChannel(id: string): string | undefined {
  return useMentionStore.getState().channels[id]
}
export function resolveRole(id: string): string | undefined {
  return useMentionStore.getState().roles[id]
}
export function resolveRoleColor(id: string): string | undefined {
  return useMentionStore.getState().roleColors[id]
}

// Convert Discord raw syntax into readable plain text (for previews/reply bars):
//   <@id> / <@!id> -> @name, <#id> -> #channel, <@&id> -> @role,
//   <:name:id> / <a:name:id> -> :name:, <t:...> -> (timestamp)
export function previewText(content: string): string {
  return content
    .replace(/<@!?(\d+)>/g, (_m, id: string) => '@' + (resolveUser(id) ?? 'user'))
    .replace(/<#(\d+)>/g, (_m, id: string) => '#' + (resolveChannel(id) ?? 'channel'))
    .replace(/<@&(\d+)>/g, (_m, id: string) => '@' + (resolveRole(id) ?? 'role'))
    .replace(/<a?:(\w+):\d+>/g, (_m, name: string) => ':' + name + ':')
    .replace(/<t:\d+(?::[a-zA-Z])?>/g, '(time)')
}
