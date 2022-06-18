// IMPORTS

const dotenv = require('dotenv')
dotenv.config({ path: __dirname + '/.env' })
console.log(__dirname + '/.env')

const fs = require("fs");
const axios = require("axios");
const { DateTime } = require("luxon");
const { Pool } = require("pg");
const { parse } = require('rss-to-json');
const SECRET_PASS= process.env.SECRET_PASS;
const SECRET_USER= process.env.SECRET_USER;
const SECRET_HOST = process.env.SECRET_HOST;
const SECRET_DATABASE = process.env.SECRET_HOST;

// CONSTS
const lane_types = ['general', 'sentri', 'ready'];
const bpsql = 'INSERT INTO rss_times(date, lane_type, delay_seconds, port_num, daterecorded, raw_json) VALUES (';
const endbp = ');';
const portnum = 250401;


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
	console.log(q);
  console.log(pool)
    const res = await pool.query(q);
    console.log(res);
    return res;
  } catch (err) {
    throw err;
  }
};
const collect = async () => {
    let q = ``;
    let data = await parse('https://bwt.cbp.gov/api/bwtRss/rssbyportnum/HTML/POV/250401');
    let raw_data = JSON.stringify(data['items'][0]['description']);
    let description = data['items'][0]['description']['$text'];
    let durationReg = /\d{1,3} (min)/gm;
    let noonReg = /Noon PDT/gm
    let midnightReg = /Midnight PDT/gm
    let timestampReg = /\d{1,3}:\d{2} (am|pm)/gm
    let durationFound = description.match(durationReg);
    let timestampFound = description.match(timestampReg);
    if (timestampFound == null) {
      timestampFound = []
    }
    let noonFound = description.match(noonReg);
    console.log(noonFound);
    let midnightFound = description.match(midnightReg);
    console.log(midnightFound);

    if (midnightFound != null) {
      for (let i = 0; i < midnightFound.length; i++) {
        console.log(timestampFound)
        timestampFound.push('12:00 am');
      }
    }
    if (noonFound != null) {
      console.log(noonFound)
      for (let i = 0; i < noonFound.length; i++) {
        console.log(timestampFound)
        timestampFound.push('12:00 pm');
      }
    }
    for (let i = 0; i < durationFound.length; i++) {
        const year = new Date().getFullYear();
        const month = ('0' + (new Date().getMonth() + 1)).slice(-2)
        const day = ('0' + (new Date().getDate())).slice(-2)
        const update_time = new Date(`${year}-${month}-${day} ${timestampFound[i]}`);
        console.log(update_time);
        let duration = Number(durationFound[i].match(/\d{1,3}/gm)[0]);
        let dateInsert = `TO_TIMESTAMP('${year}-${month}-${day} ${update_time.getHours()}:00:00.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
        let dateTime = DateTime.now().setZone('America/Los_Angeles');
        let date_recorded = `TO_TIMESTAMP('${dateTime.year}-${dateTime.month}-${dateTime.day} ${dateTime.hour}:${dateTime.minute}:${dateTime.second}.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
        console.log(dateInsert);
        q += `${bpsql}`
        q += `${dateInsert},`
        q += `'${i}',`
        q += `${duration * 60},`;
        q += `${portnum},`;
        q += `${date_recorded},`;
        q += `'${raw_data}'`;
        q += endbp;
    }
    console.log(q);
    let collected = await query(q)
    fs.appendFileSync('/var/www/crossingTimes/rss.txt', `${q}`);
}

collect();
