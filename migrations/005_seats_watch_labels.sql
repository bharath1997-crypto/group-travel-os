-- Optional human labels for route watches (SeatShare alerts UI)
ALTER TABLE ride_watches
  ADD COLUMN IF NOT EXISTS from_label text,
  ADD COLUMN IF NOT EXISTS to_label text;
