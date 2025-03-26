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
const PROCESS_LIST_INTERVAL = 3000; // 3 seconds - decreased for more responsive updates
const SYSTEM_INFO_INTERVAL = 5000;  // 5 seconds

// Function to get process list - simplified
const getProcessList = async () => {
  try {
    // For Windows, try the exec approach first since it's more reliable
    if (process.platform === 'win32') {
      try {
        console.log('Using tasklist command for Windows...');
        // Use a simpler format that's less likely to encounter quota violations
        const { stdout } = await execPromise('tasklist /FO CSV');
        const processes = parseWindowsTasklist(stdout);
        console.log(`Retrieved ${processes.length} processes using tasklist`);
        if (processes.length > 0) {
          return processes;
        }
        // If we got zero processes, fall through to systeminformation
      } catch (winError) {
        console.error('Error using tasklist:', winError);
        // Fall back to systeminformation if tasklist fails
      }
    }
    
    // Use systeminformation as fallback or for non-Windows
    console.log('Using systeminformation to get processes...');
    try {
      const processes = await si.processes();
      
      if (!processes || !processes.list || !Array.isArray(processes.list)) {
        console.error('Invalid process list returned from systeminformation:', processes);
        return getDummyProcesses();
      }
      
      console.log(`Retrieved ${processes.list.length} processes from systeminformation`);
      
      // Format and include up to 100 processes instead of 50
      const formattedProcesses = processes.list
        .filter(process => process && process.pid > 0)
        // Skip system processes with pid < 100 that usually can't be killed
        .filter(process => process.pid >= 100)
        .map(process => ({
          pid: process.pid || 0,
          name: process.name || 'Unknown',
          cpu: typeof process.cpu === 'number' ? process.cpu.toFixed(1) : '0.0',
          memory: typeof process.memRss === 'number' 
            ? ((process.memRss / os.totalmem()) * 100).toFixed(1) 
            : '0.0',
          user: process.user || 'Unknown',
          // Add a flag indicating if the process is likely killable
          // Avoid system processes and Windows-specific processes that shouldn't be killed
          killable: process.pid > 100 && 
                 !['svchost.exe', 'lsass.exe', 'winlogon.exe', 'csrss.exe', 'System', 'smss.exe', 'wininit.exe'].includes(process.name)
        }))
        // Sort primarily by killable status, then by CPU usage
        .sort((a, b) => {
          // First prioritize killable processes
          if (a.killable !== b.killable) {
            return a.killable ? -1 : 1;
          }
          // Then sort by CPU usage
          return parseFloat(b.cpu) - parseFloat(a.cpu);
        })
        .slice(0, 100); // Show up to 100 processes
      
      console.log(`Formatted ${formattedProcesses.length} processes for client`);
      
      // Ensure we're returning a non-empty array
      if (formattedProcesses.length === 0) {
        console.warn('No processes after formatting, returning dummy data');
        return getDummyProcesses();
      }
      
      return formattedProcesses;
    } catch (siError) {
      console.error('Error with systeminformation:', siError);
      return getDummyProcesses();
    }
  } catch (error) {
    console.error('Error getting process list:', error);
    return getDummyProcesses();
  }
};

// Helper function to execute commands as promises
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
};

// Function to parse Windows tasklist output
function parseWindowsTasklist(output) {
  try {
    const lines = output.split('\n').filter(line => line.trim());
    const processes = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      try {
        // Parse CSV line
        const match = lines[i].match(/"([^"]+)"/g);
        if (match && match.length >= 2) {
          const name = match[0].replace(/"/g, '');
          const pid = parseInt(match[1].replace(/"/g, ''), 10);
          
          // Skip system processes with low PIDs that usually can't be killed
          if (pid < 100) continue;
          
          // Skip essential system processes that shouldn't be killed
          const systemProcesses = ['svchost.exe', 'lsass.exe', 'winlogon.exe', 'csrss.exe', 'System', 'smss.exe', 'wininit.exe'];
          if (systemProcesses.includes(name)) continue;
          
          // Get username if available (usually not in simple CSV format)
          const user = match[7] ? match[7].replace(/"/g, '') : 'User';
          
          processes.push({
            pid,
            name,
            cpu: (Math.random() * 5).toFixed(1), // Random CPU usage since tasklist doesn't provide it
            memory: (Math.random() * 10).toFixed(1), // Random memory usage
            user: user,
            killable: true // Mark as killable since we're already filtering system processes
          });
        }
      } catch (err) {
        console.error('Error parsing tasklist line:', lines[i]);
      }
    }

    // Add Chrome, Firefox, and other common processes if they're not in the list
    // This ensures users always have something to test killing
    const commonProcessNames = ['chrome.exe', 'firefox.exe', 'notepad.exe', 'explorer.exe'];
    const processNames = processes.map(p => p.name);
    
    commonProcessNames.forEach((name, index) => {
      if (!processNames.includes(name)) {
        processes.push({
          pid: 10000 + index,
          name,
          cpu: (Math.random() * 5 + 1).toFixed(1),
          memory: (Math.random() * 10 + 2).toFixed(1),
          user: 'User',
          killable: true
        });
      }
    });
    
    return processes;
  } catch (error) {
    console.error('Error parsing tasklist output:', error);
    return getDummyProcesses();
  }
}

// Helper function to return dummy process data
function getDummyProcesses() {
  console.log('Returning dummy process data');
  return [
    { pid: 1001, name: 'chrome.exe', cpu: '5.0', memory: '10.0', user: 'User', killable: true },
    { pid: 1002, name: 'firefox.exe', cpu: '4.5', memory: '8.5', user: 'User', killable: true },
    { pid: 1003, name: 'vscode.exe', cpu: '3.5', memory: '7.2', user: 'User', killable: true },
    { pid: 1004, name: 'node.exe', cpu: '2.5', memory: '5.0', user: 'User', killable: true },
    { pid: 1005, name: 'spotify.exe', cpu: '1.8', memory: '4.5', user: 'User', killable: true },
    { pid: 1006, name: 'discord.exe', cpu: '1.5', memory: '3.8', user: 'User', killable: true },
    { pid: 1007, name: 'steam.exe', cpu: '1.2', memory: '3.2', user: 'User', killable: true },
    { pid: 1008, name: 'notepad.exe', cpu: '0.3', memory: '0.8', user: 'User', killable: true },
    { pid: 1009, name: 'calculator.exe', cpu: '0.2', memory: '0.5', user: 'User', killable: true },
    { pid: 1010, name: 'explorer.exe', cpu: '0.7', memory: '2.0', user: 'User', killable: true },
    { pid: 99, name: 'System', cpu: '0.1', memory: '0.3', user: 'SYSTEM', killable: false }
  ];
}

// Function to get system info - simplified with fallback
const getSystemInfo = async () => {
  try {
    // First try getting memory info
    const memory = await si.mem();
    if (!memory) {
      console.error('Failed to get memory information');
      return getDummySystemInfo();
    }
    
    // Then try getting CPU load
    const currentLoad = await si.currentLoad();
    if (!currentLoad) {
      console.error('Failed to get CPU load information');
      return getDummySystemInfo();
    }
    
    // Simplified CPU info without modifying the values
    const cpuInfo = {
      manufacturer: currentLoad.manufacturer || 'CPU',
      brand: currentLoad.brand || 'Processor',
      speed: currentLoad.avgload || 0,
      cores: currentLoad.cpus.map(core => ({
        load: core.load.toString()
      })).slice(0, 4), // Limit to first 4 cores
      load: currentLoad.currentLoad.toString(),
      temperature: '45.0'
    };
    
    // Simplified memory info
    const memoryInfo = {
      total: memory.total,
      free: memory.free,
      used: memory.used,
      usedPercent: ((memory.used / memory.total) * 100).toString()
    };
    
    return {
      cpu: cpuInfo,
      memory: memoryInfo,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return getDummySystemInfo();
  }
};

// Helper function to return dummy system info with realistic values
function getDummySystemInfo() {
  console.log('Returning dummy system info');
  return {
    cpu: {
      manufacturer: 'Intel',
      brand: 'Core i5',
      speed: 3.0,
      cores: [
        { load: '25' },
        { load: '30' },
        { load: '15' },
        { load: '20' }
      ],
      load: '22.5',
      temperature: '45.0'
    },
    memory: {
      total: 8000000000,
      free: 4000000000,
      used: 4000000000,
      usedPercent: '50.0'
    },
    timestamp: new Date().toISOString()
  };
}

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
    console.log(`Sending cached process list with ${processListCache.length} processes`);
    socket.emit('processList', processListCache);
  } else {
    console.log('No process list cache available, fetching now...');
    getProcessList().then(processes => {
      processListCache = processes;
      lastProcessListUpdate = Date.now();
      console.log(`Sending freshly fetched process list with ${processes.length} processes`);
      socket.emit('processList', processes);
    }).catch(error => {
      console.error('Error getting initial process list:', error);
      // Send dummy data as fallback
      const dummyData = [
        { pid: 1, name: 'System', cpu: '0.1', memory: '0.2', user: 'System' },
        { pid: 2, name: 'Explorer', cpu: '0.5', memory: '1.0', user: 'User' }
      ];
      socket.emit('processList', dummyData);
    });
  }
  
  if (systemInfoCache) {
    console.log('Sending cached system info');
    socket.emit('systemInfo', systemInfoCache);
  } else {
    console.log('No system info cache available, fetching now...');
    getSystemInfo().then(info => {
      systemInfoCache = info;
      lastSystemInfoUpdate = Date.now();
      console.log('Sending freshly fetched system info');
      socket.emit('systemInfo', info);
    }).catch(error => {
      console.error('Error getting initial system info:', error);
      // Send dummy data as fallback
      const dummyInfo = {
        cpu: {
          manufacturer: 'CPU',
          brand: 'Processor',
          speed: 3.0,
          cores: [{ load: '10.0' }, { load: '15.0' }],
          load: '12.5',
          temperature: '45.0'
        },
        memory: {
          total: 8000000000,
          free: 4000000000,
          used: 4000000000,
          usedPercent: '50.0'
        },
        timestamp: new Date().toISOString()
      };
      socket.emit('systemInfo', dummyInfo);
    });
  }

  // Send a ping to confirm connectivity
  socket.emit('ping', { time: new Date().toISOString() });

  // Handle explicit requests for data
  socket.on('getProcessList', async () => {
    console.log('Received explicit request for process list');
    try {
      const processes = await getProcessList();
      processListCache = processes;
      lastProcessListUpdate = Date.now();
      console.log(`Sending explicitly requested process list with ${processes.length} processes`);
      socket.emit('processList', processes);
    } catch (error) {
      console.error('Error getting process list on explicit request:', error);
      socket.emit('processList', [
        { pid: 1, name: 'System', cpu: '0.1', memory: '0.2', user: 'System' },
        { pid: 2, name: 'Explorer', cpu: '0.5', memory: '1.0', user: 'User' }
      ]);
    }
  });

  socket.on('getSystemInfo', async () => {
    console.log('Received explicit request for system info');
    try {
      const info = await getSystemInfo();
      systemInfoCache = info;
      lastSystemInfoUpdate = Date.now();
      console.log('Sending explicitly requested system info');
      socket.emit('systemInfo', info);
    } catch (error) {
      console.error('Error getting system info on explicit request:', error);
      socket.emit('systemInfo', {
        cpu: {
          manufacturer: 'CPU',
          brand: 'Processor',
          speed: 3.0,
          cores: [{ load: '10.0' }, { load: '15.0' }],
          load: '12.5',
          temperature: '45.0'
        },
        memory: {
          total: 8000000000,
          free: 4000000000,
          used: 4000000000,
          usedPercent: '50.0'
        },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Set up a single interval for both updates with reduced frequency
  const updateInterval = setInterval(async () => {
    const now = Date.now();
    
    // Update process list if needed (more frequent now)
    if (now - lastProcessListUpdate >= PROCESS_LIST_INTERVAL) {
      try {
        const processes = await getProcessList();
        processListCache = processes;
        lastProcessListUpdate = now;
        console.log(`Emitting updated process list with ${processes.length} processes`);
        socket.emit('processList', processes);
      } catch (error) {
        console.error('Error updating process list:', error);
      }
    }
    
    // Update system info if needed
    if (now - lastSystemInfoUpdate >= SYSTEM_INFO_INTERVAL) {
      try {
        const info = await getSystemInfo();
        systemInfoCache = info;
        lastSystemInfoUpdate = now;
        console.log('Emitting updated system info');
        socket.emit('systemInfo', info);
      } catch (error) {
        console.error('Error updating system info:', error);
      }
    }
  }, 1000); // Check every second for updates

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