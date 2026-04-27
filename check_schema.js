import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.biobridge.prohr', 'Databases', 'biobridge_pro.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(Users);", (err, rows) => {
    if (err) console.error(err);
    else console.log("Columns:", rows);
});
