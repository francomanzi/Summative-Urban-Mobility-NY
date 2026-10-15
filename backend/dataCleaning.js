import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const MAX_TRIPS = Number(process.env.MAX_TRIPS) || 200000;

function findRawFiles() {
  const allFiles = fs.readdirSync('data');
  return {
    tripFile: allFiles.find(f => f.startsWith('yellow_tripdata') && f.endsWith('.parquet')),
    lookupFile: allFiles.find(f => f.startsWith('taxi_zone_lookup') && f.endsWith('.csv')),
    zonesFile: allFiles.find(f => f.startsWith('taxi_zones') && /\.(geo)?json$/.test(f)),
  };
}


function buildZones(lookupFile, zonesFile) {
  const lookupRows = parse(fs.readFileSync('data/' + lookupFile, 'utf8'), { columns: true, skip_empty_lines: true });
  const boroughs = [];
  const boroughIds = {};
  const zones = [];                    
  const validZones = new Set();        

  for (const row of lookupRows) {
    const boroughName = row.Borough || 'Unknown';

    if (boroughName === 'N/A' || boroughName === 'Unknown') continue;
    if (!boroughIds[boroughName]) {
      boroughIds[boroughName] = boroughs.length + 1;
      boroughs.push([boroughIds[boroughName], boroughName]);
    }
    zones.push([Number(row.LocationID), row.Zone || 'Unknown', row.service_zone, boroughIds[boroughName], null, null]);
    validZones.add(Number(row.LocationID));
  }


  const geo = JSON.parse(fs.readFileSync('data/' + zonesFile, 'utf8'));
  for (const feature of geo.features) {
    let ring = feature.geometry.coordinates[0];
    if (feature.geometry.type === 'MultiPolygon') ring = ring[0];
    let sumX = 0, sumY = 0;
    for (const point of ring) { sumX += point[0]; sumY += point[1]; }
    const zoneId = Number(feature.properties.LocationID ?? feature.properties.location_id);
    const zone = zones.find(z => z[0] === zoneId);
    if (zone) { zone[4] = sumX / ring.length; zone[5] = sumY / ring.length; }
  }
  return { boroughs, zones, validZones };
}

function buildCodeTables() {
  const payments = { 0: 'Flex fare', 1: 'Credit card', 2: 'Cash', 3: 'No charge', 4: 'Dispute', 5: 'Unknown' };
  const rates = { 1: 'Standard', 2: 'JFK', 3: 'Newark', 4: 'Nassau/Westchester', 5: 'Negotiated', 6: 'Group ride', 99: 'Unknown' };
  return {
    payments, rates,                                                    // maps, used when filling missing codes
    paymentTypes: Object.entries(payments).map(([id, name]) => [Number(id), name]),
    rateCodes: Object.entries(rates).map(([id, name]) => [Number(id), name]),
  };
}

function csv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}


export async function cleanData() {
  const { tripFile, lookupFile, zonesFile } = findRawFiles();
  if (!tripFile || !lookupFile || !zonesFile) {
    throw new Error('Missing files in data/. You need the yellow_tripdata parquet, taxi_zone_lookup.csv and the taxi_zones geojson.');
  }

  const { boroughs, zones, validZones } = buildZones(lookupFile, zonesFile);
  const { payments, rates, paymentTypes, rateCodes } = buildCodeTables();

  console.log('Reading ' + tripFile + ' ...');
  const allTrips = await parquetReadObjects({
    file: await asyncBufferFromFile('data/' + tripFile),
    compressors,
  });


  const step = Math.max(1, Math.ceil(allTrips.length / MAX_TRIPS));
  const rawTrips = [];
  for (let i = 0; i < allTrips.length; i += step) rawTrips.push(allTrips[i]);

  // The month most trips belong to, trips from other months are wrong dates.
  const monthCounts = {};
  for (const trip of rawTrips) {
    if (!trip.tpep_pickup_datetime) continue;
    const month = trip.tpep_pickup_datetime.toISOString().slice(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }
  let mainMonth = '';
  for (const month in monthCounts) {
    if (mainMonth === '' || monthCounts[month] > monthCounts[mainMonth]) mainMonth = month;
  }

  const goodTrips = [];
  const excluded = [];            //  log of removed trips
  const reasonCounts = {};
  const seen = new Set();         //  finding duplicates

  function exclude(trip, reason) {
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    excluded.push([csv(reason), csv(trip.tpep_pickup_datetime?.toISOString()), csv(trip.trip_distance), csv(trip.fare_amount)].join(','));
  }

  for (const trip of rawTrips) {
    const pickup = trip.tpep_pickup_datetime;
    const dropoff = trip.tpep_dropoff_datetime;
    const distance = Number(trip.trip_distance);
    const fare = Number(trip.fare_amount);
    const tip = Number(trip.tip_amount) || 0;
    const total = Number(trip.total_amount);
    const puZone = Number(trip.PULocationID);
    const doZone = Number(trip.DOLocationID);

    // missing values
    if (!pickup || !dropoff) { exclude(trip, 'missing time'); continue; }
    if (!validZones.has(puZone) || !validZones.has(doZone)) { exclude(trip, 'unknown pickup/dropoff zone'); continue; }
    if (trip.trip_distance == null || trip.fare_amount == null || trip.total_amount == null) { exclude(trip, 'missing distance or fare'); continue; }

    // time problems
    if (pickup.toISOString().slice(0, 7) !== mainMonth) { exclude(trip, 'pickup outside main month'); continue; }
    if (dropoff.toISOString().slice(0, 7) !== mainMonth) { exclude(trip, 'dropoff outside main month'); continue; }
    const minutes = (dropoff - pickup) / 60000;
    if (minutes <= 1 || minutes > 240) { exclude(trip, 'bad trip duration'); continue; }

    // bad values
    if (distance <= 0 || distance > 100) { exclude(trip, 'bad distance'); continue; }
    if (fare <= 0 || fare > 500) { exclude(trip, 'bad fare'); continue; }
    if (tip < 0) { exclude(trip, 'negative tip'); continue; }
    if (tip > fare) { exclude(trip, 'tip over 100% of fare'); continue; }   // a tip bigger than the fare 
    const speed = distance / (minutes / 60);
    if (speed > 80) { exclude(trip, 'speed over 80 mph'); continue; }
    const passengers = Number(trip.passenger_count) || 1;   
    if (passengers > 6) { exclude(trip, 'too many passengers'); continue; }

    // duplicates
    const key = [pickup.getTime(), dropoff.getTime(), puZone, doZone, distance, total].join('|');
    if (seen.has(key)) { exclude(trip, 'duplicate'); continue; }
    seen.add(key);

    const rateCode = rates[trip.RatecodeID] ? Number(trip.RatecodeID) : 99;
    const paymentType = payments[trip.payment_type] ? Number(trip.payment_type) : 5;

    const tipPercent = paymentType === 1 ? (tip / fare) * 100 : null;

    goodTrips.push([
      pickup.toISOString().slice(0, 19).replace('T', ' '),
      dropoff.toISOString().slice(0, 19).replace('T', ' '),
      puZone, doZone, passengers, distance, rateCode, paymentType, fare, tip, total,
      pickup.getUTCHours(), minutes, speed, fare / distance, tipPercent,
    ]);
  }

  return {
    boroughs, zones, paymentTypes, rateCodes,
    trips: goodTrips,
    excludedCsv: 'reason,pickup_time,trip_distance,fare_amount\n' + excluded.join('\n'),
    reasonCounts, mainMonth,
    rawCount: rawTrips.length, excludedCount: excluded.length, keptCount: goodTrips.length,
  };
}
