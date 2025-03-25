import { useState, useEffect, useCallback } from 'react';
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
  pid: number;
  error?: string;
}

const SERVER_URL = 'http://127.0.0.1:3001';

const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [processList, setProcessList] = useState<ProcessInfo[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    console.log('Initializing socket connection to:', SERVER_URL);
    
    // Initialize socket connection with additional options
    const socketInstance = io(SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    });
    
    socketInstance.on('connect', () => {
      setConnected(true);
      setConnectionError(null);
      console.log('Connected to server with ID:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      setConnectionError(`Connection error: ${err.message}`);
      setConnected(false);
    });

    socketInstance.on('disconnect', (reason) => {
      setConnected(false);
      console.log('Disconnected from server, reason:', reason);
    });

    // Debug event
    socketInstance.on('ping', (data) => {
      console.log('Received ping from server:', data);
    });

    // Receive system information
    socketInstance.on('systemInfo', (data: SystemInfo) => {
      console.log('Received systemInfo:', data.cpu.load, data.memory.usedPercent);
      setSystemInfo(data);
    });

    // Receive process list
    socketInstance.on('processList', (data: ProcessInfo[]) => {
      console.log('Received processList, count:', data.length);
      setProcessList(data);
    });

    // Handle errors from server
    socketInstance.on('error', (error: string) => {
      console.error('Server error:', error);
      setConnectionError(`Server error: ${error}`);
    });

    setSocket(socketInstance);

    // Clean up on unmount
    return () => {
      console.log('Cleaning up socket connection');
      socketInstance.disconnect();
    };
  }, []);

  // Function to kill a process
  const killProcess = useCallback(async (pid: number): Promise<KillProcessResponse> => {
    return new Promise((resolve) => {
      if (socket && connected) {
        console.log('Sending killProcess request for PID:', pid);
        
        // Set up a one-time event listener for the response
        socket.once('killProcessResponse', (response: KillProcessResponse) => {
          console.log('Received killProcessResponse:', response);
          resolve(response);
        });
        
        // Emit the kill process event
        socket.emit('killProcess', pid);
      } else {
        const errorResponse = { 
          success: false, 
          pid, 
          error: 'Socket not connected' 
        };
        console.error('Cannot kill process, socket not connected');
        resolve(errorResponse);
      }
    });
  }, [socket, connected]);

  return {
    systemInfo,
    processList,
    killProcess,
    connected,
    connectionError
  };
};

export default useSocket; 