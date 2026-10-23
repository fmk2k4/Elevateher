import { neon } from '@neondatabase/serverless';
import pg from 'pg';
const { Pool } = pg;

const NullishQueryFunction = () => {
  throw new Error(
    'No database connection string was provided'
  );
};
NullishQueryFunction.transaction = () => {
  throw new Error('No DB URL');
};

let sql;
if (!process.env.DATABASE_URL) {
  sql = NullishQueryFunction;
} else if (process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('http')) {
  sql = neon(process.env.DATABASE_URL);
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  sql = async function(strings, ...values) {
    let text = strings[0];
    for (let i = 1; i < strings.length; i++) {
      text += '$' + i + strings[i];
    }
    const { rows } = await pool.query(text, values);
    return rows;
  };
}

export default sql;