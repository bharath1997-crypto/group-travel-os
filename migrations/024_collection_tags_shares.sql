-- 024_collection_tags_shares.sql
-- Collection Sprint C4: free tags on saved places, and who sent a save (friend share).
-- Additive only. Apply manually after owner approval; safe to re-run.

CREATE TABLE IF NOT EXISTS collection_item_tags (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id    uuid NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
    tag        varchar(40) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_collection_item_tag UNIQUE (item_id, tag)
);

CREATE INDEX IF NOT EXISTS ix_collection_item_tags_item_id
    ON collection_item_tags (item_id);

ALTER TABLE collection_items
    ADD COLUMN IF NOT EXISTS shared_by_user_id uuid
    REFERENCES users(id) ON DELETE SET NULL;
