INSERT INTO "Category" ("slug", "name", "description", "icon", "updatedAt")
VALUES
  ('gaming', 'Gaming', 'Cyber clubs, VR arenas and esports spaces', 'Gamepad2', CURRENT_TIMESTAMP),
  ('healthy-food', 'Healthy Food', 'Healthy food stores, meal prep and nutrition products', 'Salad', CURRENT_TIMESTAMP)
ON CONFLICT ("slug")
DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "updatedAt" = CURRENT_TIMESTAMP;
