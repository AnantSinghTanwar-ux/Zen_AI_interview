-- Create referral_redemptions table to track code redemptions
CREATE TABLE referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  referrer_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id) -- One user can only redeem one code
);

-- Add indexes for efficient queries
CREATE INDEX idx_referral_redemptions_user_id ON referral_redemptions(user_id);
CREATE INDEX idx_referral_redemptions_referrer_id ON referral_redemptions(referrer_id);
