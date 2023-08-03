const dotenv = require("dotenv");
dotenv.config({ path: __dirname + "/.env" });

/**
 * Imports
 */
const fs = require("fs");
const postgres = require("pg");
const { Pool } = postgres;
const converter = require("rss-to-json");
const luxon = require("luxon");
const { DateTime } = luxon;
const SECRET_PASS = process.env.SECRET_PASS;
const SECRET_USER = process.env.SECRET_USER;
const SECRET_HOST = process.env.SECRET_HOST;
const SECRET_DATABASE = process.env.SECRET_DATABASE;



// INTERFACES 
/**
 * @typedef {Object[]} BorderCrossingData
 * @property {string} port_name - Name of the port 
 * @property {string} state - State the port is located in
 * @property {string} port_code - Unique code for the port
 * @property {string} border - Border the port is located on 
 * @property {string} date - Date of the data point
 * @property {string} measure - The measurement being captured (ex: Personal Vehicles)
 * @property {string} value - The value of the measurement
 * @property {number} latitude - Latitude coordinate of the port
 * @property {number} longitude - Longitude coordinate of the port
 * @property {Object} point - GeoJSON Point object
 * @property {string} point.type - Set to "Point"  
 * @property {number[]} point.coordinates - [longitude, latitude] coordinates
*/




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
      ca: fs.readFileSync("./ca.pem"),
    }, // how long a client is allowed to remain idle before being closed
  };
  const pool = new Pool(config);
  try {
    const res = await pool.query(q);
    pool.end();
    return res.rows;
  } catch (err) {
    console.log('Something"s gone wrong');
    throw err;
  }
}

const scrapeBTS = async () => {
  const PORTS = {
    // "San Ysidro": [250401],
    // "Otay Mesa": [250601],
    // Calexico: [250301],
    // Andrade: [250201],
    // Tecate: [250501],
    "Calexico": [250302],
  };
  const MEASURES = ["Personal Vehicles", "Buses", "Trains",  "Personal Vehicle Passengers",
  "Train Passengers",
  "Bus Passengers","Pedestrians", "Trucks"];

  for (const [PORT, PORT_CODE] of Object.entries(PORTS)) {
    console.log("THIS IS PORT");
    console.log(PORT);
    
    
    for (const MEASURE of MEASURES) {

      console.log("THIS IS MEASURE");
      console.log(MEASURE);

      // first we need to find the latest time that this port & this measure was recorded in the DB

      const LATEST_INSERTED_PORT_DATE_QUERY =  `SELECT date from btsnums

      WHERE port_name = '${PORT}'
      AND measure = '${MEASURE}'
      ORDER BY date DESC
      LIMIT 1;
      
      `;


      console.log("THIS IS LATEST_INSERTED_PORT_DATE_QUERY");
      console.log(LATEST_INSERTED_PORT_DATE_QUERY);
/**
 * Array of objects containing date properties.
 * @typedef {Object[]} DateObjects
 * 
 * @property {string} date - An ISO 8601 date string 
 */

/** 
 * @type {DateObjects}
*/
      const LATEST_INSERTED_PORT = (await query(LATEST_INSERTED_PORT_DATE_QUERY));

      console.log("THIS IS LATEST_INSERTED_PORT");
      console.log(LATEST_INSERTED_PORT);


      const LATEST_INSERTED_PORT_DATE = new Date(LATEST_INSERTED_PORT[0].date);



     // next we need to find the latest time that this port and measure was recorded in the BTS system
     /** @type {(BorderCrossingData | null)} */
    const LATEST_UPDATED_PORT_BTS = (await findLatestBTS(PORT, MEASURE));

    

    if (LATEST_UPDATED_PORT_BTS !== null) {

      // lets fix any discrepancy between the postgres data and the bts data

      const BTS_ISO_DATE = LATEST_UPDATED_PORT_BTS[0].date;

      const BTS_DATE = DateTime.fromISO(BTS_ISO_DATE);


      const DB_DATE = DateTime.fromJSDate(LATEST_INSERTED_PORT_DATE);

      

      console.log(DB_DATE.toString());

      // while the bts date is greater than the db date, let's insert rows into the db 

      let currentBtsDate = BTS_DATE;

      console.log("HELIJRElkjasLJASL KASJD LKJ LKSAJDLKASJDBHSHHSH");
      console.log(currentBtsDate.toString());

      while (currentBtsDate > DB_DATE){

        const BTS_QUERY =  `https://data.bts.gov/id/keg4-3bc2.json?$limit=100000&$where=date between 
        '${currentBtsDate.year}-${('0' + currentBtsDate.month).slice(-2)}-01T00:00:00.000' 
        and 
        '${currentBtsDate.year}-${('0' + currentBtsDate.month).slice(-2)}-01T00:00:00.000' 
    
         &border=US-Mexico%20Border&measure=${MEASURE}&port_name=${PORT}`
    
        console.log("THIS IS THE BTS QUERY");

        console.log(BTS_QUERY);
    
    
         
    
    
    /** @type {BorderCrossingData} */
        const BTS_DATA_ARRAY = (await (await fetch(BTS_QUERY)).json());

        /**
         * There won't be anything more than 1 element because we're always getting a singular port and measure
         */
        const BTS_DATA = BTS_DATA_ARRAY[0]
        console.log("THIS IS BTS DATA");
        console.log(BTS_DATA);

        if (BTS_DATA === undefined) {
          currentBtsDate = currentBtsDate.minus({ months: 1 });
        }
        else {

          // let portName = BTS_DATA.port_name
          // // to keep consistency, we want to maintain port name in the db being calexico west, even though on the bts its called calexico
          // if (portName == "Calexico") {
          //   portName = "Calexico West"
          // }
          const INSERT_QUERY = `
          INSERT INTO btsnums(port_name, port_code, measure, value, date)
          VALUES (${BTS_DATA.port_name}, ${BTS_DATA.port_code}, ${BTS_DATA.measure}, ${BTS_DATA.value}, TO_TIMESTAMP('${currentBtsDate.year}, ${('0' + currentBtsDate.month).slice(-2)}, 01', 'YYYY-MM-DD'))`;
          console.log(INSERT_QUERY);
          currentBtsDate = currentBtsDate.minus({ months: 1 });

          console.log(currentBtsDate.toString());
          console.log(DB_DATE.toString());
        }


      }
    }




    }
   

  }
  
  
}
/**
 * 
 * @param {string} port 
 * @param {string} measure 
 */
const findLatestBTS = async (port, measure) => {

  // let's set it to now 
  let lastUpdatedBTSDate = DateTime.now();
  const LAST_KNOWN_UPDATE = DateTime.fromObject({ year: 2022, month: 1 });
  
  

  

  // because BTS data is updated "every" month, let's loop down from our current month to the last known updated month for everything, until we find something
  while (lastUpdatedBTSDate > LAST_KNOWN_UPDATE){



    const BTS_QUERY =  `https://data.bts.gov/id/keg4-3bc2.json?$limit=100000&$where=date between 
    '${lastUpdatedBTSDate.year}-${('0' + lastUpdatedBTSDate.month).slice(-2)}-01T00:00:00.000' 
    and 
    '${lastUpdatedBTSDate.year}-${('0' + lastUpdatedBTSDate.month).slice(-2)}-01T00:00:00.000' 

     &border=US-Mexico%20Border&measure=${measure}&port_name=${port}`




     


/** @type {BorderCrossingData} */
    const BTS_DATA = await (await fetch(BTS_QUERY)).json();


    // if the data exists for this measure and port
    if (BTS_DATA.length >= 1) {
      
      return BTS_DATA;
      
    }
    else {
      // else, lower the date by a month and the while loop will try again
      lastUpdatedBTSDate = lastUpdatedBTSDate.minus({ months: 1 });
    }
    
  }

  return null;

}


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
  async tradeScrape() {
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
    const ports = ['Calexico', 'Otay Mesa', 'Andrade', 'Calexico West', 'Tecate'];
    if (startDate.toJSDate() < lastTrade.toJSDate()) {
      console.log(ports);
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
};

const removeAndReAddPort = async (port) => {
  let lastDate = DateTime.fromFormat('2016/01/01', 'yyyy/MM/dd');
  const MEASURES = ["Personal Vehicles", "Personal Vehicle Passengers", "Pedestrians", "Bus Passengers"];

  /**
   * 
   * , "Buses", "Trains",  "Personal Vehicle Passengers",
  "Train Passengers",
  "Bus Passengers","Pedestrians", "Trucks"
   */
  while (lastDate < DateTime.now()) {
    for (const MEASURE of MEASURES) {
    
    
      const BTS_QUERY  = `https://data.bts.gov/id/keg4-3bc2.json?$limit=100000&$where=date between 
      '${lastDate.year}-${('0' + lastDate.month).slice(-2)}-01T00:00:00.000' 
      and 
      '${lastDate.year}-${('0' + lastDate.month).slice(-2)}-01T00:00:00.000' 
  
       &border=US-Mexico%20Border&measure=${MEASURE}&port_name=${port}`;
  
       
      
       const BTS_DATA = (await (await fetch(BTS_QUERY)).json())[0];
       console.log(`MEASURE: ${MEASURE}`);
       console.log(`MONTH: ${lastDate.monthLong} YEAR: ${lastDate.year} \n`);

       if (BTS_DATA !== undefined) {
        // console.log("VALUE: ");
        // console.log(BTS_DATA.value);
        // console.log(`MEASURE: ${BTS_DATA.measure}`);
       }
       else {
        console.log(`UNDEFINED. MONTH: ${lastDate.monthLong} YEAR: ${lastDate.year} `);
        // console.log(BTS_DATA);
       }


       if (BTS_DATA !== undefined) {
  
        const INSERT_QUERY = `
        INSERT INTO btsnums(port_name, port_code, measure, value, date)
        VALUES (${BTS_DATA.port_name}, ${BTS_DATA.port_code}, ${BTS_DATA.measure}, ${BTS_DATA.value}, TO_TIMESTAMP('${lastDate.year}, ${('0' + lastDate.month).slice(-2)}, 01', 'YYYY-MM-DD'))`;
        // console.log(INSERT_QUERY);
       }
       
  
  
  
  
       lastDate = lastDate.plus({months: 1});
  
  
       
    }
  }



}
removeAndReAddPort("Calexico")
// const scraper = new Scraper();
// scraper.btsScrape();

// scrapeBTS();
// scraper.tradeScrape();
