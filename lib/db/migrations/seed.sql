-- Seed: number_series
-- Architecture decision AD-09: one row per document type, current_number starts at 0.
-- First document of each type will increment to 1 before assignment.
-- Run this AFTER the migration (0000_tearful_iron_monger.sql) has been applied.

INSERT INTO "number_series" ("document_type", "prefix", "current_number")
VALUES
  ('Purchase Gate Pass', 'PGP', 0),
  ('Sale Gate Pass',     'SGP', 0),
  ('Return Gate Pass',   'RGP', 0),
  ('Purchase Bill',      'PB',  0),
  ('Sales Bill',         'SB',  0),
  ('Return Bill',        'RB',  0),
  ('Payment Receive',    'PR',  0),
  ('Payment Paid',       'PP',  0)
ON CONFLICT ("document_type") DO NOTHING;
