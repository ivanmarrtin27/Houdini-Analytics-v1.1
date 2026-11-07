-- Tip universe: Más de 7.5 córners (match total) model probs.
ALTER TABLE predictions ADD COLUMN corners_over75_prob REAL;
ALTER TABLE predictions ADD COLUMN corners_under75_prob REAL;
