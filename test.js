// IMPORTS

const dotenv = require('dotenv')
dotenv.config({ path: __dirname + '/.env' })
console.log(__dirname + '/.env')

const fs = require("fs");
const { Pool } = require("pg");
const SECRET_PASS= process.env.SECRET_PASS;
const SECRET_USER= process.env.SECRET_USER;
const SECRET_HOST = process.env.SECRET_HOST;
const SECRET_DATABASE = process.env.SECRET_DATABASE;

// FUNCS

const query = async (q) => {
  const config = {
    user: SECRET_USER, // env var: PGUSER
    database: SECRET_DATABASE, // env var: PGDATABASE
    password: SECRET_PASS, // env var: PGPASSWORD
    host: SECRET_HOST, // Server hosting the postgres database
    port: 27076, // env var: PGPORT
    max: 10, // max number of clients in the pool
    idleTimeoutMillis: 5000,
    ssl: {
      ca: fs.readFileSync('/var/www/ca.pem'),
    }, // how long a client is allowed to remain idle before being closed
  };
  const pool = new Pool(config);
  try {
	// console.log(q);
//   console.log(pool)
    const res = await pool.query(q);
    console.log(res.rows);
    return res;
    
  } catch (err) {
    throw err;
  }
};
const collect = async () => {
    let q = `select * from rss_times limit 2;`;
    query(q);

}

collect();
