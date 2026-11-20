-- Prevent two Admin sessions from silently overwriting the same review.
-- Existing rows start at version 1; each successful moderation increases it.
ALTER TABLE soft_launch_feedback
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
  CHECK (version >= 1);
