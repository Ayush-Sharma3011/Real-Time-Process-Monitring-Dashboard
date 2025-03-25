const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const si = require('systeminformation');
const { exec } = require('child_process');
const path = require('path');

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

// Cache for performance optimization
let processListCache = [];
let systemInfoCache = null;
let lastProcessUpdate = 0;
let lastSystemInfoUpdate = 0;

// Update intervals (increased to reduce load)
const PROCESS_UPDATE_INTERVAL = 10000; // 10 seconds
const SYSTEM_UPDATE_INTERVAL = 5000;   // 5 seconds

// Function to get system information
const getSystemInfo = async () => {
  try {
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
    console.error('Error fetching system information:', error);
    throw error;
  }
};

// Function to get process list
const getProcessList = async () => {
  try {
    let processes;
    
    try {
      // Try with systeminformation first
      console.log('Attempting to get processes using systeminformation...');
      processes = await si.processes();
      console.log(`Successfully retrieved ${processes.list.length} processes from systeminformation`);
      
      // Log sample of processes to verify data structure
      if (processes.list.length > 0) {
        const sample = processes.list.slice(0, 3);
        console.log('Sample processes:', JSON.stringify(sample, null, 2));
      }
    } catch (err) {
      console.error('Error with si.processes(), falling back to exec:', err);
      
      // Fallback to command line if systeminformation fails
      if (process.platform === 'win32') {
        console.log('Falling back to tasklist command...');
        const { stdout } = await execPromise('tasklist /FO CSV');
        processes = { list: parseWindowsTasklist(stdout) };
        console.log(`Retrieved ${processes.list.length} processes from tasklist`);
      } else {
        console.log('Falling back to ps command...');
        const { stdout } = await execPromise('ps -eo pid,comm,%cpu,%mem,user --sort=-%cpu');
        processes = { list: parseUnixPS(stdout) };
        console.log(`Retrieved ${processes.list.length} processes from ps`);
      }
    }
    
    if (!processes || !processes.list || processes.list.length === 0) {
      console.error('No processes retrieved from either method');
      return [];
    }
    
    // Format and filter process list
    const formattedProcesses = processes.list
      .filter(process => {
        const isValid = process.name && process.pid;
        if (!isValid) {
          console.log('Filtered out invalid process:', process);
        }
        return isValid;
      })
      .map(process => {
        const formatted = {
          pid: process.pid,
          name: process.name,
          cpu: typeof process.cpu === 'number' ? process.cpu.toFixed(1) : process.cpu,
          memory: typeof process.mem === 'number' ? process.mem.toFixed(1) : process.mem,
          user: process.user || 'Unknown'
        };
        return formatted;
      })
      .sort((a, b) => {
        const aCpu = parseFloat(a.cpu);
        const bCpu = parseFloat(b.cpu);
        return isNaN(aCpu) || isNaN(bCpu) ? 0 : bCpu - aCpu;
      })
      .slice(0, 50);
    
    console.log(`Final formatted process list: ${formattedProcesses.length} processes`);
    return formattedProcesses;
  } catch (error) {
    console.error('Error in getProcessList:', error);
    throw error;
  }
};

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected with ID:', socket.id);
  
  let systemInfoInterval;
  let processListInterval;
  
  // Send initial ping to confirm connectivity
  socket.emit('ping', { time: new Date().toISOString() });
  
  // Send cached data immediately if available
  if (systemInfoCache) {
    socket.emit('systemInfo', systemInfoCache);
  }
  
  if (processListCache.length > 0) {
    socket.emit('processList', processListCache);
  }
  
  // Update system information
  const updateSystemInfo = async () => {
    try {
      const now = Date.now();
      
      // Only fetch new data if cache is stale
      if (!systemInfoCache || now - lastSystemInfoUpdate > SYSTEM_UPDATE_INTERVAL) {
        systemInfoCache = await getSystemInfo();
        lastSystemInfoUpdate = now;
        console.log('Updated system info cache');
      }
      
      // Emit system information to client
      socket.emit('systemInfo', systemInfoCache);
    } catch (error) {
      console.error('Error in updateSystemInfo:', error);
      socket.emit('error', 'Failed to update system information');
    }
  };
  
  // Update process list
  const updateProcessList = async () => {
    try {
      const now = Date.now();
      
      // Only fetch new data if cache is stale
      if (processListCache.length === 0 || now - lastProcessUpdate > PROCESS_UPDATE_INTERVAL) {
        console.log('Updating process list cache...');
        processListCache = await getProcessList();
        lastProcessUpdate = now;
        console.log(`Updated process cache: ${processListCache.length} processes`);
      }
      
      // Emit process list to client
      socket.emit('processList', processListCache);
    } catch (error) {
      console.error('Error in updateProcessList:', error);
      socket.emit('error', 'Failed to update process list');
      // Send empty array instead of failing
      socket.emit('processList', []);
    }
  };
  
  // Initial updates
  updateSystemInfo();
  updateProcessList();
  
  // Set up intervals
  systemInfoInterval = setInterval(updateSystemInfo, SYSTEM_UPDATE_INTERVAL);
  processListInterval = setInterval(updateProcessList, PROCESS_UPDATE_INTERVAL);
  
  // Handle kill process request
  socket.on('killProcess', async (pid) => {
    console.log(`Request to kill process: ${pid}`);
    
    try {
      if (process.platform === 'win32') {
        await execPromise(`taskkill /PID ${pid} /F`);
      } else {
        await execPromise(`kill -9 ${pid}`);
      }
      
      // Force update process list after killing
      lastProcessUpdate = 0;
      await updateProcessList();
      
      socket.emit('killProcessResponse', { success: true, pid });
    } catch (error) {
      console.error(`Error killing process: ${error}`);
      socket.emit('killProcessResponse', { 
        success: false, 
        pid, 
        error: error.message 
      });
    }
  });
  
  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (systemInfoInterval) {
      clearInterval(systemInfoInterval);
    }
    if (processListInterval) {
      clearInterval(processListInterval);
    }
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
          mem: '0.0',
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
        const mem = parts[3];
        const user = parts[4];
        
        processes.push({
          pid,
          name,
          cpu,
          mem,
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