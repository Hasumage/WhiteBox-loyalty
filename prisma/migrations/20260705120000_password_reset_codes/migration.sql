DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PASSWORD_RESET'
      AND enumtypid = '"EmailVerificationPurpose"'::regtype
  ) THEN
    ALTER TYPE "EmailVerificationPurpose" ADD VALUE 'PASSWORD_RESET';
  END IF;
END $$;
