-- Ensure images column is TEXT[] type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'images'
    AND data_type != 'ARRAY'
  ) THEN
    ALTER TABLE listings ALTER COLUMN images TYPE TEXT[] USING images::TEXT[];
  END IF;
END $$;

-- Ensure default is empty array
ALTER TABLE listings ALTER COLUMN images SET DEFAULT '{}';
