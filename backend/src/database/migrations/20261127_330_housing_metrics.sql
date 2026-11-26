-- Aggregate first-party counts only. No account, device, session, IP, or GPS.
CREATE TABLE IF NOT EXISTS housing_daily_metrics (
  place_id BIGINT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  metric_day DATE NOT NULL,
  detail_views BIGINT NOT NULL DEFAULT 0 CHECK(detail_views>=0),
  contact_reveals BIGINT NOT NULL DEFAULT 0 CHECK(contact_reveals>=0),
  PRIMARY KEY(place_id,metric_day)
);
CREATE INDEX IF NOT EXISTS housing_daily_metrics_day_idx ON housing_daily_metrics(metric_day);
