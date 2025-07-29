CREATE OR REPLACE FUNCTION get_monitoring_dashboard_data()
RETURNS json AS $$
DECLARE
    active_users_data json;
    feedback_data json;
    student_activities_data json;
BEGIN
    -- Get active users
    SELECT json_agg(t) INTO active_users_data FROM (
        SELECT * FROM public.profiles WHERE is_active = true ORDER BY updated_at DESC
    ) t;

    -- Get feedback with profile info
    SELECT json_agg(f) INTO feedback_data FROM (
        SELECT 
            feedback.*,
            json_build_object('name', p.name, 'email', p.email) as profiles
        FROM public.feedback
        LEFT JOIN public.profiles p ON feedback.submitted_by = p.user_id
        ORDER BY feedback.created_at DESC
    ) f;

    -- Get student activities (this is more complex, so we'll simplify for the function)
    -- Here we'll just get the latest 100 activities and group them on the client
    SELECT json_agg(sa) INTO student_activities_data FROM (
        SELECT sa.*, p.name as student_name, p.email as student_email
        FROM public.student_activities sa
        LEFT JOIN public.profiles p ON sa.user_id = p.user_id
        WHERE p.role = 'student'
        ORDER BY sa.created_at DESC
        LIMIT 100
    ) sa;

    RETURN json_build_object(
        'activeUsers', active_users_data,
        'feedback', feedback_data,
        'studentActivities', student_activities_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
