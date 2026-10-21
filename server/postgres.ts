// Match storage in Postgres, for hosts whose disk doesn't survive a restart (like Render's
// free plan). One row per match; the state, metadata and log are stored as JSON.

import pg from 'pg';
import { Async } from 'boardgame.io/internal';
import type { LogEntry, Server, State, StorageAPI } from 'boardgame.io';

// pg turns JS arrays into Postgres arrays, so JSON is always passed as a string.
const json = (value: unknown) => JSON.stringify(value);

export class PostgresStore extends Async {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    super();
    // Hosted databases like Neon need SSL; a local one usually doesn't offer it.
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    this.pool = new pg.Pool({ connectionString, ssl: !local, max: 5 });
  }

  async connect() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id text PRIMARY KEY,
        game_name text,
        state jsonb,
        initial_state jsonb,
        metadata jsonb,
        log jsonb NOT NULL DEFAULT '[]',
        updated_at bigint
      )`);
  }

  async createMatch(id: string, { initialState, metadata }: StorageAPI.CreateMatchOpts) {
    await this.pool.query(
      `INSERT INTO matches (id, game_name, state, initial_state, metadata, updated_at)
       VALUES ($1, $2, $3, $3, $4, $5)`,
      [id, metadata.gameName, json(initialState), json(metadata), metadata.updatedAt],
    );
  }

  async setState(id: string, state: State, deltalog?: LogEntry[]) {
    await this.pool.query(`UPDATE matches SET state = $2, log = log || $3::jsonb WHERE id = $1`, [
      id,
      json(state),
      json(deltalog ?? []),
    ]);
  }

  async setMetadata(id: string, metadata: Server.MatchData) {
    await this.pool.query(`UPDATE matches SET metadata = $2, game_name = $3, updated_at = $4 WHERE id = $1`, [
      id,
      json(metadata),
      metadata.gameName,
      metadata.updatedAt,
    ]);
  }

  async fetch<O extends StorageAPI.FetchOpts>(id: string, opts: O): Promise<StorageAPI.FetchResult<O>> {
    const { rows } = await this.pool.query(`SELECT state, initial_state, metadata, log FROM matches WHERE id = $1`, [id]);
    const row = rows[0];
    const result: Record<string, unknown> = {};
    if (opts.state) result.state = row?.state ?? undefined;
    if (opts.metadata) result.metadata = row?.metadata ?? undefined;
    if (opts.log) result.log = row?.log ?? undefined;
    if (opts.initialState) result.initialState = row?.initial_state ?? undefined;
    return result as StorageAPI.FetchResult<O>;
  }

  async wipe(id: string) {
    await this.pool.query(`DELETE FROM matches WHERE id = $1`, [id]);
  }

  async listMatches(opts: StorageAPI.ListMatchesOpts = {}) {
    const where: string[] = [];
    const args: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      args.push(value);
      where.push(sql.replace('?', `$${args.length}`));
    };
    if (opts.gameName) add('game_name = ?', opts.gameName);
    if (opts.where?.isGameover !== undefined) {
      where.push(`(metadata ? 'gameover') = ${opts.where.isGameover ? 'true' : 'false'}`);
    }
    if (opts.where?.updatedBefore !== undefined) add('updated_at < ?', opts.where.updatedBefore);
    if (opts.where?.updatedAfter !== undefined) add('updated_at > ?', opts.where.updatedAfter);
    const { rows } = await this.pool.query(
      `SELECT id FROM matches ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
      args,
    );
    return rows.map((r) => r.id as string);
  }
}
