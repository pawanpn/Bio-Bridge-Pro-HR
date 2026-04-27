import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.biobridge.prohr', 'Databases', 'biobridge_pro.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Check if default org exists
    db.get("SELECT id, name FROM Organizations WHERE id = 1", (err, row) => {
        if (err) {
            console.error("Error checking org:", err);
            return;
        }

        if (!row) {
            // Create default org
            db.run(`
                INSERT INTO Organizations (id, name, address, provider_approved, payment_status, license_expiry)
                VALUES (1, 'Default Organization', 'Kathmandu, Nepal', 1, 'Paid', '2030-12-31')
            `, (err) => {
                if (err) console.error("Error creating org:", err);
                else console.log("Default Organization created and approved!");
            });
        } else {
            // Update existing org to be approved and active
            db.run(`
                UPDATE Organizations 
                SET provider_approved = 1,
                    payment_status = 'Paid',
                    license_expiry = '2030-12-31'
                WHERE id = 1
            `, (err) => {
                if (err) console.error("Error updating org:", err);
                else console.log(`Organization '${row.name}' approved and license set to 2030!`);
            });
        }
    });

    // Also verify users exist
    db.all("SELECT id, username, role, is_active FROM Users", (err, rows) => {
        if (err) console.error("Error fetching users:", err);
        else {
            console.log("\nCurrent Users in DB:");
            rows.forEach(r => console.log(`  - ${r.username} | role: ${r.role} | active: ${r.is_active}`));
        }
    });
});
