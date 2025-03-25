import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import si from 'systeminformation';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  let systemInfoInterval: NodeJS.Timeout;
  let processListInterval: NodeJS.Timeout;

  // Send CPU and memory info every 2 seconds
  systemInfoInterval = setInterval(async () => {
    try {
      const [cpuData, memData] = await Promise.all([
        si.currentLoad(),
        si.mem()
      ]);
      
      socket.emit('system-info', {
        cpu: {
          load: cpuData.currentLoad.toFixed(1),
          cores: cpuData.cpus.map(core => ({
            load: core.load.toFixed(1)
          }))
        },
        memory: {
          total: memData.total,
          used: memData.used,
          free: memData.free,
          usedPercent: ((memData.used / memData.total) * 100).toFixed(1)
        }
      });
    } catch (error) {
      console.error('Error fetching system info:', error);
    }
  }, 2000);

  // Send process list every 3 seconds
  processListInterval = setInterval(async () => {
    try {
      const processes = await si.processes();
      
      // Sort processes by CPU usage (descending)
      const sortedProcesses = processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 20) // Limit to top 20 processes
        .map(proc => ({
          pid: proc.pid,
          name: proc.name,
          cpu: proc.cpu.toFixed(1),
          mem: proc.mem.toFixed(1),
          memVsz: proc.memVsz,
          memRss: proc.memRss,
          command: proc.command,
          user: proc.user,
          state: proc.state
        }));
      
      socket.emit('process-list', sortedProcesses);
    } catch (error) {
      console.error('Error fetching process list:', error);
    }
  }, 3000);

  // Clean up on disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(systemInfoInterval);
    clearInterval(processListInterval);
  });

  // Handle kill process request
  socket.on('kill-process', async (pid: number) => {
    try {
      if (!pid) {
        socket.emit('kill-process-response', { 
          success: false, 
          message: 'Invalid PID' 
        });
        return;
      }

      // Using Node's child_process instead of si.processKill which doesn't exist
      const { exec } = require('child_process');
      const platform = process.platform;
      
      // Different commands for different OS
      const command = platform === 'win32' 
        ? `taskkill /F /PID ${pid}` 
        : `kill -9 ${pid}`;
      
      exec(command, (error: any) => {
        if (error) {
          console.error('Error killing process:', error);
          socket.emit('kill-process-response', { 
            success: false, 
            message: error.message || 'Failed to terminate process' 
          });
          return;
        }
        
        socket.emit('kill-process-response', { 
          success: true, 
          message: `Process ${pid} terminated successfully` 
        });
      });
    } catch (error: any) {
      console.error('Error killing process:', error);
      socket.emit('kill-process-response', { 
        success: false, 
        message: error.message || 'Failed to terminate process' 
      });
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 