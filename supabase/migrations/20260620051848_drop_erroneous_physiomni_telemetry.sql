-- Drop erroneously migrated telemetry tables from APEX-OmniHub
DROP TABLE IF EXISTS public.physiomni_telemetry CASCADE;
DROP TABLE IF EXISTS public.physiomni_telemetry_2026_05 CASCADE;
DROP TABLE IF EXISTS public.physiomni_telemetry_2026_06 CASCADE;
DROP TABLE IF EXISTS public.physiomni_telemetry_2026_07 CASCADE;
DROP TABLE IF EXISTS public.physiomni_telemetry_2026_08 CASCADE;
