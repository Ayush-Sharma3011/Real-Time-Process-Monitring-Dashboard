const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const si = require('systeminformation');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const cors = require('cors');

// Create Express app and HTTP server
const app = express();
// Enable CORS for all routes
app.use(cors());

const server = http.createServer(app);

// Create Socket.IO server with CORS configuration
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST'],
    credentials: true
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

// Serve static assets from client folder
app.use(express.static(path.join(__dirname, 'client/build')));

// For any other route, serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Cache for process list and system info
let processListCache = [];
let systemInfoCache = null;
let lastProcessListUpdate = 0;
let lastSystemInfoUpdate = 0;

// Update intervals (in milliseconds)
const PROCESS_LIST_INTERVAL = 10000; // 10 seconds - increased to reduce CPU usage
const SYSTEM_INFO_INTERVAL = 5000;   // 5 seconds

// Function to get process list - simplified
const getProcessList = async () => {
  try {
    // Use the simpler process list call
    const processes = await si.processes();
    
    // Format and limit to top 30 processes to improve performance
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
      .slice(0, 30); // Reduced from 50 to 30 processes
      
    return formattedProcesses;
  } catch (error) {
    console.error('Error getting process list:', error);
    return [];
  }
};

// Function to get system info - simplified
const getSystemInfo = async () => {
  try {
    const memory = await si.mem();
    const currentLoad = await si.currentLoad();
    
    // Simplified CPU info
    const cpuInfo = {
      speed: currentLoad.currentLoad.toFixed(1),
      cores: currentLoad.cpus.map(core => ({
        load: core.load.toFixed(1)
      })).slice(0, 4), // Limit to first 4 cores to reduce data size
      load: currentLoad.currentLoad.toFixed(1)
    };
    
    // Simplified memory info
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

// Improved function to kill a process with better error handling
async function killProcessById(pid) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Attempting to kill process ${pid}...`);
      
      let command;
      if (process.platform === 'win32') {
        command = `taskkill /F /PID ${pid}`;
      } else {
        command = `kill -9 ${pid}`;
      }
      
      console.log(`Executing command: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error killing process: ${error.message}`);
          reject({
            success: false,
            message: error.message
          });
          return;
        }
        
        if (stderr) {
          console.warn(`Warning when killing process: ${stderr}`);
        }
        
        console.log(`Process ${pid} killed successfully. Output: ${stdout}`);
        resolve({
          success: true,
          message: `Process ${pid} terminated successfully`
        });
      });
    } catch (error) {
      console.error(`Exception killing process: ${error.message}`);
      reject({
        success: false,
        message: error.message
      });
    }
  });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send cached data immediately if available
  if (processListCache.length > 0) {
    socket.emit('processList', processListCache);
  }
  if (systemInfoCache) {
    socket.emit('systemInfo', systemInfoCache);
  }

  // Send a ping to confirm connectivity
  socket.emit('ping', { time: new Date().toISOString() });

  // Set up a single interval for both updates to reduce overhead
  const updateInterval = setInterval(async () => {
    const now = Date.now();
    
    // Update process list if needed
    if (now - lastProcessListUpdate >= PROCESS_LIST_INTERVAL) {
      try {
        processListCache = await getProcessList();
        lastProcessListUpdate = now;
        socket.emit('processList', processListCache);
      } catch (error) {
        console.error('Error updating process list:', error);
      }
    }
    
    // Update system info if needed
    if (now - lastSystemInfoUpdate >= SYSTEM_INFO_INTERVAL) {
      try {
        systemInfoCache = await getSystemInfo();
        lastSystemInfoUpdate = now;
        if (systemInfoCache) {
          socket.emit('systemInfo', systemInfoCache);
        }
      } catch (error) {
        console.error('Error updating system info:', error);
      }
    }
  }, 1000);

  // Handle process kill requests with improved acknowledgment
  socket.on('killProcess', async (pid) => {
    console.log(`Received kill request for process ${pid}`);
    
    // Acknowledge receipt of the request immediately
    socket.emit('killProcessAcknowledged', { pid });
    
    try {
      const result = await killProcessById(pid);
      console.log(`Kill process result:`, result);
      
      // Immediately update the process list after killing
      processListCache = await getProcessList();
      socket.emit('processList', processListCache);
      socket.emit('killProcessResponse', { 
        success: true, 
        pid,
        message: result.message
      });
    } catch (error) {
      console.error(`Error killing process ${pid}:`, error);
      socket.emit('killProcessResponse', { 
        success: false, 
        pid,
        error: error.message || 'Unknown error'
      });
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(updateInterval);
  });
});

// Set port and start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Connect to http://localhost:${PORT}`);
}); 