# Troubleshooting Guide

If you're having trouble running the application, follow these step-by-step instructions:

## Basic Setup Issues

### 1. Dependencies Installation

Make sure both server and client dependencies are installed:

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Check Port Usage

Make sure ports 5000 (server) and 3000 (client) are not in use by other applications:

```bash
# For Windows, check if port 5000 is in use
netstat -ano | findstr :5000

# For Mac/Linux
lsof -i :5000
```

If the port is in use, you can kill the process or change the port in server.js.

## Specific Fixes

### Fix 1: Check Server Start

Try running the server directly:

```bash
node server.js
```

If you see any errors, they will be displayed in the console.

### Fix 2: Socket Connection Issues

If the client shows "Disconnected" status, the issue might be with Socket.IO:

1. Make sure in the `useSocket.ts` file, the server URL is correct: `const SERVER_URL = 'http://localhost:5000';`
2. Check that the socket event names match between client and server:
   - Server emits: 'systemInfo', 'processList', 'killProcessResponse'
   - Client listens for: 'systemInfo', 'processList', 'killProcessResponse'

### Fix 3: Server is Running but No Data

If the server is running but no data appears in the dashboard:

1. Check the browser console for errors (F12 -> Console tab)
2. Verify that systeminformation is working by adding this code to your server.js (temporarily):

```javascript
// Add near the top of your server.js
const si = require('systeminformation');

// Add this after creating the server
si.cpu().then(data => {
  console.log('CPU Info:', data);
}).catch(error => {
  console.error('Error getting CPU info:', error);
});
```

### Fix 4: Permission Issues

For process termination, you may need elevated privileges:

- **Windows**: Run the command prompt as Administrator
- **Mac/Linux**: Use sudo when starting the Node.js server

### Fix 5: Windows-specific Issues

On Windows, you may encounter issues with the systeminformation package:

1. Make sure you have the latest Node.js LTS version installed
2. Try reinstalling the systeminformation package:

```bash
npm uninstall systeminformation
npm install systeminformation@latest
```

## Advanced Debugging

### 1. Debug the Socket Connection

Add these console.log statements to your server.js:

```javascript
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
  
  // Add this to confirm events are being emitted
  setInterval(() => {
    console.log('Emitting ping event...');
    socket.emit('ping', { time: new Date().toISOString() });
  }, 5000);
});
```

And add this to your useSocket.ts hook:

```typescript
useEffect(() => {
  // Initialize socket connection
  const socketInstance = io(SERVER_URL);
  
  socketInstance.on('connect', () => {
    setConnected(true);
    console.log('Connected to server', socketInstance.id);
  });

  socketInstance.on('ping', (data) => {
    console.log('Received ping from server:', data);
  });
  
  // ... rest of the code
}, []);
```

### 2. Completely Reset the Project

If all else fails, try these steps:

1. Close all running Node.js processes
2. Delete the node_modules folders:

```bash
rm -rf node_modules
rm -rf client/node_modules
```

3. Clear npm cache:

```bash
npm cache clean --force
```

4. Reinstall all dependencies:

```bash
npm install
cd client
npm install
cd ..
```

5. Restart the application:

```bash
npm run dev
```

## Still Having Issues?

If you're still experiencing problems after trying these solutions, the issue might be more specific to your environment. Try running the server component and client component separately, and check the console output for any specific error messages. 