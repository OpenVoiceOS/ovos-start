// SPDX-License-Identifier: Apache-2.0
// Versions 1 and 2 retain the same frozen recipe payload. Version 2 adds expiry.

export const COMPACT_VERSION = 2;
export const COMPACT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECIPE_TTL_SECONDS = 3600;
export const MAX_RECIPE_TIMESTAMP = 2 ** 40 - 1;

/** @typedef {string | boolean} RecipeValue */
/** @typedef {Record<string, RecipeValue>} RecipeState */
/** @typedef {{name: string, width: number, offset: number, values: readonly RecipeValue[]}} CompactField */

/** Ordered from the most significant to least significant payload bits. */
export const COMPACT_FIELDS = Object.freeze([
  Object.freeze({ name: 'device', width: 4, offset: 24, values: Object.freeze(['pi', 'computer', 'mark1', 'mark2', 'devkit', 'jetson', 'server', 'mac', 'windows', 'other']) }),
  Object.freeze({ name: 'experience', width: 2, offset: 22, values: Object.freeze(['ready', 'tinker', 'hub']) }),
  Object.freeze({ name: 'locale', width: 4, offset: 18, values: Object.freeze(['en-us', 'fr-fr', 'de-de', 'es-es', 'it-it', 'nl-nl', 'pt-pt', 'ca-es', 'eu-es', 'gl-es', 'hi-in', 'kab-dz']) }),
  Object.freeze({ name: 'method', width: 1, offset: 17, values: Object.freeze(['virtualenv', 'containers']) }),
  Object.freeze({ name: 'channel', width: 1, offset: 16, values: Object.freeze(['testing', 'alpha']) }),
  Object.freeze({ name: 'expertise', width: 2, offset: 14, values: Object.freeze(['guided', 'tinker', 'expert']) }),
  Object.freeze({ name: 'speech', width: 2, offset: 12, values: Object.freeze(['auto', 'public', 'local']) }),
  Object.freeze({ name: 'memory', width: 2, offset: 10, values: Object.freeze(['unknown', 'under8', '8plus']) }),
  Object.freeze({ name: 'cpu', width: 2, offset: 8, values: Object.freeze(['unknown', 'arm64', 'avx2', 'intel-mac']) }),
  Object.freeze({ name: 'piModel', width: 2, offset: 6, values: Object.freeze(['unknown', 'older', 'pi5']) }),
  Object.freeze({ name: 'llmMode', width: 2, offset: 4, values: Object.freeze(['off', 'local', 'online']) }),
  Object.freeze({ name: 'extraSkills', width: 1, offset: 3, values: Object.freeze([false, true]) }),
  Object.freeze({ name: 'telemetry', width: 1, offset: 2, values: Object.freeze([false, true]) }),
  Object.freeze({ name: 'skills', width: 1, offset: 1, values: Object.freeze([false, true]) }),
  Object.freeze({ name: 'homeassistant', width: 1, offset: 0, values: Object.freeze([false, true]) }),
]);

const FIELD_NAMES = new Set(COMPACT_FIELDS.map(field => field.name));
const CODE_FORMAT = /^(?:[0-9A-HJKMNP-TV-Z]{8}|[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}|[0-9A-HJKMNP-TV-Z]{16}|[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3})$/i;

/**
 * Compute CRC-8/SMBUS over the specified big-endian bytes, without reflection.
 * The checksum catches transcription mistakes; it is not authentication.
 * @param {bigint} body Version/payload, followed by the v2 timestamp when present.
 * @param {number} byteCount Four bytes for v1; nine bytes for v2.
 * @returns {number} Eight-bit checksum.
 */
function checksum(body, byteCount) {
  let crc = 0;
  for (let byte = byteCount - 1; byte >= 0; byte -= 1) {
    crc ^= Number((body >> BigInt(byte * 8)) & 255n);
    for (let bit = 0; bit < 8; bit += 1) {
      crc = ((crc << 1) ^ ((crc & 0x80) ? 0x07 : 0)) & 0xff;
    }
  }
  return crc;
}

/**
 * Check a positive, exact Unix timestamp representable in the forty-bit field.
 * @param {unknown} value Unix seconds, without implicit string coercion.
 * @param {string} label Description used in the validation error.
 * @returns {number} Validated timestamp.
 */
function timestamp(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_RECIPE_TIMESTAMP) {
    throw new RangeError(`Invalid ${label}; a working clock with Unix seconds is required.`);
  }
  return value;
}

/** Read the browser/system clock without accepting unavailable clock values.
 * @returns {number} Current Unix seconds.
 */
function currentTime() {
  let value;
  try { value = Math.floor(Date.now() / 1000); } catch {
    throw new RangeError('Invalid clock; a working clock with Unix seconds is required.');
  }
  return timestamp(value, 'clock');
}

/**
 * Encode all frozen recipe fields into a code that expires one hour after issuance.
 * Cross-field compatibility must be checked separately by the wizard/launcher.
 * @param {RecipeState} state Complete non-secret recipe choices.
 * @param {{issuedAt?: number}} options Issuance time in Unix seconds; defaults to now.
 * @returns {string} Sixteen uppercase Crockford characters grouped XXXX-XXXX-XXXX-XXXX.
 * @throws {TypeError | RangeError} When fields or typed enum values are invalid.
 */
export function encodeRecipeCode(state, { issuedAt = currentTime() } = {}) {
  timestamp(issuedAt, 'issuance timestamp');
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Recipe must be an object containing every compact field.');
  }
  const keys = Reflect.ownKeys(state);
  if (keys.length !== COMPACT_FIELDS.length || keys.some(key => !FIELD_NAMES.has(key))) {
    throw new TypeError('Recipe must contain exactly the frozen compact fields.');
  }
  let payload = 0n;
  for (const field of COMPACT_FIELDS) {
    if (!Object.hasOwn(state, field.name)) {
      throw new TypeError(`Missing recipe field: ${field.name}.`);
    }
    const index = field.values.indexOf(state[field.name]);
    if (index < 0) throw new RangeError(`Invalid recipe field: ${field.name}.`);
    payload |= BigInt(index) << BigInt(field.offset);
  }
  const header = (BigInt(COMPACT_VERSION) << 28n) | payload;
  const body = (header << 40n) | BigInt(issuedAt);
  let wire = (body << 8n) | BigInt(checksum(body, 9));
  let code = '';
  for (let digit = 0; digit < 16; digit += 1) {
    code = COMPACT_ALPHABET[Number(wire & 31n)] + code;
    wire >>= 5n;
  }
  return code.match(/.{4}/g).join('-');
}

/**
 * Decode and validate a recipe, including its issue time and one-hour expiration.
 * Recovery flags restore choices only; launchers never accept legacy/expired codes.
 * Future codes and invalid clocks always fail, including in recovery mode.
 * @param {string} input A v2 code (or a v1 code for explicit legacy recovery).
 * @param {{now?: number, allowLegacy?: boolean, allowExpired?: boolean}} options Validation/recovery controls.
 * @returns {{version: number, issuedAt: number|null, expiresAt: number|null, state: RecipeState}} Recipe and timing metadata.
 * @throws {TypeError | RangeError} When format, checksum or the wire contract fails.
 */
export function decodeRecipeEnvelope(input, { now = currentTime(), allowLegacy = false, allowExpired = false } = {}) {
  timestamp(now, 'clock');
  if (typeof allowLegacy !== 'boolean' || typeof allowExpired !== 'boolean') {
    throw new TypeError('Recipe recovery flags must be booleans.');
  }
  if (typeof input !== 'string' || !CODE_FORMAT.test(input)) {
    throw new TypeError('Recipe code must be 16 Base32 characters grouped XXXX-XXXX-XXXX-XXXX.');
  }
  const code = input.toUpperCase().replaceAll('-', '');
  let wire = 0n;
  for (const character of code) {
    wire = (wire << 5n) | BigInt(COMPACT_ALPHABET.indexOf(character));
  }
  const legacy = code.length === 8;
  const body = wire >> 8n;
  const header = legacy ? body : body >> 40n;
  if (Number(wire & 255n) !== checksum(body, legacy ? 4 : 9)) {
    throw new RangeError('Recipe code checksum does not match.');
  }
  const version = Number(header >> 28n);
  if (version !== (legacy ? 1 : COMPACT_VERSION)) {
    throw new RangeError(`Unsupported recipe code version: ${version}.`);
  }
  if (legacy && !allowLegacy) {
    throw new RangeError('This legacy recipe has no expiry. Generate a new one-hour code in OVOS Start.');
  }
  const issuedAt = legacy ? null : timestamp(Number(body & 0xffffffffffn), 'issuance timestamp');
  const expiresAt = legacy ? null : issuedAt + RECIPE_TTL_SECONDS;
  if (!legacy && issuedAt > now) {
    throw new RangeError('Recipe code is future-dated. Check the device clock and generate a new code.');
  }
  if (!legacy && now >= expiresAt && !allowExpired) {
    throw new RangeError('Recipe code expired after one hour. Generate a new code in OVOS Start.');
  }
  const payload = header & 0x0fffffffn;
  const state = {};
  for (const field of COMPACT_FIELDS) {
    const mask = (1n << BigInt(field.width)) - 1n;
    const index = Number((payload >> BigInt(field.offset)) & mask);
    if (index >= field.values.length) {
      throw new RangeError(`Reserved recipe value for ${field.name}.`);
    }
    state[field.name] = field.values[index];
  }
  return { version, issuedAt, expiresAt, state };
}

/**
 * Decode raw typed choices using the same time validation as decodeRecipeEnvelope.
 * Callers still apply the wizard's cross-field compatibility validation.
 * @param {string} input Grouped or ungrouped recipe code.
 * @param {{now?: number, allowLegacy?: boolean, allowExpired?: boolean}} options Validation/recovery controls.
 * @returns {RecipeState} A new object containing every frozen compact field.
 */
export function decodeRecipeCode(input, options = {}) {
  return decodeRecipeEnvelope(input, options).state;
}
