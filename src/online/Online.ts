import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// The project's public address and publishable key (safe in the browser: the database rules protect the data).
// A build can point elsewhere with VITE_SUPABASE_URL / VITE_SUPABASE_KEY.
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://fosgukrpkpvkidfuwzvp.supabase.co';
const KEY = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_N4pzeU9ck13KeoZeGveEOw_BxFxhian';

export interface OnlineWorld {
  id: string;
  code: string;
  name: string;
  host: string;
  seed: number;
  max_players: number;
  day_seconds: number;
  started_at: string;
}

export interface OnlineMember {
  world_id: string;
  user_id: string;
  city_name: string;
  slot: number;
  last_seen: string;
  summary: { day?: number; people?: number; money?: number; happy?: number; level?: number };
}

/** What a town tells the others about itself. */
export interface TownSummary { day: number; people: number; money: number; happy: number; level: number }

let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }));

/** Errors from the server in words a player understands. */
function why(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return 'Wrong email or password';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first (check your inbox)';
  if (/User already registered/i.test(m)) return 'This email already has an account — sign in';
  if (/Password should be/i.test(m)) return 'The password must be at least 6 characters';
  if (/fetch|network/i.test(m)) return 'No connection to the server';
  return m;
}

/** Accounts and online worlds (stage 1: sign in, create a world as its host, join one by its code). */
export const Online = {
  async session(): Promise<Session | null> {
    try { return (await db().auth.getSession()).data.session; } catch { return null; }
  },

  async signIn(email: string, password: string): Promise<string | null> {
    const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
    return error ? why(error) : null;
  },

  /** A new account; returns an error, or 'confirm' when the email has to be confirmed first. */
  async signUp(email: string, password: string, name: string): Promise<string | null> {
    const { data, error } = await db().auth.signUp({ email: email.trim(), password, options: { data: { name } } });
    if (error) return why(error);
    if (!data.session) return 'confirm';
    await db().from('profiles').upsert({ id: data.session.user.id, name: name.trim() || 'Mayor' });
    return null;
  },

  async signOut() { await db().auth.signOut(); },

  /** The worlds I play in, with my town's name. */
  async myWorlds(): Promise<{ world: OnlineWorld; city: string; players: number }[] | string> {
    const s = await this.session();
    if (!s) return 'not signed in';
    const { data: mine, error } = await db().from('world_members').select('world_id, city_name').eq('user_id', s.user.id);
    if (error) return why(error);
    if (!mine?.length) return [];
    const ids = mine.map((m) => m.world_id as string);
    const { data: worlds, error: e2 } = await db().from('worlds').select('*').in('id', ids);
    if (e2) return why(e2);
    const { data: all } = await db().from('world_members').select('world_id').in('world_id', ids);
    return (worlds ?? []).map((w) => ({
      world: w as OnlineWorld,
      city: (mine.find((m) => m.world_id === w.id)?.city_name as string) ?? '',
      players: (all ?? []).filter((m) => m.world_id === w.id).length,
    }));
  },

  async createWorld(name: string, city: string): Promise<OnlineWorld | string> {
    const { data, error } = await db().rpc('create_world', { p_name: name, p_city: city });
    return error ? why(error) : (data as OnlineWorld);
  },

  async joinWorld(code: string, city: string): Promise<OnlineWorld | string> {
    const { data, error } = await db().rpc('join_world', { p_code: code, p_city: city });
    return error ? why(error) : (data as OnlineWorld);
  },

  async leaveWorld(id: string): Promise<string | null> {
    const { error } = await db().rpc('leave_world', { p_world: id });
    return error ? why(error) : null;
  },

  async members(worldId: string): Promise<OnlineMember[]> {
    const { data } = await db().from('world_members').select('*').eq('world_id', worldId).order('slot');
    return (data ?? []) as OnlineMember[];
  },

  /** My town's figures for the others (and that I am here now). */
  async pushSummary(worldId: string, summary: TownSummary) {
    const s = await this.session();
    if (!s) return;
    await db().from('world_members').update({ summary, last_seen: new Date().toISOString() }).eq('world_id', worldId).eq('user_id', s.user.id);
  },
};

/** The game day of an online world now: the same for everyone, from the moment it started. */
export function worldDay(w: Pick<OnlineWorld, 'started_at' | 'day_seconds'>, now = Date.now()) {
  return Math.floor((now - Date.parse(w.started_at)) / 1000 / w.day_seconds);
}
