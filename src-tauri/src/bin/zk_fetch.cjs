const ZKLib = require('node-zklib');

async function main() {
    const action = process.argv[2];
    const ip = process.argv[3];
    const port = parseInt(process.argv[4] || '4370');
    const timeout = parseInt(process.argv[5] || '10000');

    if (!ip || !action) {
        console.error("Action and IP Address required.");
        process.exit(1);
    }

    const zkInstance = new ZKLib(ip, port, timeout, 4000);

    try {
        await zkInstance.createSocket();

        if (action === "test") {
            try {
                const info = await zkInstance.getInfo();
                console.log(JSON.stringify({ status: "success", info: info }));
            } catch (e) {
                console.log(JSON.stringify({ status: "success", info: "connected without details" }));
            }
            await zkInstance.disconnect();
            process.exit(0);
        }

        if (action === "realtime") {
            // Keep running and listening for realtime punches
            zkInstance.getRealTimeLogs((data) => {
                // data format depends on ZKLib, commonly { userId, attTime ...}
                console.log(JSON.stringify({
                    type: 'punch',
                    data: data
                }));
            });
            // Do not disconnect! Let the process run.
            return;
        }

        if (action === "unlock") {
            // Unlocks the physical door
            await zkInstance.executeCmd(9, ''); 
            console.log(JSON.stringify({ status: "unlocked" }));
            await zkInstance.disconnect();
            process.exit(0);
        }

        if (action === "clear") {
            await zkInstance.clearAttendanceLog();
            console.log(JSON.stringify({ status: "cleared" }));
            await zkInstance.disconnect();
            process.exit(0);
        }

        if (action === "sync") {
            let users = [];
            let attendances = [];

            try {
                const usersData = await zkInstance.getUsers();
                if (usersData && usersData.data) {
                    users = usersData.data.map(u => ({
                        userId: String(u.uid || u.userId || u.employeeNo || ''),
                        name: u.name || ''
                    }));
                }
            } catch (e) {
                console.error("Error fetching users:", e.message);
            }

            try {
                const attData = await zkInstance.getAttendances();
                if (attData && attData.data) {
                    attendances = attData.data.map(a => ({
                        deviceUserId: String(a.deviceUserId || a.uid || ''),
                        recordTime: String(a.recordTime || '')
                    }));
                }
            } catch (e) {
                console.error("Error fetching attendances:", e.message);
            }

            console.log(JSON.stringify({
                status: "success",
                users: users,
                attendances: attendances
            }));
            
            await zkInstance.disconnect();
            process.exit(0);
        }

        console.error("Unknown action");
        process.exit(1);

    } catch (error) {
        console.error(error.message || String(error));
        process.exit(1);
    }
}

main();
