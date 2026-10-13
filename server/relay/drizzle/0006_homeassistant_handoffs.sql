CREATE TABLE homeassistant_handoffs (
  session_id TEXT PRIMARY KEY NOT NULL REFERENCES installs(id) ON DELETE CASCADE,
  nonce BLOB,
  auth_tag BLOB,
  ciphertext BLOB,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  CHECK ((nonce IS NULL AND auth_tag IS NULL AND ciphertext IS NULL)
    OR (nonce IS NOT NULL AND auth_tag IS NOT NULL AND length(nonce) = 12 AND length(auth_tag) = 16 AND ciphertext IS NOT NULL)),
  CHECK (consumed_at IS NULL OR ciphertext IS NULL)
);
CREATE INDEX idx_homeassistant_handoffs_expires ON homeassistant_handoffs(expires_at);
