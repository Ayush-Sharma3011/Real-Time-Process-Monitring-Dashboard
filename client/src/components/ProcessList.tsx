import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import useSocket from '../hooks/useSocket';

interface Process {
  pid: number;
  name: string;
  cpu: string;
  memory: string;
  user: string;
}

const ProcessList: React.FC = () => {
  const { processList, killProcess, isConnected, connectionError, killStatus } = useSocket();
  const [sortField, setSortField] = useState<keyof Process>('cpu');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<boolean>(false);

  // Handle initial loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadingTimeout(true);
    }, 10000);
    
    return () => clearTimeout(timer);
  }, []);

  // Update loading state based on process list
  useEffect(() => {
    if (processList && processList.length > 0) {
      setIsLoading(false);
      setError(null);
      console.log('Process list loaded with', processList.length, 'processes');
    } else if (isConnected && !isLoading) {
      // We're connected but have no processes
      console.log('Connected but no processes received');
    }
  }, [processList, isConnected, isLoading]);

  // Handle connection errors
  useEffect(() => {
    if (connectionError) {
      setError(connectionError);
      setIsLoading(false);
      console.error('Connection error:', connectionError);
    }
  }, [connectionError]);

  // Update connection status
  useEffect(() => {
    console.log('Connection status:', isConnected ? 'Connected' : 'Disconnected');
  }, [isConnected]);

  const handleSort = (field: keyof Process) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleKillProcess = async (pid: number) => {
    if (!window.confirm(`Are you sure you want to terminate process ${pid}?`)) {
      return;
    }

    try {
      console.log(`Attempting to kill process ${pid}...`);
      const response = await killProcess(pid);
      console.log('Kill process response:', response);
      
      if (!response.success) {
        setError(`Failed to kill process: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setError('Error killing process');
      console.error('Error killing process:', error);
    }
  };

  const filteredAndSortedProcesses = processList
    .filter((process: Process) => 
      process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      process.pid.toString().includes(searchTerm) ||
      process.user.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: Process, b: Process) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (sortField === 'pid') {
        return sortDirection === 'asc' 
          ? a.pid - b.pid 
          : b.pid - a.pid;
      }
      
      // Convert values to strings for comparison
      const aStr = String(aValue);
      const bStr = String(bValue);
      
      // Try to parse as numbers for numeric fields
      if (sortField === 'cpu' || sortField === 'memory') {
        const aNum = parseFloat(aStr);
        const bNum = parseFloat(bStr);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' 
            ? aNum - bNum 
            : bNum - aNum;
        }
      }
      
      // Fallback to string comparison
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });

  // Show loading state
  if (isLoading) {
    return (
      <Container>
        <LoadingMessage>
          {loadingTimeout 
            ? "Still loading... Make sure the server is running with administrator privileges."
            : "Loading processes..."}
        </LoadingMessage>
        {!isConnected && <ErrorMessage>Not connected to server. Check server status.</ErrorMessage>}
      </Container>
    );
  }

  // Show error state
  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
        <TroubleshootingTips>
          <h4>Troubleshooting Tips:</h4>
          <ul>
            <li>Make sure the server is running (npm run server)</li>
            <li>Run the server with administrator privileges</li>
            <li>Confirm the server is running on port 3000</li>
            <li>Check network settings and firewall rules</li>
          </ul>
        </TroubleshootingTips>
      </Container>
    );
  }

  return (
    <Container>
      <ConnectionStatus connected={isConnected}>
        Status: {isConnected ? 'Connected' : 'Disconnected'}
      </ConnectionStatus>
      
      <SearchInput
        type="text"
        placeholder="Search processes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      <ProcessCount>
        Showing {filteredAndSortedProcesses.length} of {processList.length} processes
      </ProcessCount>
      
      {killStatus && (
        <KillStatus>
          Process {killStatus.pid}: {killStatus.status}
        </KillStatus>
      )}
      
      <Table>
        <thead>
          <tr>
            <th onClick={() => handleSort('pid')}>
              PID {sortField === 'pid' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('name')}>
              Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('cpu')}>
              CPU % {sortField === 'cpu' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('memory')}>
              Memory % {sortField === 'memory' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => handleSort('user')}>
              User {sortField === 'user' && (sortDirection === 'asc' ? '↑' : '↓')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedProcesses.length > 0 ? (
            filteredAndSortedProcesses.map((process: Process) => (
              <tr key={process.pid} className={killStatus && killStatus.pid === process.pid ? 'highlighted' : ''}>
                <td>{process.pid}</td>
                <td>{process.name}</td>
                <td>{process.cpu}%</td>
                <td>{process.memory}%</td>
                <td>{process.user}</td>
                <td>
                  <KillButton onClick={() => handleKillProcess(process.pid)}>
                    Kill
                  </KillButton>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center' }}>
                No processes found
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Container>
  );
};

const Container = styled.div`
  padding: 20px;
  background-color: #1e1e2e;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  color: #cdd6f4;
  
  th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #313244;
  }
  
  th {
    background-color: #181825;
    font-weight: bold;
    cursor: pointer;
    user-select: none;
    
    &:hover {
      background-color: #11111b;
    }
  }
  
  tr:hover {
    background-color: #313244;
  }
  
  tr.highlighted {
    background-color: rgba(249, 226, 175, 0.2);
  }
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  background-color: #313244;
  border: none;
  border-radius: 4px;
  color: #cdd6f4;
  font-size: 16px;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px #89b4fa;
  }
  
  &::placeholder {
    color: #6c7086;
  }
`;

const KillButton = styled.button`
  background-color: #f38ba8;
  color: #11111b;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: #eb6f92;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #cdd6f4;
  font-size: 18px;
`;

const ErrorMessage = styled.div`
  background-color: #f38ba8;
  color: #11111b;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-weight: bold;
`;

const ConnectionStatus = styled.div<{ connected: boolean }>`
  display: inline-block;
  padding: 5px 10px;
  margin-bottom: 20px;
  border-radius: 4px;
  background-color: ${props => props.connected ? '#a6e3a1' : '#f38ba8'};
  color: #11111b;
  font-weight: bold;
`;

const ProcessCount = styled.div`
  margin-bottom: 10px;
  color: #cdd6f4;
  font-size: 14px;
`;

const KillStatus = styled.div`
  background-color: #f9e2af;
  color: #11111b;
  padding: 8px 12px;
  margin-bottom: 15px;
  border-radius: 4px;
  font-weight: bold;
`;

const TroubleshootingTips = styled.div`
  background-color: #313244;
  padding: 15px;
  border-radius: 4px;
  margin-top: 20px;
  
  h4 {
    margin-top: 0;
    color: #cdd6f4;
  }
  
  ul {
    margin: 0;
    padding-left: 20px;
    
    li {
      margin-bottom: 5px;
      color: #bac2de;
    }
  }
`;

export default ProcessList; 