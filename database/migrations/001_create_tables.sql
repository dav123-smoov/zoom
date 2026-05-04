-- =============================================
-- IAAMS - Intelligent Automated Attendance Management System
-- Database Migration: Create Core Tables
-- Author: Bolaji David Abiodun (220591122)
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: students
-- Stores registered student information
-- =============================================
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    matrix_number VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    trust_score DECIMAL(5,2) DEFAULT 100.00,
    total_sessions INTEGER DEFAULT 0,
    flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by matrix number
CREATE INDEX idx_students_matrix ON public.students(matrix_number);

-- =============================================
-- TABLE: sessions
-- Stores Zoom meeting/class session information
-- =============================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id VARCHAR(100) NOT NULL,
    topic VARCHAR(255) NOT NULL DEFAULT 'Untitled Session',
    course_code VARCHAR(50),
    scheduled_time TIMESTAMPTZ NOT NULL,
    actual_start_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 60,
    late_threshold_minutes INTEGER DEFAULT 15,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    total_present INTEGER DEFAULT 0,
    total_late INTEGER DEFAULT 0,
    total_absent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by meeting ID
CREATE INDEX idx_sessions_meeting_id ON public.sessions(meeting_id);
CREATE INDEX idx_sessions_status ON public.sessions(status);

-- =============================================
-- TABLE: attendance
-- Stores individual attendance records
-- =============================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    join_time TIMESTAMPTZ NOT NULL,
    leave_time TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent', 'suspicious')),
    is_suspicious BOOLEAN DEFAULT FALSE,
    raw_display_name VARCHAR(255),
    ip_address VARCHAR(45),
    join_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, session_id)
);

-- Indexes
CREATE INDEX idx_attendance_student ON public.attendance(student_id);
CREATE INDEX idx_attendance_session ON public.attendance(session_id);
CREATE INDEX idx_attendance_status ON public.attendance(status);

-- =============================================
-- TABLE: fraud_alerts
-- Stores fraud detection alerts
-- =============================================
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'short_duration', 
        'multiple_logins', 
        'invalid_format', 
        'late_pattern', 
        'proxy_suspected',
        'name_mismatch'
    )),
    severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fraud_alerts_student ON public.fraud_alerts(student_id);
CREATE INDEX idx_fraud_alerts_type ON public.fraud_alerts(alert_type);
CREATE INDEX idx_fraud_alerts_severity ON public.fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_resolved ON public.fraud_alerts(resolved);

-- =============================================
-- TABLE: lecturers (for auth)
-- =============================================
CREATE TABLE IF NOT EXISTS public.lecturers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FUNCTION: Update timestamp trigger
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trg_students_updated 
    BEFORE UPDATE ON public.students 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sessions_updated 
    BEFORE UPDATE ON public.sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_attendance_updated 
    BEFORE UPDATE ON public.attendance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- FUNCTION: Calculate Trust Score
-- Called after attendance is recorded/updated
-- =============================================
CREATE OR REPLACE FUNCTION calculate_trust_score(p_student_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_attendance_rate DECIMAL;
    v_punctuality_rate DECIMAL;
    v_duration_score DECIMAL;
    v_fraud_penalty DECIMAL;
    v_trust_score DECIMAL;
    v_total_sessions INTEGER;
    v_attended INTEGER;
    v_on_time INTEGER;
    v_good_duration INTEGER;
    v_fraud_count INTEGER;
BEGIN
    -- Total sessions where student could attend
    SELECT COUNT(*) INTO v_total_sessions FROM public.sessions WHERE status != 'cancelled';
    
    IF v_total_sessions = 0 THEN
        RETURN 100.00;
    END IF;
    
    -- Sessions attended (not absent)
    SELECT COUNT(*) INTO v_attended 
    FROM public.attendance 
    WHERE student_id = p_student_id AND status != 'absent';
    
    -- Sessions on time
    SELECT COUNT(*) INTO v_on_time 
    FROM public.attendance 
    WHERE student_id = p_student_id AND status = 'present';
    
    -- Sessions with good duration (> 30 minutes or > 50% of session)
    SELECT COUNT(*) INTO v_good_duration 
    FROM public.attendance a
    JOIN public.sessions s ON a.session_id = s.id
    WHERE a.student_id = p_student_id 
    AND a.duration_seconds > LEAST(1800, s.duration_minutes * 30);
    
    -- Fraud alerts count
    SELECT COUNT(*) INTO v_fraud_count 
    FROM public.fraud_alerts 
    WHERE student_id = p_student_id AND resolved = FALSE;
    
    -- Calculate components
    v_attendance_rate := (v_attended::DECIMAL / v_total_sessions) * 100;
    v_punctuality_rate := CASE WHEN v_attended > 0 
        THEN (v_on_time::DECIMAL / v_attended) * 100 
        ELSE 0 END;
    v_duration_score := CASE WHEN v_attended > 0 
        THEN (v_good_duration::DECIMAL / v_attended) * 100 
        ELSE 0 END;
    
    -- Fraud penalty (each unresolved alert reduces by 5%)
    v_fraud_penalty := GREATEST(0.5, 1.0 - (v_fraud_count * 0.05));
    
    -- Weighted calculation
    v_trust_score := (
        v_attendance_rate * 0.40 +
        v_punctuality_rate * 0.25 +
        v_duration_score * 0.20 +
        50 * 0.15  -- base consistency score
    ) * v_fraud_penalty;
    
    -- Clamp between 0 and 100
    v_trust_score := GREATEST(0, LEAST(100, v_trust_score));
    
    -- Update student record
    UPDATE public.students 
    SET trust_score = v_trust_score, 
        total_sessions = v_attended
    WHERE id = p_student_id;
    
    RETURN v_trust_score;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecturers ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for n8n and PHP backend)
CREATE POLICY "Service role full access" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.fraud_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.lecturers FOR ALL USING (true) WITH CHECK (true);
