const ZKLib = require('node-zklib');
async function sync() {
    const zkInstance = new ZKLib('192.168.192.200', 4370, 10000, 4000);
    try {
        await zkInstance.createSocket();
        const logs = await zkInstance.getAttendance();
        console.log("--- DEVICE DATA ---");
        console.table(logs.slice(0, 10));
        process.stdout.write(JSON.stringify(logs));
        await zkInstance.disconnect();
    } catch (e) { console.error(e); }
}
sync();
