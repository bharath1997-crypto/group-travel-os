-- SeatShare: allow platform-wide discoverable rides (visibility = public)

ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_visibility_check;
ALTER TABLE rides ADD CONSTRAINT rides_visibility_check
  CHECK (visibility IN ('groups', 'fof', 'public'));

CREATE OR REPLACE FUNCTION seats_visible_to(p_ride_id uuid, p_viewer uuid) RETURNS boolean AS $$
DECLARE
  r rides%ROWTYPE;
BEGIN
  SELECT * INTO r FROM rides WHERE id = p_ride_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.driver_id = p_viewer THEN RETURN true; END IF;
  IF r.visibility = 'public' THEN
    RETURN true;
  END IF;
  IF r.visibility = 'groups' THEN
    RETURN EXISTS (
      SELECT 1 FROM group_members a
      JOIN group_members b USING (group_id)
      WHERE a.user_id = r.driver_id AND b.user_id = p_viewer
    );
  END IF;
  IF r.visibility = 'fof' THEN
    RETURN EXISTS (
      SELECT 1 FROM friend_requests fr1
      JOIN friend_requests fr2
        ON fr2.sender_id = fr1.receiver_id OR fr2.receiver_id = fr1.receiver_id
      WHERE fr1.status = 'accepted' AND fr2.status = 'accepted'
        AND (
          (fr1.sender_id = r.driver_id AND (fr2.sender_id = p_viewer OR fr2.receiver_id = p_viewer))
          OR (fr1.receiver_id = r.driver_id AND (fr2.sender_id = p_viewer OR fr2.receiver_id = p_viewer))
        )
        AND fr1.sender_id IN (r.driver_id, fr1.receiver_id)
    ) OR EXISTS (
      SELECT 1 FROM friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = r.driver_id AND fr.receiver_id = p_viewer)
          OR (fr.receiver_id = r.driver_id AND fr.sender_id = p_viewer)
        )
    );
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;
