import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.biobridge.prohr', 'Databases', 'biobridge_pro.db');
const db = new sqlite3.Database(dbPath);

async function seed() {
    const masterHash = bcrypt.hashSync('masterpassword', 10);
    const clientHash = bcrypt.hashSync('clientpassword', 10);

    db.serialize(() => {
        db.run(`
            INSERT INTO Users (username, password_hash, role, branch_id, organization_id, is_active, must_change_password)
            VALUES (?, ?, 'SUPER_ADMIN', NULL, 1, 1, 0)
            ON CONFLICT(username) DO UPDATE SET
            password_hash = excluded.password_hash,
            role = excluded.role,
            organization_id = excluded.organization_id,
            is_active = excluded.is_active,
            must_change_password = excluded.must_change_password
        `, ['master_admin', masterHash], (err) => {
            if (err) console.error("Error inserting master_admin:", err);
            else console.log("master_admin seeded successfully!");
        });

        db.run(`
            INSERT INTO Users (username, password_hash, role, branch_id, organization_id, is_active, must_change_password)
            VALUES (?, ?, 'ORG_SUPERADMIN', 1, 1, 1, 0)
            ON CONFLICT(username) DO UPDATE SET
            password_hash = excluded.password_hash,
            role = excluded.role,
            branch_id = excluded.branch_id,
            organization_id = excluded.organization_id,
            is_active = excluded.is_active,
            must_change_password = excluded.must_change_password
        `, ['client_hr', clientHash], (err) => {
            if (err) console.error("Error inserting client_hr:", err);
            else console.log("client_hr seeded successfully!");
        });
    });
}

seed();
