-- Drop the single booking unique constraint to allow both guest and host reviews
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_key;

-- Allow one review per booking per reviewer role
CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_role_unique
  ON reviews (booking_id, reviewer_role);

-- Add FK on reviewee_id referencing profiles if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'reviews_reviewee_id_fkey'
  ) THEN
    ALTER TABLE reviews
      ADD CONSTRAINT reviews_reviewee_id_fkey
      FOREIGN KEY (reviewee_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for reviewee lookups
CREATE INDEX IF NOT EXISTS reviews_reviewee_id_idx ON reviews (reviewee_id);
