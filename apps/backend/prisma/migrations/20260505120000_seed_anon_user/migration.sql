-- Ensures the anonymous sentinel user (id=1) always exists before real users can sign up.
-- Content from deleted accounts is reassigned to this row. It has no AuthIdentity so it
-- cannot be logged into. ON CONFLICT makes this idempotent on re-runs / existing installs.
INSERT INTO users (id, first_name, last_name, email, global_role, "isVerified", timezone, profile_picture_url)
VALUES (1, 'Anon', 'Anon', 'anon@example.com', 'teacher', true, 'UTC', 'default-profile-pic.png')
ON CONFLICT (id) DO NOTHING;

-- Advance the sequence past id=1 so the next real user gets id>=2.
-- GREATEST guards against existing installs that already have users with higher ids.
SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1));
