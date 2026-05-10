CREATE OR REPLACE FUNCTION try_use_deep_analysis(p_user_id uuid, p_limit int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO deep_analysis_usage (user_id, use_date, count)
  VALUES (p_user_id, CURRENT_DATE, 0)
  ON CONFLICT (user_id, use_date) DO NOTHING;

  SELECT count INTO v_count
  FROM deep_analysis_usage
  WHERE user_id = p_user_id AND use_date = CURRENT_DATE
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN -1;
  END IF;

  UPDATE deep_analysis_usage
  SET count = count + 1
  WHERE user_id = p_user_id AND use_date = CURRENT_DATE
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;
