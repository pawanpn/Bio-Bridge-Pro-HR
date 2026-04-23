const ZKLib = require('node-zklib');

async function main() {
    const command = process.argv[2] || 'sync';
    const ip = process.argv[3] || '192.168.1.201';
    const port = parseInt(process.argv[4]) || 4370;
    const timeout = parseInt(process.argv[5]) || 10000;

    const zkInstance = new ZKLib(ip, port, timeout, 4000);

    try {
        await zkInstance.createSocket();
        
        if (command === 'sync') {
            const logs = await zkInstance.getAttendances();
            const users = await zkInstance.getUsers();
            
            // Output as single JSON bundle for the Rust side to parse
            process.stdout.write(JSON.stringify({
                status: 'success',
                attendances: logs,
                users: users
            }));
            await zkInstance.disconnect();
        } else if (command === 'realtime') {
            // Setup realtime events
            zkInstance.getRealTimeLogs((data) => {
                const event = {
                    type: 'punch',
                    data: data
                };
                process.stdout.write(JSON.stringify(event) + '\n');
            });
            
            // Keep process alive
            process.stdin.resume();
        } else if (command === 'setUser') {
            const userId = process.argv[6] || '0';
            const name = process.argv[7] || '';
            const role = parseInt(process.argv[8]) || 0;
            const cardNo = process.argv[9] || '';
            
            // setUser(uid, userid, name, password, role, cardno)
            // uid is usually same as userId or record index, userid is the login id
            await zkInstance.setUser(userId, userId, name, '', role, cardNo);
            
            process.stdout.write(JSON.stringify({
                status: 'success',
                message: `User ${userId} (${name}) set successfully`
            }));
            await zkInstance.disconnect();
        } else if (command === 'getFingerprints') {
            const userId = process.argv[6] || '0';
            const fps = await zkInstance.getFingerprints();
            const userFps = fps.filter(f => f.userId === userId);
            
            process.stdout.write(JSON.stringify({
                status: 'success',
                data: userFps
            }));
            await zkInstance.disconnect();
        }

    } catch (e) {
        process.stderr.write(JSON.stringify({
            status: 'error',
            message: e.message
        }));
        try { await zkInstance.disconnect(); } catch(err){}
        process.exit(1);
    }
}

main();
