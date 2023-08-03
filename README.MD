## Crossing Time Scraper 🧰

To run this project, you will need to add the following environment variables to your .env file

`SECRET_PASS`
`SECRET_USER`
`SECRET_HOST` 
`SECRET_DATABASE`
`SECRET_PORT`


## Deployment :rocket:

To deploy this project run 

```bash
  npm i  
  node collect_all.js
```


## Installation 🛠

Install Border Dashboard with GitHub

```bash
  git clone 'https://github.com/sethmorton/CrossingTimeScrapers.git'
  cd CrossingTimeScrapers
```
## Deploying 🛠

Deploy Border Dashboard to GCR

```bash
docker build -t crossing-time-scrapers --platform=linux/amd64 .
docker tag crossing-time-scrapers gcr.io/ssp-all-sites/crossing-time-scrapers
docker push gcr.io/ssp-all-sites/crossing-time-scrapers
```


## Conventions 📝

Naming conventions based off [Javascript Naming Conventions](https://github.com/ktaranov/naming-convention/blob/master/JavaScript%20Name%20and%20Coding%20Conventions.md)

## Author ✍️
Seth