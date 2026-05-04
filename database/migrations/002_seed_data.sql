-- =============================================
-- IAAMS - Seed Data for Testing
-- =============================================

-- Insert sample lecturer
INSERT INTO public.lecturers (name, email, password_hash, department) VALUES
('Dr. Adeyemi', 'adeyemi@university.edu', '$2y$10$examplehash123', 'Computer Science');

-- Insert sample students
INSERT INTO public.students (name, matrix_number, email, trust_score) VALUES
('Bolaji David', '259096010', 'bolaji@student.edu', 95.50),
('Adebayo Omotola', '259096011', 'adebayo@student.edu', 88.00),
('Chinedu Okafor', '259096012', 'chinedu@student.edu', 72.30),
('Fatima Bello', '259096013', 'fatima@student.edu', 91.20),
('Emeka Nwosu', '259096014', 'emeka@student.edu', 65.00),
('Aisha Mohammed', '259096015', 'aisha@student.edu', 97.80),
('Tunde Bakare', '259096016', 'tunde@student.edu', 45.50),
('Grace Okonkwo', '259096017', 'grace@student.edu', 82.10),
('Ibrahim Suleiman', '259096018', 'ibrahim@student.edu', 78.90),
('Ngozi Eze', '259096019', 'ngozi@student.edu', 55.00);

-- Insert sample sessions
INSERT INTO public.sessions (meeting_id, topic, course_code, scheduled_time, actual_start_time, duration_minutes, status, total_present, total_late, total_absent) VALUES
('zoom_meeting_001', 'Introduction to AI', 'CSC401', '2026-04-28 09:00:00+01', '2026-04-28 09:02:00+01', 60, 'completed', 8, 1, 1),
('zoom_meeting_002', 'Machine Learning Basics', 'CSC401', '2026-04-29 09:00:00+01', '2026-04-29 09:00:00+01', 90, 'completed', 7, 2, 1),
('zoom_meeting_003', 'Neural Networks', 'CSC401', '2026-04-30 09:00:00+01', '2026-04-30 09:05:00+01', 60, 'completed', 9, 0, 1),
('zoom_meeting_004', 'Deep Learning', 'CSC401', '2026-05-01 09:00:00+01', '2026-05-01 09:01:00+01', 60, 'completed', 6, 3, 1),
('zoom_meeting_005', 'NLP Fundamentals', 'CSC401', '2026-05-02 09:00:00+01', NULL, 60, 'active', 0, 0, 0);

-- Insert sample attendance records (we'll use subqueries to reference IDs)
-- Session 1 attendance
INSERT INTO public.attendance (student_id, session_id, join_time, leave_time, duration_seconds, status, raw_display_name)
SELECT s.id, sess.id, '2026-04-28 09:01:00+01', '2026-04-28 10:00:00+01', 3540, 'present', 'Bolaji_259096010'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096010' AND sess.meeting_id = 'zoom_meeting_001';

INSERT INTO public.attendance (student_id, session_id, join_time, leave_time, duration_seconds, status, raw_display_name)
SELECT s.id, sess.id, '2026-04-28 09:03:00+01', '2026-04-28 10:00:00+01', 3420, 'present', 'Adebayo_259096011'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096011' AND sess.meeting_id = 'zoom_meeting_001';

INSERT INTO public.attendance (student_id, session_id, join_time, leave_time, duration_seconds, status, raw_display_name, is_suspicious)
SELECT s.id, sess.id, '2026-04-28 09:25:00+01', '2026-04-28 09:35:00+01', 600, 'late', 'Tunde_259096016', TRUE
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096016' AND sess.meeting_id = 'zoom_meeting_001';

INSERT INTO public.attendance (student_id, session_id, join_time, leave_time, duration_seconds, status, raw_display_name)
SELECT s.id, sess.id, '2026-04-28 09:00:00+01', '2026-04-28 10:00:00+01', 3600, 'present', 'Fatima_259096013'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096013' AND sess.meeting_id = 'zoom_meeting_001';

INSERT INTO public.attendance (student_id, session_id, join_time, leave_time, duration_seconds, status, raw_display_name)
SELECT s.id, sess.id, '2026-04-28 09:02:00+01', '2026-04-28 10:00:00+01', 3480, 'present', 'Aisha_259096015'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096015' AND sess.meeting_id = 'zoom_meeting_001';

-- Insert sample fraud alerts
INSERT INTO public.fraud_alerts (student_id, session_id, alert_type, severity, description)
SELECT s.id, sess.id, 'short_duration', 'high', 'Student was in meeting for only 10 minutes (600 seconds). Expected minimum: 30 minutes.'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096016' AND sess.meeting_id = 'zoom_meeting_001';

INSERT INTO public.fraud_alerts (student_id, session_id, alert_type, severity, description)
SELECT s.id, sess.id, 'multiple_logins', 'medium', 'Student joined and left the meeting 4 times during the session.'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096014' AND sess.meeting_id = 'zoom_meeting_002';

INSERT INTO public.fraud_alerts (student_id, session_id, alert_type, severity, description)
SELECT s.id, sess.id, 'late_pattern', 'medium', 'Student has been late to more than 50% of sessions attended.'
FROM public.students s, public.sessions sess
WHERE s.matrix_number = '259096019' AND sess.meeting_id = 'zoom_meeting_003';
