/**
 * Render start command. With a valid PostgreSQL address in DATABASE_URL, apply the database migrations and start
 * with database storage. With no address or an invalid one, say so plainly in the log and start anyway with
 * memory storage, so a missing database never keeps the site offline (analyses are then lost on restart).
 */
const { execSync } = require('child_process');

/** Removes spaces and surrounding quotes that often come along when an address is pasted. */
function tidy(value) {
  return (value ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
}

const url = tidy(process.env.DATABASE_URL);
const valid = /^postgres(ql)?:\/\//.test(url);

if (valid) {
  process.env.DATABASE_URL = url;
  const direct = tidy(process.env.DIRECT_URL);
  process.env.DIRECT_URL = /^postgres(ql)?:\/\//.test(direct) ? direct : url;
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} else {
  if (url) {
    console.warn(
      'DATABASE_URL is not a PostgreSQL address (it must start with postgresql://, without quotes or spaces). ' +
        'Starting WITHOUT a database: analyses are kept in memory until this is fixed.',
    );
  } else {
    console.warn('DATABASE_URL is empty. Starting WITHOUT a database: analyses are kept in memory.');
  }
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
}

require('./dist/main.js');
