-- Enable PostGIS so geospatial columns (GPS positions, geofences) can be added in later phases
-- without a platform change. No tables are created here.
--
-- Requires a role allowed to create extensions (a superuser, or the provider's admin role on
-- managed PostgreSQL), and a server with the PostGIS packages installed. If this migration
-- fails with "extension postgis is not available", the database server lacks PostGIS; see
-- docs/DATABASE_SETUP.md.
CREATE EXTENSION IF NOT EXISTS postgis;
