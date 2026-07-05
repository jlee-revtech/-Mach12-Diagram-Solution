-- 047: Workshop-level facilitation guidance prompt.
--
-- A persisted, free-text steer the facilitator sets once for the whole workshop
-- (tone, emphasis, what to include or avoid). It is threaded as `guidance` into
-- EVERY content generation: the brief route (generateBrief) and the section route
-- (generateSectionContent), so "Regenerate brief", "Regenerate content", and each
-- per-section generate all honor it. Separate from the per-section `feedback`
-- prompt (which revises a single section).

ALTER TABLE workshops ADD COLUMN IF NOT EXISTS facilitation_prompt text;
