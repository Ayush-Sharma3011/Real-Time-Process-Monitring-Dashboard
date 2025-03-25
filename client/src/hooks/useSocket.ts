import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Define types for the data
export interface SystemInfo {
  cpu: {
    manufacturer: string;
    brand: string;
    speed: number;
    cores: {
      load: string;
    }[];
    temperature: number | string;
    load: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: string;
  };
  timestamp: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: string;
  memory: string;
  user: string;
}

export interface KillProcessResponse {
  success: boolean;
  pid?: number;
  error?: string;
  message?: string;
}

// Use the same port as the server
const SERVER_URL = 'http://localhost:3000';

const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [processList, setProcessList] = useState<ProcessInfo[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [killStatus, setKillStatus] = useState<{pid: number, status: string} | null>(null);

  useEffect(() => {
    console.log('Initializing socket connection to:', SERVER_URL);
    
    // Socket connection with basic options
    const newSocket = io(SERVER_URL, {
      reconnection: true,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully with ID:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError(`Connection Error: ${error.message}`);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected, reason:', reason);
      setIsConnected(false);
    });

    newSocket.on('ping', (data) => {
      console.log('Received ping from server');
    });

    newSocket.on('systemInfo', (data) => {
      if (data) {
        setSystemInfo(data);
      }
    });

    newSocket.on('processList', (data) => {
      if (Array.isArray(data)) {
        setProcessList(data);
      }
    });
    
    // Add new event handlers for improved kill process flow
    newSocket.on('killProcessAcknowledged', (data) => {
      console.log('Kill request acknowledged for PID:', data.pid);
      setKillStatus({pid: data.pid, status: 'Processing...'});
    });

    newSocket.on('killProcessResponse', (response) => {
      console.log('Kill process response:', response);
      if (response.success) {
        setKillStatus({pid: response.pid || 0, status: 'Terminated successfully'});
      } else {
        setKillStatus({pid: response.pid || 0, status: `Failed: ${response.error || 'Unknown error'}`});
      }
      
      // Clear the status after 3 seconds
      setTimeout(() => {
        setKillStatus(null);
      }, 3000);
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setConnectionError(`Server Error: ${error}`);
    });

    setSocket(newSocket);

    return () => {
      console.log('Cleaning up socket connection');
      newSocket.disconnect();
    };
  }, []);

  // Function to kill a process
  const killProcess = async (pid: number): Promise<KillProcessResponse> => {
    return new Promise((resolve) => {
      if (!socket || !isConnected) {
        console.error('Socket not connected');
        resolve({ success: false, pid, error: 'Not connected to server' });
        return;
      }

      console.log('Sending kill request for process:', pid);
      socket.emit('killProcess', pid);
      
      // Set immediate status
      setKillStatus({pid, status: 'Request sent...'});

      const timeout = setTimeout(() => {
        console.error('Kill process request timed out');
        setKillStatus({pid, status: 'Request timed out'});
        resolve({ success: false, pid, error: 'Request timed out' });
      }, 10000); // Increased timeout to 10 seconds

      socket.once('killProcessResponse', (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  return {
    isConnected,
    systemInfo,
    processList,
    killProcess,
    connectionError,
    killStatus
  };
};

export default useSocket; 