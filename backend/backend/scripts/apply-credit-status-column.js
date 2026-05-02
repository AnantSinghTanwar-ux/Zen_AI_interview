const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:subhro2004@localhost:5432/hiring_platform?sslmode=disable',
  });

  await client.connect();
  await client.query(
    "ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success';",
  );
  await client.end();
  console.log('Applied: credit_transactions.status');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
