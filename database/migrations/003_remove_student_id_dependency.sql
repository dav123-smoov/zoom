-- =====================================================
-- IAAMS Migration: Remove student_id FK dependency & Redefine RPCs
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

-- =====================================================
-- 6. REDEFINE RPC FUNCTIONS FOR STUDENT-LESS SCHEMA
-- =====================================================

-- Redefine get_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json AS $$
DECLARE
    v_total_students integer;
    v_total_sessions integer;
    v_attendance_rate numeric;
    v_unresolved_alerts integer;
    v_avg_duration_minutes numeric;
    v_total_late integer;
    v_result json;
BEGIN
    -- Unique participants who have ever joined a session
    SELECT COUNT(DISTINCT matrix_number) INTO v_total_students FROM public.attendance;
    
    -- Total sessions
    SELECT COUNT(*) INTO v_total_sessions FROM public.sessions;
    
    -- Attendance rate: average of present + late over total registered/participating
    SELECT COALESCE(
        ROUND(
            (SUM(total_present + total_late)::numeric / NULLIF(SUM(total_present + total_late + total_absent), 0)) * 100,
            1
        ),
        0.0
    ) INTO v_attendance_rate
    FROM public.sessions
    WHERE status = 'completed';
    
    -- Unresolved alerts
    SELECT COUNT(*) INTO v_unresolved_alerts FROM public.fraud_alerts WHERE resolved = FALSE;
    
    -- Average attendee duration in minutes
    SELECT COALESCE(
        ROUND((AVG(duration_seconds) / 60)::numeric, 1),
        0.0
    ) INTO v_avg_duration_minutes
    FROM public.attendance
    WHERE status != 'absent';
    
    -- Total late arrivals
    SELECT COUNT(*) INTO v_total_late FROM public.attendance WHERE status = 'late';
    
    v_result := json_build_object(
        'total_students', v_total_students,
        'total_sessions', v_total_sessions,
        'attendance_rate', v_attendance_rate,
        'unresolved_alerts', v_unresolved_alerts,
        'avg_duration_minutes', v_avg_duration_minutes,
        'total_late', v_total_late
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redefine get_recent_activity
CREATE OR REPLACE FUNCTION public.get_recent_activity()
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_result
    FROM (
        SELECT 
            a.id,
            a.student_name,
            a.matrix_number,
            a.join_time,
            a.status,
            s.topic AS session_topic
        FROM public.attendance a
        JOIN public.sessions s ON a.session_id = s.id
        ORDER BY a.join_time DESC
        LIMIT 10
    ) t;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redefine get_attendance_trends
CREATE OR REPLACE FUNCTION public.get_attendance_trends()
RETURNS json AS $$
DECLARE
    v_result json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Overwrite get_attendance_trends with correct query logic
CREATE OR REPLACE FUNCTION public.get_attendance_trends()
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_result
    FROM (
        SELECT 
            s.id AS session_id,
            s.scheduled_time AS date,
            s.topic,
            s.total_present AS present,
            s.total_late AS late,
            s.total_absent AS absent,
            (s.total_present + s.total_late + s.total_absent) AS total,
            COALESCE(
                (SELECT ROUND((AVG(duration_seconds)/60)::numeric, 1) 
                 FROM public.attendance a 
                 WHERE a.session_id = s.id AND a.status != 'absent'), 
                0.0
            ) AS avg_duration
        FROM public.sessions s
        WHERE s.status = 'completed'
        ORDER BY s.scheduled_time ASC
    ) t;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Redefine get_dashboard_all
CREATE OR REPLACE FUNCTION public.get_dashboard_all()
RETURNS json AS $$
DECLARE
    v_stats json;
    v_trends json;
    v_recent json;
    v_attendance_dist json;
    v_result json;
BEGIN
    -- Get stats
    v_stats := public.get_dashboard_stats();
    
    -- Get trends (recent 5 completed sessions)
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_trends
    FROM (
        SELECT 
            scheduled_time AS date,
            total_present AS present,
            total_late AS late,
            total_absent AS absent
        FROM public.sessions
        WHERE status = 'completed'
        ORDER BY scheduled_time DESC
        LIMIT 5
    ) t;
    
    -- Get recent activity
    v_recent := public.get_recent_activity();
    
    -- Total Present, Late, Absent across all completed sessions
    SELECT json_build_array(
        json_build_object('category', 'Present', 'count', COALESCE(SUM(total_present), 0), 'fill', '#10b981'),
        json_build_object('category', 'Late', 'count', COALESCE(SUM(total_late), 0), 'fill', '#f59e0b'),
        json_build_object('category', 'Absent', 'count', COALESCE(SUM(total_absent), 0), 'fill', '#ef4444')
    ) INTO v_attendance_dist
    FROM public.sessions
    WHERE status = 'completed';
    
    v_result := json_build_object(
        'stats', v_stats,
        'trends', v_trends,
        'attendance_distribution', v_attendance_dist,
        'recent_activity', v_recent
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

