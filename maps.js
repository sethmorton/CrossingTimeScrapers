// imports
const axios = require('axios');
const fs = require('fs');
const { Pool } = require('pg');
const SECRET_PASS="S2R5SRyQGR8NJXhh";
const SECRET_USER="borderuser";
const config = {
  user: SECRET_USER, // env var: PGUSER
  database: 'smartborder', // env var: PGDATABASE
  password: SECRET_PASS, // env var: PGPASSWORD
  host: 'public-db-ssp.aivencloud.com', // Server hosting the postgres database
  port: 27076, // env var: PGPORT
  max: 10, // max number of clients in the pool
  idleTimeoutMillis: 5000,
  ssl: {
    ca: fs.readFileSync('/home/sethmorton/ca.pem'),
  }, // how long a client is allowed to remain idle before being closed
};
class Maps {
  async googleMaps() {
    const GOOGLE_API_KEY = `AIzaSyCXD1CInLtPgHXXkcUeps3XLaxkO7qNjxI`
    let request_url = `https://maps.googleapis.com/maps/api/distancematrix/json?`
    request_url += `origins=32.529299,-117.023699&destinations=32.552180,-117.0442166&departure_time=now&key=${GOOGLE_API_KEY}`
    // am i too lazy to get the interface for the google response data? yes, yes i am
    const googleResponse = await axios.get(request_url)
    // after some time... i have found the duration in this massive nest
    const travelTime = googleResponse.data.rows[0].elements[0].duration_in_traffic.value
    const insertTimesSQL = `
    INSERT INTO wait_times(port_id, duration, datetime)
      VALUES (1, ${travelTime}, current_timestamp);
    `
    const pool = new Pool(config);
    console.log(pool);
    pool.query(insertTimesSQL, (err, res) => {
      let { rows } = res;
      console.log(rows)
      pool.end()
    })
  }
}
const maps = new Maps()
maps.googleMaps()

