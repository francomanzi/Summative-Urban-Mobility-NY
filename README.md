# New York City Taxi analytics

Full stack app for thhe. Urban Mobolity Analytics Web App that cleans thhe NYC yellow ttaxi data, stores it in SQLiite, serves itt with a Node.js API and shows it in a dashboard.

## Team name
Metrix

## Authors
 UMUTESI Peace Maureen
 Divin MANZI Franco

 ## AI Usage

We used AI as a development assistant, itt helped us running tests, debugging and finding issues like how we have to use 'vaccum' so that our database keep data for every run. AI also helped inline completion. it also helped us review against the gaps that we had throughout the codes and also made it easy for. collaboration with the frontend builder once they completed their part.

 ## Project description

This project analyzes New York City yellow taxi trip data to uncover urban mobility patterns across the cities and zones. It cleans and filters raw trip records, stores the processed data in a database, and serves it through an API to an interactive dashboard. The dashboard lets users explore key metrics such as trip counts, average fares, speeds, and top pickup zones with filters by borough, date, and distance. It was built using Node.js, Express, SQLite, and JavaScript.

## System Archittecture

```
data/        raw files go here + excluded_log.csv is created here
backend/     server.js (API), rankZones.js (our own merge sort),
             dataCleaning.js (reads + cleans the raw files),
             dataIntegration.js (builds the normalized database), schema.sql,
             the SQLite file (created by the script)
frontend/    index.html, style.css, dashboard.js

ERD.svg / ERD.drawio        database diagram (editable draw.io copy)
SystemArchitecture.drawio   how the frontend, backend and data files connect
```
## How to run
1. Clone the repository.
git clone [text](https://github.com/francomanzi/Summative-Urban-Mobility-NY.git)

2. install packages
```
   npm install
   ```

3. Download the 3 TLC files and put them in `data/`
- the yellow trip data `.parquet` file — e.g.
     https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2023-01.parquet
     (name must start with `yellow_tripdata`)
   - `taxi_zone_lookup.csv` — https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv
   - the taxi zones GeoJSON with the polygon boundaries for each Zone ID
     (name must start with `taxi_zones`, ending in `.geojson` or `.json`). Use the file from
     the assignment, or convert the TLC `taxi_zones.zip` shapefile. The coordinates must be
     **longitude/latitude (WGS84)** — the TLC shapefile is in State Plane feet and needs
     converting first.

4. Clean the data and build database

```
   npm run clean
   ```
5. Start both the frontend and backend

 ```
   npm start
   ```
6. Open http://localhost:3000

## Derived features

- `trip_minutes` = dropoff time - pickup time
- `speed_mph` = distance / hours (shows traffic by hour of day)
- `fare_per_mile` = fare / distance (shows how expensive short trips are)
- `tip_percent` = tip / fare x 100, card payments only (cash tips are not recorded)
- `pickup_hour` = hour of the pickup time

## Database (ERD)

The database is normalized into five tables (defined in `backend/schema.sql` and
built by `npm run clean`):

| Table | What it holds | Relations |
|---|---|---|
| `boroughs` | the five cities | parent of `zones` |
| `zones` | TLC taxi zones + centre point | belongs to one `boroughs` |
| `payment_types` | payment method names | used by `trips` |
| `rate_codes` | rate code names | used by `trips` |
| `trips` | one row per trip + derived features | two `zones`, one `rate_codes`, one `payment_types` |

Diagram (1 to many = `─<`):

## Custom algorithm

`backend/rankZones.js` it sorts the busiest pickup zones with a merge sort algorithm. Pseudo code and complexity (0(n log n) time,0(n)space).

## API

| Route | What it returns |
|---|---|
| `/api/boroughs` | list of cities |
| `/api/summary` | totals, averages and fare per mile for short vs long trips |
| `/api/trips-by-hour` | trips and average speed for each hour |
| `/api/top-zones` | top 10 pickup zones |
| `/api/trips` | table rows (15 per page, `sortBy`, `order`, `page`) |

All routes accept the filters `borough`, `from`/`to` (pickup day, `YYYY-MM-DD`),
`minDistance`, `maxDistance`, `minFare`, `maxFare`.