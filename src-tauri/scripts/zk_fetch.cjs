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
        } else if (command === 'getUserCount') {
            const usersResult = await zkInstance.getUsers();
            // node-zklib returns { data: [...] } — unwrap the array
            const users = Array.isArray(usersResult) ? usersResult : (usersResult?.data || []);
            const maxId = users.reduce((max, u) => {
                const uid = parseInt(u.userId) || 0;
                return uid > max ? uid : max;
            }, 0);
            const nextId = maxId + 1;
            
            process.stdout.write(JSON.stringify({
                status: 'success',
                total: users.length,
                maxUserId: maxId,
                nextAvailableId: nextId,
                users: users.map(u => ({
                    userId: u.userId,
                    name: u.name || '',
                    role: u.role || 0
                }))
            }));
            await zkInstance.disconnect();
        } else if (command === 'enroll') {
            const userId = parseInt(process.argv[6]) || 0;
            const name = (process.argv[7] || '').trim();
            const role = parseInt(process.argv[8]) || 0;
            const cardNo = (process.argv[9] || '').trim();
            
            if (!userId || !name) {
                process.stderr.write(JSON.stringify({
                    status: 'error',
                    message: `Invalid params: userId=${userId}, name="${name}"`
                }));
                process.exit(1);
            }

            // Step 1: Create/update user on device (setUser returns bool)
            try {
                const result = await zkInstance.setUser(userId, userId, name, '', role, cardNo);
                if (!result) {
                    process.stderr.write(JSON.stringify({
                        status: 'error',
                        message: `setUser returned false — device rejected user ${userId} (${name}). Check if device supports remote user management.`
                    }));
                    process.exit(1);
                }
            } catch (setErr) {
                process.stderr.write(JSON.stringify({
                    status: 'error',
                    message: `setUser failed: ${setErr.message}`
                }));
                process.exit(1);
            }
            
            // Step 2: Return success — user must physically enroll finger on device
            process.stdout.write(JSON.stringify({
                status: 'success',
                message: `User ${userId} (${name}) set on device. Go to device and enroll fingerprint.`,
                userId: userId,
                name: name
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
