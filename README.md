
# Crossing Times Scraper 🧰




## Appendix

Google Maps \
CBP



## Google Maps Reference

#### Coordinates used

```
  Origin: 32.529299,-117.023699
  Destination: 32.552180,-117.0442166
```


## CBP Reference

#### Port used

```
    San Ysidro - Port ID: 250401
```

## Deploying 🚀
``` bash
docker build -t crossing-time-scrapers --platform=linux/amd64 .
docker tag crossing-time-scrapers gcr.io/ssp-all-sites/crossing-time-scrapers
docker push gcr.io/ssp-all-sites/crossing-time-scrapers
```
