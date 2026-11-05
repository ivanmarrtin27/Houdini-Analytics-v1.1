-- FixtureDownload RoundNumber / Group (+ AF league.round when enriching)
ALTER TABLE matches ADD COLUMN round_number INTEGER;
ALTER TABLE matches ADD COLUMN round_group TEXT;
