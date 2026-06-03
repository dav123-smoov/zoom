-- =====================================================
-- IAAMS Migration: Remove student_id FK dependency
-- Run this ONCE in your Supabase SQL Editor
-- =====================================================

-- 1. Add student identity columns to attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS student_name  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS matrix_number VARCHAR(50);

-- 2. Add student identity columns to fraud_alerts
ALTER TABLE public.fraud_alerts
  ADD COLUMN IF NOT EXISTS student_name  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS matrix_number VARCHAR(50);

-- 3. Make student_id nullable in both tables (no longer required)
ALTER TABLE public.attendance   ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.fraud_alerts ALTER COLUMN student_id DROP NOT NULL;

-- 4. Drop old unique constraint (student_id, session_id) on attendance
--    and replace with (matrix_number, session_id)
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_student_id_session_id_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_matrix_session_unique
  UNIQUE (matrix_number, session_id);

-- 5. Useful indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_attendance_matrix  ON public.attendance(matrix_number);
CREATE INDEX IF NOT EXISTS idx_fraud_matrix       ON public.fraud_alerts(matrix_number);

-- Done. The students table still exists but is no longer written to.
