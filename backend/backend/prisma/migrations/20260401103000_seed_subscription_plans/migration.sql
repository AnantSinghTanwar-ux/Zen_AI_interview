-- Seed active subscription plans for Razorpay checkout
-- Rs. 59 -> 60 credits
-- Rs. 119 -> 150 credits
-- Rs. 179 -> 250 credits

-- Keep only the new paid plan set active to avoid legacy plan confusion
UPDATE plans
SET is_active = FALSE
WHERE is_active = TRUE
  AND (
    (price::numeric = 59 AND credits = 60 AND UPPER(currency) = 'INR')
    OR (price::numeric = 119 AND credits = 150 AND UPPER(currency) = 'INR')
    OR (price::numeric = 179 AND credits = 250 AND UPPER(currency) = 'INR')
  ) = FALSE;

INSERT INTO plans (name, credits, price, currency, is_active)
SELECT 'Starter', 60, 59, 'INR', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM plans
  WHERE credits = 60 AND price::numeric = 59 AND UPPER(currency) = 'INR' AND is_active = TRUE
);

INSERT INTO plans (name, credits, price, currency, is_active)
SELECT 'Growth', 150, 119, 'INR', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM plans
  WHERE credits = 150 AND price::numeric = 119 AND UPPER(currency) = 'INR' AND is_active = TRUE
);

INSERT INTO plans (name, credits, price, currency, is_active)
SELECT 'Pro', 250, 179, 'INR', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM plans
  WHERE credits = 250 AND price::numeric = 179 AND UPPER(currency) = 'INR' AND is_active = TRUE
);
