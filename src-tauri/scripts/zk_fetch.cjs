const ZKLib = require('node-zklib');

const CMD_DISABLEDEVICE = 1003;
const CMD_ENABLEDEVICE = 1002;
const CMD_USER_WRQ = 8;
const CMD_REFRESHDATA = 1013;
const CMD_USERTEMP_RRQ = 9;
const CMD_ACK_OK = 2000;
const CMD_ACK_ERROR = 2001;
const DISABLE_DEVICE_DATA = Buffer.from([0, 0, 0, 0]);

function buildUserEntry72(uid, userIdStr, name, password, roleByte, cardNo) {
  const buf = Buffer.alloc(72, 0);
  buf.writeUInt16LE(uid, 0);
  buf.writeUInt8(roleByte, 2);
  buf.write(password.slice(0, 8).padEnd(8, '\0'), 3, 8, 'ascii');
  buf.write(name.slice(0, 23).padEnd(24, '\0'), 11, 24, 'ascii');
  buf.writeUInt32LE(Math.max(0, parseInt(cardNo) || 0), 35);
  buf.writeUInt8(1, 39);
  buf.write(String(userIdStr).slice(0, 8).padEnd(9, '\0'), 48, 9, 'ascii');
  return buf;
}

function roleToByte(privilege) {
  switch (privilege) {
    case 0: return 0x00;  // Normal User: bits 3-1=000, bit0=0 enabled
    case 1: return 0x02;  // Registrar(Enroll): bits 3-1=001 → byte=0x02
    case 2: return 0x06;  // Admin: bits 3-1=011 → byte=0x06
    case 3: return 0x0E;  // Super Admin: bits 3-1=111 → byte=0x0E
    default: return 0x00;
  }
}

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

      process.stdout.write(JSON.stringify({
        status: 'success',
        attendances: logs,
        users: users
      }));
      await zkInstance.disconnect();

    } else if (command === 'realtime') {
      zkInstance.getRealTimeLogs((data) => {
        process.stdout.write(JSON.stringify({ type: 'punch', data: data }) + '\n');
      });
      process.stdin.resume();

    } else if (command === 'setUser') {
      const deviceUserId = process.argv[6] || '0';
      const name = process.argv[7] || '';
      const role = parseInt(process.argv[8]) || 0;
      const cardNo = process.argv[9] || '';

      const roleByte = roleToByte(role);

      // First read all users to find uid by userId
      const allUsers = await zkInstance.getUsers();
      let uid = null;

      if (allUsers && allUsers.data) {
        for (const u of allUsers.data) {
          if (String(u.userId) === String(deviceUserId)) {
            uid = u.uid;
            break;
          }
        }
      }

      // If user not found, find next available uid
      if (uid === null && allUsers && allUsers.data && allUsers.data.length > 0) {
        uid = Math.max(...allUsers.data.map(u => u.uid)) + 1;
      }
      if (uid === null) {
        uid = parseInt(deviceUserId) || 1;
      }

      // Build 72-byte user entry and set via raw protocol
      const entry = buildUserEntry72(uid, deviceUserId, name, '', roleByte, cardNo);

      await zkInstance.executeCmd(CMD_DISABLEDEVICE, DISABLE_DEVICE_DATA);
      const reply = await zkInstance.executeCmd(CMD_USER_WRQ, entry);

      if (reply && reply.length >= 2 && reply.readUInt16LE(0) !== CMD_ACK_OK) {
        throw new Error('CMD_USER_WRQ rejected by device');
      }

      await zkInstance.executeCmd(CMD_REFRESHDATA, '');
      await zkInstance.executeCmd(CMD_ENABLEDEVICE, '');

      process.stdout.write(JSON.stringify({
        status: 'success',
        message: `User ${deviceUserId} (${name}) set successfully, uid=${uid}`
      }));
      await zkInstance.disconnect();

    } else if (command === 'getFingerprints') {
      const deviceUserId = process.argv[6] || '0';

      // Read all users to find uid by userId
      const allUsers = await zkInstance.getUsers();
      let uid = null;

      if (allUsers && allUsers.data) {
        for (const u of allUsers.data) {
          if (String(u.userId) === String(deviceUserId)) {
            uid = u.uid;
            break;
          }
        }
      }

      if (uid === null) {
        throw new Error(`User ${deviceUserId} not found on device`);
      }

      const templates = [];

      for (let fingerIdx = 0; fingerIdx <= 9; fingerIdx++) {
        const req = Buffer.alloc(3);
        req.writeUInt16LE(uid, 0);
        req.writeUInt8(fingerIdx, 2);

        try {
          const reply = await zkInstance.executeCmd(CMD_USERTEMP_RRQ, req);
          if (reply && reply.readUInt16LE(0) !== CMD_ACK_ERROR) {
            const fpData = reply.slice(8);
            if (fpData.length > 0) {
              templates.push({
                fingerIndex: fingerIdx,
                size: fpData.length,
                data: fpData.toString('base64')
              });
            }
          }
        } catch (e) {
          // Skip missing finger
        }
      }

      process.stdout.write(JSON.stringify({
        status: 'success',
        data: templates
      }));
      await zkInstance.disconnect();
    }

  } catch (e) {
    process.stderr.write(JSON.stringify({
      status: 'error',
      message: e.message || String(e)
    }));
    try { await zkInstance.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

main();
