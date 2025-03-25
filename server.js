const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const si = require('systeminformation');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST']
  }
});

// Debug systeminformation
console.log('Testing systeminformation...');
si.cpu().then(cpu => {
  console.log('Successfully retrieved CPU info:', cpu.manufacturer, cpu.brand);
}).catch(err => {
  console.error('Error retrieving CPU info:', err);
});

// Test process list access
console.log('Testing process list access...');
si.processes().then(processes => {
  console.log(`Successfully retrieved ${processes.list.length} processes`);
  
  // Log a few process examples to verify data structure
  if (processes.list.length > 0) {
    const sample = processes.list.slice(0, 3);
    console.log('Sample processes:', JSON.stringify(sample, null, 2));
  }
}).catch(err => {
  console.error('Error retrieving process list:', err);
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Cache for process list and system info
let processListCache = [];
let systemInfoCache = null;
let lastProcessListUpdate = 0;
let lastSystemInfoUpdate = 0;

// Update intervals (in milliseconds)
const PROCESS_LIST_INTERVAL = 5000; // 5 seconds
const SYSTEM_INFO_INTERVAL = 2000;  // 2 seconds

// Function to get process list with proper error handling
const getProcessList = async () => {
  try {
    console.log('Fetching process list from systeminformation...');
    const processes = await si.processes();
    console.log(`Retrieved ${processes.list.length} processes`);
    
    // Format the process list to match the client's expected structure
    const formattedProcesses = processes.list
      .filter(process => process && process.pid > 0)
      .map(process => ({
        pid: process.pid,
        name: process.name || 'Unknown',
        cpu: typeof process.cpu === 'number' ? process.cpu.toFixed(1) : '0.0',
        memory: typeof process.memRss === 'number' 
          ? ((process.memRss / os.totalmem()) * 100).toFixed(1) 
          : '0.0',
        user: process.user || 'Unknown'
      }))
      .sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu))
      .slice(0, 50); // Limit to top 50 processes
      
    console.log(`Formatted ${formattedProcesses.length} processes for client`);
    return formattedProcesses;
  } catch (error) {
    console.error('Error getting process list:', error);
    
    // Try fallback method
    try {
      console.log('Falling back to alternative method...');
      if (process.platform === 'win32') {
        const { stdout } = await execPromise('tasklist /FO CSV');
        return parseWindowsTasklist(stdout);
      } else {
        const { stdout } = await execPromise('ps -eo pid,comm,%cpu,%mem,user --sort=-%cpu');
        return parseUnixPS(stdout);
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return [];
    }
  }
};

// Function to get system info
const getSystemInfo = async () => {
  try {
    console.log('Fetching system info...');
    const [cpu, memory, currentLoad, cpuTemperature] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.currentLoad(),
      si.cpuTemperature()
    ]);
    
    // Format CPU information
    const cpuInfo = {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      speed: cpu.speed,
      cores: currentLoad.cpus.map(core => ({
        load: core.load.toFixed(1)
      })),
      temperature: cpuTemperature.main || 'N/A',
      load: currentLoad.currentLoad.toFixed(1)
    };
    
    // Format memory information
    const memoryInfo = {
      total: memory.total,
      free: memory.free,
      used: memory.used,
      usedPercent: ((memory.used / memory.total) * 100).toFixed(1)
    };
    
    return {
      cpu: cpuInfo,
      memory: memoryInfo,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return null;
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send cached data immediately if available
  if (processListCache.length > 0) {
    console.log('Sending cached process list to new client');
    socket.emit('processList', processListCache);
  }
  if (systemInfoCache) {
    console.log('Sending cached system info to new client');
    socket.emit('systemInfo', systemInfoCache);
  }

  // Send a ping to confirm connectivity
  socket.emit('ping', { time: new Date().toISOString() });

  // Set up intervals for this client
  const processListInterval = setInterval(async () => {
    try {
      const now = Date.now();
      if (now - lastProcessListUpdate >= PROCESS_LIST_INTERVAL) {
        processListCache = await getProcessList();
        lastProcessListUpdate = now;
        console.log(`Emitting updated process list with ${processListCache.length} processes`);
        socket.emit('processList', processListCache);
      }
    } catch (error) {
      console.error('Error in process list interval:', error);
    }
  }, 1000);

  const systemInfoInterval = setInterval(async () => {
    try {
      const now = Date.now();
      if (now - lastSystemInfoUpdate >= SYSTEM_INFO_INTERVAL) {
        systemInfoCache = await getSystemInfo();
        lastSystemInfoUpdate = now;
        if (systemInfoCache) {
          console.log('Emitting updated system info');
          socket.emit('systemInfo', systemInfoCache);
        }
      }
    } catch (error) {
      console.error('Error in system info interval:', error);
    }
  }, 1000);

  // Handle process kill requests
  socket.on('killProcess', async (pid) => {
    console.log(`Received kill request for process ${pid}`);
    try {
      if (process.platform === 'win32') {
        await execPromise(`taskkill /PID ${pid} /F`);
      } else {
        await execPromise(`kill -9 ${pid}`);
      }
      console.log(`Successfully killed process ${pid}`);
      
      // Update process list immediately after killing
      processListCache = await getProcessList();
      socket.emit('processList', processListCache);
      socket.emit('killProcessResponse', { success: true, pid });
    } catch (error) {
      console.error(`Error killing process ${pid}:`, error);
      socket.emit('killProcessResponse', { 
        success: false, 
        pid,
        error: error.message 
      });
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(processListInterval);
    clearInterval(systemInfoInterval);
  });
});

// Helper function to promisify exec
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// Parse Windows tasklist output
function parseWindowsTasklist(output) {
  const lines = output.split('\n').filter(line => line.trim());
  const processes = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    try {
      const match = lines[i].match(/"([^"]+)"/g);
      if (match && match.length >= 2) {
        const name = match[0].replace(/"/g, '');
        const pid = parseInt(match[1].replace(/"/g, ''), 10);
        
        processes.push({
          pid,
          name,
          cpu: '0.0',
          memory: '0.0',
          user: 'Unknown'
        });
      }
    } catch (err) {
      console.error('Error parsing tasklist line:', lines[i], err);
    }
  }
  
  return processes;
}

// Parse Unix ps output
function parseUnixPS(output) {
  const lines = output.split('\n').filter(line => line.trim());
  const processes = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    try {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parseInt(parts[0], 10);
        const name = parts[1];
        const cpu = parts[2];
        const memory = parts[3];
        const user = parts[4];
        
        processes.push({
          pid,
          name,
          cpu,
          memory,
          user
        });
      }
    } catch (err) {
      console.error('Error parsing ps line:', lines[i], err);
    }
  }
  
  return processes;
}

// Set port and start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connect to http://localhost:${PORT}`);
}); 