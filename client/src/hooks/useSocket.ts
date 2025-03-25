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
}

const SERVER_URL = 'http://127.0.0.1:3001';

const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [processList, setProcessList] = useState<ProcessInfo[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [receivedData, setReceivedData] = useState(false);

  useEffect(() => {
    console.log('Initializing socket connection to:', SERVER_URL);
    const newSocket = io(SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: ['websocket', 'polling']
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
      console.log('Received ping from server:', data);
    });

    newSocket.on('systemInfo', (data) => {
      console.log('Received system info:', data ? 'data available' : 'no data');
      if (data) {
        setSystemInfo(data);
        setReceivedData(true);
      }
    });

    newSocket.on('processList', (data) => {
      console.log('Received process list:', Array.isArray(data) ? `${data.length} items` : 'invalid data');
      if (Array.isArray(data) && data.length > 0) {
        console.log('Sample process:', data[0]);
        setProcessList(data);
        setReceivedData(true);
      }
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      setConnectionError(`Server Error: ${error}`);
    });

    setSocket(newSocket);

    // If we don't receive any data within 10 seconds, report an error
    const dataTimeout = setTimeout(() => {
      if (!receivedData) {
        console.error('No data received within timeout period');
        setConnectionError('No data received from server. Make sure the server is running with the right permissions.');
      }
    }, 10000);

    return () => {
      console.log('Cleaning up socket connection...');
      clearTimeout(dataTimeout);
      newSocket.close();
    };
  }, [receivedData]);

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

      const timeout = setTimeout(() => {
        console.error('Kill process request timed out');
        resolve({ success: false, pid, error: 'Request timed out' });
      }, 5000);

      socket.once('killProcessResponse', (response) => {
        console.log('Received kill process response:', response);
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
    connectionError
  };
};

export default useSocket; 