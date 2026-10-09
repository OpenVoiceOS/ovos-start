import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { closeSync, constants, fchmodSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const migrations = new URL('./relay/drizzle/', import.meta.url);

/** Open a private SQLite database and apply checked migrations atomically.
 * @param {string} filename Absolute database filename.
 * @param {URL|string} migrationDirectory Checked-in relay migrations.
 * @returns {{database: DatabaseSync, DB: object, close: Function}}
 */
export function openDatabase(filename, migrationDirectory = migrations) {
  if (!isAbsolute(filename) || resolve(filename) !== filename) throw new Error('Database path must be absolute.');
  const directory = dirname(filename);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const parent = lstatSync(directory);
  if (!parent.isDirectory() || realpathSync(directory) !== directory || (parent.mode & 0o077) || parent.uid !== process.getuid()) {
    throw new Error('Database directory must be private and owned by the service.');
  }
  const descriptor = openSync(filename, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try {
    const file = fstatSync(descriptor);
    if (!file.isFile() || file.uid !== process.getuid() || file.nlink !== 1) throw new Error('Unsafe database file.');
    fchmodSync(descriptor, 0o600);
  } finally { closeSync(descriptor); }
  const database = new DatabaseSync(filename, { enableForeignKeyConstraints: true, allowExtension: false });
  try {
    database.exec('PRAGMA busy_timeout=1000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec('CREATE TABLE IF NOT EXISTS node_migrations (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL)');
      const names = readdirSync(migrationDirectory).filter(name => /^\d{4}_[a-z_]+\.sql$/.test(name)).sort();
      if (!names.length) throw new Error('Missing database migrations.');
      const applied = new Map(database.prepare('SELECT name, checksum FROM node_migrations').all().map(row => [row.name, row.checksum]));
      if ([...applied.keys()].some(name => !names.includes(name))) throw new Error('Database is newer than this service.');
      for (const name of names) {
        const path = migrationDirectory instanceof URL ? new URL(name, migrationDirectory) : resolve(migrationDirectory, name);
        const sql = readFileSync(path, 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex');
        if (applied.has(name)) {
          if (applied.get(name) !== checksum) throw new Error('Applied database migration changed.');
          continue;
        }
        database.exec(sql);
        database.prepare('INSERT INTO node_migrations (name, checksum) VALUES (?, ?)').run(name, checksum);
      }
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); throw error; }
  } catch (error) { database.close(); throw error; }

  // Preserve the small prepared-statement D1 interface used by the relay.
  const DB = {
    prepare(sql) {
      const statement = database.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() { return statement.get(...values) || null; },
            async all() { return { results: statement.all(...values) }; },
            async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
          };
        },
      };
    },
  };
  return { database, DB, close() { database.close(); } };
}
