const ZKLib = require('node-zklib');
async fn sync() {
    let zkInstance = new ZKLib('192.168.192.200', 4370, 10000, 4000);
    try {
        await zkInstance.createSocket();
        const logs = await zkInstance.getAttendance();
        console.log("--- TERMINAL DATA PREVIEW ---");
        console.table(logs.slice(0, 10)); // टर्मिनलमा डेटा देखाउने
        process.stdout.write(JSON.stringify(logs));
        await zkInstance.disconnect();
    } catch (e) {
        console.error("Connection Failed:", e);
    }
}
sync();
