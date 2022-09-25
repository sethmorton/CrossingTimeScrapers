const dotenv = require("dotenv");
dotenv.config({ path: __dirname + "/.env" });

/**
 * Imports
 */
const axios = require("axios");
const fs = require("fs");
const postgres = require("pg");
const { Pool } = postgres;
const converter = require("rss-to-json");
const { parse } = converter;
const luxon = require("luxon");
const { DateTime } = luxon;
const SECRET_PASS = process.env.SECRET_PASS;
const SECRET_USER = process.env.SECRET_USER;
const SECRET_HOST = process.env.SECRET_HOST;
const SECRET_DATABASE = process.env.SECRET_DATABASE;

class Scraper {
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
        ca: fs.readFileSync("./ca.pem"),
      }, // how long a client is allowed to remain idle before being closed
    };
    const pool = new Pool(config);
    try {
      console.log("hello");
      const res = await pool.query(q);
      console.log("data has been collected");
      // console.log(res.rows);
      // return res;
      pool.end();
      return res.rows;
    } catch (err) {
      console.log('Something"s gone wrong');
      throw err;
    }
  }
  /**
   *
   * @returns Returns the last available date from TRADE BTS
   */
  async getLastTradeDate() {
    const startDate = DateTime.fromObject({ year: 2022, month: 1 });
    const currentDate = DateTime.now();
    const currentDateNoDay = DateTime.fromObject({
      year: currentDate.year,
      month: currentDate.month,
    });

    for (
      let dt = currentDateNoDay;
      dt >= startDate;
      dt = dt.minus({ months: 1 })
    ) {
      const data = await (
        await fetch(
          `https://data.bts.gov/resource/ku5b-t97n.json?$$app_token=wUg7QFry0UMh97sXi8iM7I3UX&$limit=100000&year=${dt.year}&month=${dt.month}`
        )
      ).json();
      // console.log(data);
      if (data.length > 1) {
        // console.log(dt);
        return dt;
      }
    }
    return currentDateNoDay;
  }
    /**
   *
   * Scrapes
   */
  async tradeScrape(ports) {
    const translationObject = {
      "San Ysidro": 2404,
      Andrade: 2502,
      "Calexico East": 2507,
      "Calexico West": 2503,
      "Otay Mesa": 2506,
      Tecate: 2505,
    };
    let q = `
    SELECT date FROM tradenums ORDER BY date DESC LIMIT 1; 
    `;
    let lastDate = await this.query(q);
    /**
     * This is the last date inserted into the table
     */
    let startDate = DateTime.fromJSDate(new Date(lastDate[0]["date"]));
    console.log(startDate.year, startDate.month, "START DATE");
    /**
     * /
     * Last date updated by API
     */
    let lastTrade = await this.getLastTradeDate();
    if (startDate.toJSDate() < lastTrade.toJSDate()) {
      for (const port of ports) {
        for (
          let dt = startDate.plus({ months: 1 });
          dt <= lastTrade;
          dt = dt.plus({ months: 1 })
        ) {
          const query = `https://data.bts.gov/resource/ku5b-t97n.json?$$app_token=wUg7QFry0UMh97sXi8iM7I3UX&$limit=100000&year=${dt.year}&month=${dt.month}&depe=${translationObject[port]}`;
          // console.log(query);
          const data = await (await fetch(query)).json();
          // console.log(data);
          const sum = data.reduce((accumulator, object) => {
            return accumulator + Number(object.value);
          }, 0);
          // console.log(sum);
          let obj = {};
          obj[port] = {
            date: { year: dt.year, month: dt.month },
            sum: sum,
          };

          console.log(
            `INSERT INTO tradenums(port_name, port_id, date, sum) VALUES ('${port}', ${translationObject[port]}, TO_TIMESTAMP('${dt.year}, ${dt.month}, 01', 'YYYY-MM-DD'), ${sum})`
          );
          this.query(
            `INSERT INTO tradenums(port_name, port_id, date, sum) VALUES ('${port}', ${translationObject[port]}, TO_TIMESTAMP('${dt.year}, ${dt.month}, 01', 'YYYY-MM-DD'), ${sum})`
          );
        }
      }
    }
  }
  async btsScrape() {
    const PASSENGERS = [
      "Personal Vehicle Passengers",
      "Train Passengers",
      "Bus Passengers",
    ];
    const VEHICLES = ["Personal Vehicles", "Buses", "Trains"];
    const PEDESTRIANS = ["Pedestrians"];
    const TRUCKS = ["Trucks"];
    /**
     * This object includes all the potential measures on the current dashboard
     */
    const mergedObject = {
      Pedestrians: PEDESTRIANS,
      Vehicles: VEHICLES,
      Passengers: PASSENGERS,
      Trucks: TRUCKS,
    };
    const ports = ['Calexico', 'Otay Mesa', 'Andrade', 'Calexico West', 'Tecate'];
    // , 'Calexico East', 'Otay Mesa', 'Andrade', 'Calexico West', 'Tecate'

    let q = `
    SELECT date FROM btsnums ORDER BY date DESC LIMIT 1; 
    `;
    let lastDate = await this.query(q);
    /**
     * This is the last date inserted into the table
     */
    let startDate = DateTime.fromJSDate(new Date(lastDate[0]["date"]));
    let lastTrade = await this.getLastBTSDate();
    console.log(lastTrade, startDate);
    if (startDate.toJSDate() < lastTrade.toJSDate()) {
      for (const port of ports) {
        console.log(lastTrade);
        for (const [key, value] of Object.entries(mergedObject)) {
          // console.log(value)
          console.log(port);
          for (let i = 0; i < value.length; i++) {
            console.log(port);
            console.log(
              `https://data.bts.gov/id/keg4-3bc2.json?$limit=100000&$where=date%20between%20%272021-09-01T00:00:00.000%27%20and%20%272022-09-01T00:00:00.000%27&border=US-Mexico%20Border&measure=${value[i]}&port=${port}`
            );
            for (
              let dt = startDate;
              dt <= lastTrade;
              dt = dt.plus({ months: 1 })
            ) {
              let dateplusone = dt.plus({ months: 1 });
              let measureSum = 0;
              let data = await (
                await fetch(
                  `https://data.bts.gov/id/keg4-3bc2.json?$limit=100000&$where=date between '${dt.year}-${dt.month}-${dt.day}T00:00:00.000' and '${dateplusone.year}-${dateplusone.month}-${dateplusone.day}T00:00:00.000'&border=US-Mexico%20Border&measure=${value[i]}&port_name=${port}`
                )
              ).json();
              for (const element of data) {
                measureSum = Number(element.value);
              }
              const PORTS = {
                "San Ysidro": [250401],
                "Otay Mesa": [250601],
                Calexico: [250301],
                Andrade: [250201],
                Tecate: [250501],
                "Calexico West": [250302],
              };
              console.log(
                `INSERT INTO btsnums(port_name, port_code, measure, value, date) VALUES (${port}, ${PORTS[port][0]}, ${value[i]}, ${measureSum}, TO_TIMESTAMP('${dt.year}, ${dt.month}, 01', 'YYYY-MM-DD'))`
              );
              this.query(
                `INSERT INTO btsnums(port_name, port_code, measure, value, date) VALUES ('${port}', ${PORTS[port][0]}, '${value[i]}', ${measureSum}, TO_TIMESTAMP('${dt.year}, ${dt.month}, 01', 'YYYY-MM-DD'))`
              );
            }
          }
        }
      }
    }
  }

  async getLastBTSDate() {
    const startDate = DateTime.fromObject({ year: 2022, month: 1 });
    const currentDate = DateTime.now();
    const currentDateNoDay = DateTime.fromObject({
      year: currentDate.year,
      month: currentDate.month,
    });

    for (
      let dt = currentDateNoDay;
      dt >= startDate;
      dt = dt.minus({ months: 1 })
    ) {
      let dateplusone = dt.plus({ months: 1 });
      const data = await (
        await fetch(
          `https://data.bts.gov/id/keg4-3bc2.json?$limit=100000&$where=date between '${dt.year}-${dt.month}-${dt.day}T00:00:00.000' and '${dateplusone.year}-${dateplusone.month}-${dateplusone.day}T00:00:00.000'`
        )
      ).json();
      if (data.length > 1) {
        return dt;
      }
    }
    return currentDateNoDay;
  }
}
const scraper = new Scraper();
scraper.btsScrape();
scraper.tradeScrape();
