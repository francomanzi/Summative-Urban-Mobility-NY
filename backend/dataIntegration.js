import fs from 'fs';
import Database from 'better-sqlite3';
import { cleanData } from './dataCleaning.js';

//Loading clean data into the database

function loadDatabase(cleaned){
    const db = new Database('backend/urban_mobility.db');
    db.pragma('foreign_keys = ON');
    db.exec(fs.readFileSync('backend/schema.sql', 'utf8'));

    const insertBorough = db.prepare('INSERT INTO boroughs VALUES (?, ?)');
    for (const row of cleaned.boroughs) insertBorough.run(row);

    const insertZone = db.prepare('INSERT INTO zones (zone_id, zone_name, service_zone, borough_id, center_lon, center_lat) VALUES (?, ?, ?, ?, ?, ?)');
    for (const row of cleaned.zones) insertZone.run(row);

    const insertPaymentType = db.prepare('INSERT INTO payment_types VALUES (?, ?)');
    for (const row of cleaned.paymentTypes) insertPaymentType.run(row);

    const insertRateCode = db.prepare('INSERT INTO rate_codes VALUES (?, ?)');
    for (const row of cleaned.rateCodes) insertRateCode.run(row);

    const insertTrip = db.prepare(`INSERT INTO trips (pickup_time, dropoff_time, pu_zone_id, do_zone_id,
    passenger_count, trip_distance, rate_code_id, payment_type_id, fare_amount, tip_amount, total_amount,
    pickup_hour, trip_minutes, speed_mph, fare_per_mile, tip_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const saveAll = db.transaction(rows => { for (const row of rows) insertTrip.run(row); });
     saveAll(cleaned.trips);

     //Dropping the table on each run
     db.exec('VACUUM');
     
     db.exec('ANALYZE');
     return db;
}

     const cleaned = await cleanData();
     const db = loadDatabase(cleaned);
     fs.writeFileSync('data/excluded_log.csv', cleaned.excludedCsv);

     const coverage = db.prepare('SELECT MIN(pickup_time) AS first, MAX(pickup_time) AS last FROM trips').get();
     console.log('Main month: ' + cleaned.mainMonth);
     console.log('Raw trips: ' + cleaned.rawCount + ', kept: ' + cleaned.keptCount + ', excluded: ' + cleaned.excludedCount);
console.log('Sample covers ' + coverage.first + ' to ' + coverage.last);
console.log('Reasons:', cleaned.reasonCounts);
console.log('Excluded trips saved in data/excluded_log.csv');

