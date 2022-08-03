
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/.env' });

/** 
* Imports
*/
const axios = require('axios');
const fs = require('fs');
const postgres = require('pg');
const { Pool } = postgres;
const converter = require('rss-to-json');
const { parse } = converter;
const luxon = require('luxon');
const { DateTime } = luxon;
const SECRET_PASS = process.env.SECRET_PASS;
const SECRET_USER = process.env.SECRET_USER;
const SECRET_HOST = process.env.SECRET_HOST;
const SECRET_DATABASE = process.env.SECRET_DATABASE;

class Maps {
  async merge_run() {
    await this.googleMaps();
    const portNumbers = [250601, 250401, 250301, 250302];
    // Otay
    await this.rss_feed(250601);
    // San Ysidro
    await this.rss_feed(250401);
    // Calexico West
    await this.rss_feed(250301);
    // Calexico East
    await this.rss_feed(250302);
    //  await this.rss_feed();
  }
  /**
   * 
   * @param {string} q Query for DB, formatting will be included in the query
   * @param {string} db just serving as the name of whether it's going to the cbp table or the google table for the logging i'm doing. 
   */
  async query(q, db) {
    const config = {
      user: SECRET_USER, // env var: PGUSER
      database: SECRET_DATABASE, // env var: PGDATABASE
      password: SECRET_PASS, // env var: PGPASSWORD
      host: SECRET_HOST, // Server hosting the postgres database
      port: 27076, // env var: PGPORT
      max: 10, // max number of clients in the pool
      idleTimeoutMillis: 5000,
      ssl: {
        ca: fs.readFileSync('./ca.pem'),
      }, // how long a client is allowed to remain idle before being closed
    };
    const pool = new Pool(config);
    try {
      console.log('hello')
      const res = await pool.query(q);
      console.log('data has been collected');
      console.log(`Rows have been inserted into ${db}`)
      // return res;
    } catch (err) {
      console.log('Something"s gone wrong');
      throw err;
    }
  }
  async googleMaps() {
    const GOOGLE_API_KEY = `AIzaSyCXD1CInLtPgHXXkcUeps3XLaxkO7qNjxI`
    let request_url = `https://maps.googleapis.com/maps/api/distancematrix/json?`
    request_url += `origins=32.529299,-117.023699&destinations=32.552180,-117.0442166&departure_time=now&key=${GOOGLE_API_KEY}`
    // am i too lazy to get the interface for the google response data? yes, yes i am
    const googleResponse = await axios.get(request_url)
    // after some time... i have found the duration in this massive nest
    const travelTime = googleResponse.data.rows[0].elements[0].duration_in_traffic.value
    const insertTimesSQL = `
    INSERT INTO wait_times(duration, datetime)
      VALUES ( ${travelTime}, current_timestamp);
    `
    this.query(insertTimesSQL, "Maps Table");
  }
  async rss_feed(port_num = 250401) {
    const lane_types = ['general', 'sentri', 'ready'];
    const bpsql = 'INSERT INTO rss_times(date, lane_type, delay_seconds, port_num, daterecorded, raw_json) VALUES (';
    const endbp = ');';
    let q = ``;
    // It's time for some REGEX.  
    let data = await parse(`https://bwt.cbp.gov/api/bwtRss/rssbyportnum/HTML/POV/${port_num}`);
    let raw_data = JSON.stringify(data['items'][0]['description']);
    let description = data['items'][0]['description']['$text'];
    console.log(description);
    let durationReg = /\d{1,3} (min)/gm;
    let laneClosedReg = /((Ready|Sentri|General) Lanes:  Lanes Closed)/gm
    let noonReg = /Noon PDT/gm
    let midnightReg = /Midnight PDT/gm
    let timestampReg = /\d{1,3}:\d{2} (am|pm)/gm
    let durationFound = description.match(durationReg);
    let updatePendingReg = /((Ready|Sentri|General) Lanes:  Update Pending)/gm;
    let updatePendingFound = description.match(updatePendingReg);
    let timestampFound = description.match(timestampReg);
    let laneClosedFound = description.match(laneClosedReg);
    if (timestampFound == null) {
      timestampFound = [];
    };
    if (laneClosedFound == null) {
      laneClosedFound = [];
    };
    console.log(laneClosedFound);
    let noonFound = description.match(noonReg);
    let midnightFound = description.match(midnightReg);
    if (midnightFound != null) {
      for (let i = 0; i < midnightFound.length; i++) {
        timestampFound.push('12:00 am');
      }
    }
    if (noonFound != null) {
      for (let i = 0; i < noonFound.length; i++) {
        timestampFound.push('12:00 pm');
      }
    };
    console.log(durationFound);
    let dateTime = DateTime.now().setZone('America/Los_Angeles');
    let date_recorded = `TO_TIMESTAMP('${dateTime.year}-${dateTime.month}-${dateTime.day} ${dateTime.hour}:${dateTime.minute}:${dateTime.second}.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
    console.log(date_recorded)
    if (laneClosedFound != null) {
      laneClosedFound.forEach(element => {
        let firstWord = /^[^\s]+/gm;
        let matchedWord = element.match(firstWord);
        if (matchedWord == 'Ready') {
          q = `INSERT INTO update_pending(port_num, raw_json, date_recorded, lane_type, reason) VALUES (${port_num}, '${raw_data}', ${date_recorded}, 2, 'Lane Closed');`
        }
        if (matchedWord == 'Sentri') {
          q = `INSERT INTO update_pending(port_num, raw_json, date_recorded, lane_type, reason) VALUES (${port_num}, '${raw_data}', ${date_recorded}, 1, 'Lane Closed');`
        };
        if (matchedWord == 'General') {
          q = `INSERT INTO update_pending(port_num, raw_json, date_recorded, lane_type, reason) VALUES (${port_num}, '${raw_data}', ${date_recorded}, 0, 'Lane Closed');`
        };
        // console.log(q);
      });
    };
    console.log(updatePendingFound);
    if (updatePendingFound != null) {
      updatePendingFound.forEach(element => {
        let firstWord = /^[^\s]+/gm;
        let matchedWord = element.match(firstWord);
        if (matchedWord == 'Ready') {
          q = `INSERT INTO update_pending(port_num, raw_json, date_recorded, lane_type, reason) VALUES (${port_num}, '${raw_data}', ${date_recorded}, 2, 'Update Pending');`
        }
        if (matchedWord == 'Sentri') {
          q = `INSERT INTO update_pending(port_num, raw_json, date_recorded, lane_type, reason) VALUES (${port_num}, '${raw_data}', ${date_recorded}, 1, 'Update Pending');`
        };
        if (matchedWord == 'General') {
          q = `INSERT INTO update_pending(port_num, raw_json, date_recorded, lane_type, reason) VALUES (${port_num}, '${raw_data}', ${date_recorded}, 0, 'Update Pending');`
        };
        // console.log(q);
      });
    };
    if (durationFound != null) {
      for (let i = 0; i < durationFound.length; i++) {
        const year = new Date().getFullYear();
        const month = ('0' + (new Date().getMonth() + 1)).slice(-2)
        const day = ('0' + (new Date().getDate())).slice(-2);
        const update_time = new Date(`${year}-${month}-${day} ${timestampFound[i]}`);
        /**
         * Duration in minutes
         */
        let duration = Number(durationFound[i].match(/\d{1,3}/gm)[0]);
        let dateTime = DateTime.now().setZone('America/Los_Angeles');
        let dateInsert = `TO_TIMESTAMP('${dateTime.year}-${dateTime.month}-${dateTime.day} ${update_time.getHours()}:00:00.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
       
        // let dateInsert = `TO_TIMESTAMP('${year}-${month}-${day} ${update_time.getHours()}:00:00.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
        console.log(dateInsert);
        q += `${bpsql}`
        q += `${dateInsert},`
        q += `'${i}',`
        q += `${duration * 60},`;
        q += `${port_num},`;
        q += `${date_recorded},`;
        q += `'${raw_data}'`;
        q += endbp;
      }
    };
    // console.log(q)
    await this.query(q, "CBP Table");
  }
}
const maps = new Maps()
maps.merge_run();