--We dropped the table first so thhat cleaning script can be run many times
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS zones;
DROP TABLE IF EXISTS boroughs;
DROP TABLE IF EXISTS payment_types;
DROP TABLE IF EXISTS rate_codes;

CREATE TABLE boroughs (
    borough_id INTEGER PRIMARY KEY,
    borough_name TEXT NOT NULL UNIQUE
);

CREATE TABLE zones (
    zone_id INTEGER PRIMARY KEY,
    zone_name TEXT NOT NULL,
    service_zone TEXT,
    borough_id INTEGER NOT NULL REFERENCES boroughs(borough_id),
    center_lon REAL,  
    center_lat REAL
);



CREATE TABLE payment_types (
    payment_type_id INTEGER PRIMARY KEY,
    payment_name    TEXT NOT NULL
);

CREATE TABLE rate_codes (
    rate_code_id INTEGER PRIMARY KEY,
    rate_name    TEXT NOT NULL
);

CREATE TABLE trips (
    trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pickup_time TEXT NOT NULL,
    dropoff_time TEXT NOT NULL,
    pu_zone_id INTEGER NOT NULL REFERENCES zones(zone_id),
    do_zone_id INTEGER NOT NULL REFERENCES zones(zone_id),
    passenger_count INTEGER NOT NULL,
    trip_distance REAL NOT NULL,
    rate_code_id INTEGER NOT NULL REFERENCES rate_codes(rate_code_id),
    payment_type_id INTEGER NOT NULL REFERENCES payment_types(payment_type_id),
    fare_amount REAL NOT NULL,
    tip_amount REAL NOT NULL,
    total_amount REAL NOT NULL,
    pickup_hour INTEGER NOT NULL,
    trip_minutes REAL NOT NULL,
    speed_mph REAL NOT NULL,
    fare_per_mile REAL NOT NULL,
    tip_percent REAL --only for card payments
);




--Index for the dashboard queries
CREATE INDEX idx_trips_pickup_time ON trips(pickup_time); 
CREATE INDEX idx_trips_pickup_hour ON trips(pickup_hour);
CREATE INDEX idx_trips_pu_zone_id ON trips(pu_zone_id);
CREATE INDEX idx_trips_distance ON trips(trip_distance);
CREATE INDEX idx_trips_fare ON trips(fare_amount);