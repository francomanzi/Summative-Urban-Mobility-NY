// Express API for the dashboard.
import Database from 'better-sqlite3';
import { rankZones } from './rankZones.js';

const db = new Database('backend/urban_mobility.db', { readonly: true });

db.pragma('foreign_keys = ON');
const app = express();
app.use(express.static('frontend'));

const FROM = `FROM trips t
  JOIN zones z ON t.pu_zone_id = z.zone_id
  JOIN boroughs b ON z.borough_id = b.borough_id`;

  //turning filters into SQL WHERE clauses

  function makeWhere(query) {
  const conditions = [];
  const values = [];
  if (query.borough) {
    conditions.push('b.borough_name = ?');
    values.push(query.borough);
  }
  
  //pickup time range
   if (/^\d{4}-\d{2}-\d{2}$/.test(query.from || '')) { conditions.push('t.pickup_time >= ?'); values.push(query.from + ' 00:00:00'); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.to || ''))   { conditions.push('t.pickup_time <= ?'); values.push(query.to + ' 23:59:59'); }

  // distance and fare ranges, a value that is not a number is ignored
  const ranges = [['minDistance', 'trip_distance', '>='], ['maxDistance', 'trip_distance', '<='],
                  ['minFare', 'fare_amount', '>='], ['maxFare', 'fare_amount', '<=']];
  for (const [param, column, operator] of ranges) {
    const value = Number(query[param]);
    if (query[param] !== undefined && query[param] !== '' && Number.isFinite(value)) {
      conditions.push(`t.${column} ${operator} ?`);
      values.push(value);
    }
}
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    return { where, values };
  }
    app.get('/api/boroughs', (req, res) => {
        res.json(db.prepare(' SELECT borough_name FROM boroughs').all());
    });

    app.get('/api/summary', (req, res) => {
        const { where, values } = makeWhere(req.query);

    const row = db.prepare(`SELECT COUNT(*) AS trips, AVG(t.trip_distance) AS avg_distance,
    AVG(t.fare_amount) AS avg_fare, AVG(t.speed_mph) AS avg_speed, AVG(t.tip_percent) AS avg_tip_percent,
    AVG(CASE WHEN t.trip_distance <= 2 THEN t.fare_per_mile END) AS short_fare_per_mile,
    AVG(CASE WHEN t.trip_distance > 2 THEN t.fare_per_mile END) AS long_fare_per_mile
    ${FROM} ${where}`).get(...values);
  res.json(row);
});

app.get('/api/trips-by-hour', (req, res) => {
  const { where, values } = makeWhere(req.query);
  const rows = db.prepare(`SELECT t.pickup_hour AS hour, COUNT(*) AS trips, AVG(t.speed_mph) AS avg_speed
    ${FROM} ${where} GROUP BY t.pickup_hour ORDER BY t.pickup_hour`).all(...values);
  res.json(rows);
});

app.get('/api/top-zones', (req, res) => {
  const { where, values } = makeWhere(req.query);
  const zones = db.prepare(`SELECT z.zone_name AS name, COUNT(*) AS trips
    ${FROM} ${where} GROUP BY z.zone_id`).all(...values);
  res.json(rankZones(zones, 10));   // ranked with our own merge sort
});

app.get('/api/trips', (req, res) => {
  const { where, values } = makeWhere(req.query);
   const sortColumns = ['pickup_time', 'trip_distance', 'fare_amount', 'trip_minutes', 'tip_percent'];
  const sortBy = sortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'pickup_time';
  const direction = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, Number(req.query.page) || 1);

  const rows = db.prepare(`SELECT t.pickup_time, z.zone_name AS pickup_zone, d.zone_name AS dropoff_zone,
    t.trip_distance, t.trip_minutes, t.fare_amount, t.tip_percent
    ${FROM} JOIN zones d ON t.do_zone_id = d.zone_id
    ${where} ORDER BY t.${sortBy} ${direction} LIMIT 15 OFFSET ?`).all(...values, (page - 1) * 15);
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
