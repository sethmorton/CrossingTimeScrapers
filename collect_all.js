
// const dotenv = require('dotenv');
// dotenv.config({ path: __dirname + '/.env' });

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
const SECRET_PORT = process.env.SECRET_PORT;

console.log(SECRET_DATABASE);

class Maps {
  async merge_run() {
    await this.googleMaps();
    // Otay
    await this.rss_feed(250601);
    // San Ysidro
    await this.rss_feed(250401);
    // Calexico West
    await this.rss_feed(250301);
    // Calexico East
    await this.rss_feed(250302);
    // Tecate
    await this.rss_feed(250201);
    // Andrade
    await this.rss_feed(250501);
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
      port: SECRET_PORT, // env var: PGPORT
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
    const bpsql = 'INSERT INTO rss_times(date, lane_type, delay_seconds, port_num, daterecorded, raw_json) VALUES (';
    const endbp = ');';
    let q = ``;
    // It's time for some REGEX.  
    let data = await parse(`https://bwt.cbp.gov/api/bwtRss/rssbyportnum/HTML/POV/${port_num}`);
    let raw_data = JSON.stringify(data['items'][0]['description']);
    let description = data['items'][0]['description']['$text'];
    console.log(description);

    let dateTime = DateTime.now().setZone('America/Los_Angeles');
    let date_recorded = `TO_TIMESTAMP('${dateTime.year}-${dateTime.month}-${dateTime.day} ${dateTime.hour}:${dateTime.minute}:${dateTime.second}.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
    const openLanesRegex = /(General|Ready|Sentri).(.*?)delay/gm;
    const openLanesArray = description.match(openLanesRegex);

    if (openLanesArray != null) {
      for (let i = 0; i < openLanesArray.length; i++) {
        if (openLanesArray[i].match(/(General|Ready|Sentri).(.*?)Closed/gm)) {
          let newElement = openLanesArray[i].match(/(?<=Closed).*/gm);
          openLanesArray.pop(i);
          openLanesArray.push(newElement[0])
        }
      };
    }
    const updatePendingReg = /((Ready|Sentri|General) Lanes:  Update Pending)/gm;
    const updatePendingArray= description.match(updatePendingReg);
    const laneClosedReg = /((Ready|Sentri|General) Lanes:  Lanes Closed)/gm
    const laneClosedArray = description.match(laneClosedReg);
    if (laneClosedArray != null) {
      laneClosedArray.forEach(element => {
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
      });
    };
    if (updatePendingArray != null) {
      updatePendingArray.forEach(element => {
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

    console.log(openLanesArray);
    if(openLanesArray != null) {
      openLanesArray.forEach(element => {
        let lane = 0;
        const durationFinder = element.match(/\d{1,3} (min)/gm);
        const noonReg = /Noon PDT/gm;
        const midnightReg = /Midnight PDT/gm
        const timestampReg = /\d{1,3}:\d{2} (am|pm)/gm;
        const laneFinder = element.match(/(General|Ready|Sentri)/gm);
        let timestampArray = [];
        if (element.match(noonReg)) {
          timestampArray.push('12:00 pm')
        }
        else if (element.match(midnightReg)) {
          console.log("HELLO??")
          timestampArray.push('12:00 am')
        }
        else {
          timestampArray = element.match(/\d{1,3}:\d{2} (am|pm)/gm);
        }
        
        console.log(timestampArray);
        if (laneFinder[0] == "General") {
          lane = 0;
        }
        if (laneFinder[0] == "Sentri") {
          lane = 1;
        }
        if (laneFinder[0] == "Ready") {
          lane = 2;
        };
        let duration = Number(durationFinder[0].match(/\d{1,3}/gm)[0]);
        const year = new Date().getFullYear();
        const month = ('0' + (new Date().getMonth() + 1)).slice(-2)
        const day = ('0' + (new Date().getDate())).slice(-2);
        const update_time = new Date(`${year}-${month}-${day} ${timestampArray[0]}`);
        let dateInsert = `TO_TIMESTAMP('${dateTime.year}-${dateTime.month}-${dateTime.day} ${update_time.getHours()}:00:00.000000000', 'YYYY-MM-DD HH24:MI:SS.FF')`;
        console.log(duration);
        q += `${bpsql}`
        q += `${dateInsert},`
        q += `'${lane}',`
        q += `${duration * 60},`;
        q += `${port_num},`;
        q += `${date_recorded},`;
        q += `'${raw_data}'`;
        q += endbp;
      });
    }
    await this.query(q, "CBP Table");
  }
}
const maps = new Maps()
maps.merge_run();
