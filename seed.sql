-- Seed demo data for nidumolubharath230@gmail.com (change v_user_id for another account).
-- Matches app/models (groups, trips, expenses, saved_pins, locations, trip_locations, polls).

DO $$
DECLARE
  v_user_id UUID := '5cdde2be-9e2c-4196-b523-d94bb34b2ee9';
  v_now TIMESTAMPTZ := NOW();
  v_g1 UUID := gen_random_uuid();
  v_g2 UUID := gen_random_uuid();
  v_g3 UUID := gen_random_uuid();
  v_t1 UUID := gen_random_uuid();
  v_t2 UUID := gen_random_uuid();
  v_t3 UUID := gen_random_uuid();
  v_l1 UUID := gen_random_uuid();
  v_l2 UUID := gen_random_uuid();
  v_l3 UUID := gen_random_uuid();
  v_l4 UUID := gen_random_uuid();
  v_l5 UUID := gen_random_uuid();
  v_l6 UUID := gen_random_uuid();
BEGIN

-- Invite codes must be unique; bump suffix if re-seeding hits ix_groups_invite_code.
INSERT INTO groups (id, name, description, created_by, invite_code, created_at, is_accepting_members) VALUES
(v_g1, 'Goa Gang', 'Goa beach trip crew', v_user_id, 'GOAG26B', v_now, true),
(v_g2, 'Manali Winter', 'Mountain trek group', v_user_id, 'MN26B01', v_now, true),
(v_g3, 'Thailand Crew', 'Bangkok adventure', v_user_id, 'THAI26B', v_now, true);

INSERT INTO group_members (id, group_id, user_id, role, joined_at) VALUES
(gen_random_uuid(), v_g1, v_user_id, 'admin', v_now),
(gen_random_uuid(), v_g2, v_user_id, 'admin', v_now),
(gen_random_uuid(), v_g3, v_user_id, 'admin', v_now)
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO trips (id, group_id, title, description, status, start_date, end_date, created_by, created_at, updated_at) VALUES
(v_t1, v_g1, 'Goa 2026', 'Goa, India', 'planning', CURRENT_DATE + 3, CURRENT_DATE + 10, v_user_id, v_now, v_now),
(v_t2, v_g2, 'Manali Trek', 'Manali, India', 'planning', CURRENT_DATE + 60, CURRENT_DATE + 67, v_user_id, v_now, v_now),
(v_t3, v_g3, 'Bangkok Trip', 'Bangkok, Thailand', 'completed', CURRENT_DATE - 30, CURRENT_DATE - 23, v_user_id, v_now, v_now);

INSERT INTO expenses (id, trip_id, paid_by, description, amount, currency, created_at) VALUES
(gen_random_uuid(), v_t1, v_user_id, 'Hotel Royal Goa', 450, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Return flights', 320, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Dinner La Plage', 180, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Water sports', 120, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Groceries', 65, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Airport cab', 35, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Fort tickets', 40, 'USD', v_now),
(gen_random_uuid(), v_t1, v_user_id, 'Beach lunch', 80, 'USD', v_now),
(gen_random_uuid(), v_t2, v_user_id, 'Zostel Manali', 280, 'USD', v_now),
(gen_random_uuid(), v_t2, v_user_id, 'Train tickets', 95, 'USD', v_now),
(gen_random_uuid(), v_t2, v_user_id, 'Trek guide', 150, 'USD', v_now),
(gen_random_uuid(), v_t2, v_user_id, 'Trek meals', 110, 'USD', v_now),
(gen_random_uuid(), v_t3, v_user_id, 'Airbnb Bangkok', 560, 'USD', v_now),
(gen_random_uuid(), v_t3, v_user_id, 'Int flights', 850, 'USD', v_now),
(gen_random_uuid(), v_t3, v_user_id, 'Street food', 220, 'USD', v_now),
(gen_random_uuid(), v_t3, v_user_id, 'Temple tours', 180, 'USD', v_now),
(gen_random_uuid(), v_t3, v_user_id, 'Chatuchak shopping', 340, 'USD', v_now);

INSERT INTO expense_splits (id, expense_id, user_id, amount, is_settled)
SELECT gen_random_uuid(), e.id, v_user_id, e.amount, false
FROM expenses e
WHERE e.trip_id IN (v_t1, v_t2, v_t3);

INSERT INTO saved_pins (id, user_id, latitude, longitude, name, note, flag_type, created_at) VALUES
(gen_random_uuid(), v_user_id, 15.5552, 73.7516, 'Baga Beach', 'Main beach', 'gang_trip', v_now),
(gen_random_uuid(), v_user_id, 15.4925, 73.7751, 'Fort Aguada', 'Portuguese fort', 'visited', v_now),
(gen_random_uuid(), v_user_id, 15.3144, 74.3148, 'Dudhsagar Falls', 'Must visit', 'dream', v_now),
(gen_random_uuid(), v_user_id, 15.5623, 73.7421, 'La Plage Restaurant', 'Best seafood', 'interesting', v_now),
(gen_random_uuid(), v_user_id, 32.3712, 77.2367, 'Rohtang Pass', 'Snow point', 'dream', v_now),
(gen_random_uuid(), v_user_id, 32.3192, 77.1512, 'Solang Valley', 'Skiing spot', 'gang_trip', v_now),
(gen_random_uuid(), v_user_id, 13.7500, 100.4913, 'Grand Palace Bangkok', 'Temple complex', 'visited', v_now),
(gen_random_uuid(), v_user_id, 13.7999, 100.5500, 'Chatuchak Market', 'Weekend market', 'visited', v_now);

INSERT INTO locations (id, saved_by, name, latitude, longitude, category, is_visited, created_at) VALUES
(v_l1, v_user_id, 'Baga Beach', 15.5552, 73.7516, 'beach', false, v_now),
(v_l2, v_user_id, 'Hotel Royal Goa', 15.5513, 73.7683, 'accommodation', false, v_now),
(v_l3, v_user_id, 'Fort Aguada', 15.4925, 73.7751, 'landmark', false, v_now),
(v_l4, v_user_id, 'Dudhsagar Falls', 15.3144, 74.3148, 'nature', false, v_now),
(v_l5, v_user_id, 'Solang Valley', 32.3192, 77.1512, 'nature', false, v_now),
(v_l6, v_user_id, 'Rohtang Pass', 32.3712, 77.2367, 'landmark', false, v_now);

INSERT INTO trip_locations (id, trip_id, location_id, added_by, status, added_at) VALUES
(gen_random_uuid(), v_t1, v_l1, v_user_id, 'suggested', v_now),
(gen_random_uuid(), v_t1, v_l2, v_user_id, 'suggested', v_now),
(gen_random_uuid(), v_t1, v_l3, v_user_id, 'suggested', v_now),
(gen_random_uuid(), v_t1, v_l4, v_user_id, 'suggested', v_now),
(gen_random_uuid(), v_t2, v_l5, v_user_id, 'suggested', v_now),
(gen_random_uuid(), v_t2, v_l6, v_user_id, 'suggested', v_now);

INSERT INTO polls (id, trip_id, question, poll_type, status, created_by, created_at) VALUES
(gen_random_uuid(), v_t1, 'Which hotel should we book?', 'custom', 'open', v_user_id, v_now),
(gen_random_uuid(), v_t1, 'Beach or Waterfall on Day 3?', 'custom', 'open', v_user_id, v_now),
(gen_random_uuid(), v_t1, 'How should we travel to Goa?', 'custom', 'open', v_user_id, v_now);

RAISE NOTICE 'Seed block finished.';
END $$;

SELECT 'Groups' AS type, COUNT(*)::text AS count FROM groups WHERE created_by = '5cdde2be-9e2c-4196-b523-d94bb34b2ee9'
UNION ALL SELECT 'Trips', COUNT(*)::text FROM trips WHERE created_by = '5cdde2be-9e2c-4196-b523-d94bb34b2ee9'
UNION ALL SELECT 'Expenses', COUNT(*)::text FROM expenses WHERE paid_by = '5cdde2be-9e2c-4196-b523-d94bb34b2ee9'
UNION ALL SELECT 'Pins', COUNT(*)::text FROM saved_pins WHERE user_id = '5cdde2be-9e2c-4196-b523-d94bb34b2ee9'
UNION ALL SELECT 'Polls', COUNT(*)::text FROM polls WHERE created_by = '5cdde2be-9e2c-4196-b523-d94bb34b2ee9';
