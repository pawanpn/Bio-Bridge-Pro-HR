const ZKLib = require('node-zklib');

// Suppress any debug/console.log from node-zklib internals
const origLog = console.log;
const origErr = console.error;
let captured = [];

// Temporarily redirect console.log so node-zklib debug messages don't corrupt stdout
console.log = (...args) => { captured.push(args.join(' ')); };

async function fetchZKData() {
    if (process.argv.length < 4) {
        origErr("Usage: node zk_fetch.cjs <ip> <port> [timeout]");
        process.exit(1);
    }

    const ip = process.argv[2];
    const port = parseInt(process.argv[3], 10);
    const timeout = process.argv.length > 4 ? parseInt(process.argv[4], 10) : 5000;

    let zkInstance = new ZKLib(ip, port, timeout, 4000);
    try {
        await zkInstance.createSocket();
    } catch (err) {
        console.log = origLog; // Restore
        origErr("Connection Failed:", err.message);
        process.exit(1);
    }

    try {
        let users = await zkInstance.getUsers();
        let attendances = await zkInstance.getAttendances();

        // Restore original console.log for our FINAL output
        console.log = origLog;
        
        // Print ONLY the clean JSON payload to STDOUT
        origLog(JSON.stringify({ 
            status: "success", 
            users: users.data || [], 
            attendances: attendances.data || [] 
        }));
        
        await zkInstance.disconnect();
    } catch (e) {
        console.log = origLog; // Restore
        origErr("Failed to fetch data:", e.message);
        await zkInstance.disconnect();
        process.exit(1);
    }
}

fetchZKData();
