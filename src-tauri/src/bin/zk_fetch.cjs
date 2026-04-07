const ZKLib = require('node-zklib');

async function fetchZKData() {
    if (process.argv.length < 4) {
        console.error("Usage: node zk_fetch.js <ip> <port> [timeout]");
        process.exit(1);
    }

    const ip = process.argv[2];
    const port = parseInt(process.argv[3], 10);
    const timeout = process.argv.length > 4 ? parseInt(process.argv[4], 10) : 5000;

    let zkInstance = new ZKLib(ip, port, timeout, 4000);
    try {
        await zkInstance.createSocket();
    } catch (err) {
        console.error("Connection Failed:", err.message);
        process.exit(1);
    }

    try {
        let users = await zkInstance.getUsers();
        let attendances = await zkInstance.getAttendances();

        // Print final JSON payload cleanly to STDOUT so Rust can parse it
        console.log(JSON.stringify({ 
            status: "success", 
            users: users.data || [], 
            attendances: attendances.data || [] 
        }));
        
        await zkInstance.disconnect();
    } catch (e) {
        console.error("Failed to fetch data:", e.message);
        await zkInstance.disconnect();
        process.exit(1);
    }
}

fetchZKData();
