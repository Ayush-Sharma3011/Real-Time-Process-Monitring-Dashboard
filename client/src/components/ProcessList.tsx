import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import useSocket from '../hooks/useSocket';

interface Process {
  pid: number;
  name: string;
  cpu: string;
  memory: string;
  user: string;
  killable?: boolean;
}

const ProcessList: React.FC = () => {
  const { processList, killProcess, isConnected, connectionError, killStatus } = useSocket();
  const [sortField, setSortField] = useState<keyof Process>('cpu');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<boolean>(false);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [showKillableOnly, setShowKillableOnly] = useState<boolean>(false);

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

  // Handle process selection
  const handleProcessClick = (process: Process) => {
    setSelectedProcess(process);
  };

  // Close process details modal
  const handleCloseDetails = () => {
    setSelectedProcess(null);
  };

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
      
      // Close process details if we just killed the selected process
      if (selectedProcess && selectedProcess.pid === pid) {
        setSelectedProcess(null);
      }
      
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
      // Filter by search term
      (process.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       process.pid.toString().includes(searchTerm) ||
       process.user.toLowerCase().includes(searchTerm.toLowerCase())) &&
      // Filter by killable status if the option is enabled
      (!showKillableOnly || process.killable)
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

  // Count killable processes
  const killableCount = processList.filter(process => process.killable).length;

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

  // Show empty list message if connected but no processes
  if (isConnected && (!processList || processList.length === 0)) {
    return (
      <Container>
        <ConnectionStatus connected={isConnected}>
          Status: Connected
        </ConnectionStatus>
        <div style={{ textAlign: 'center', margin: '40px 0', color: '#cdd6f4' }}>
          No processes available. The server might be having trouble accessing process information.
          <br /><br />
          <strong>Please try running the server with administrator privileges.</strong>
        </div>
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
      
      <ControlPanel>
        <ProcessCount>
          Showing {filteredAndSortedProcesses.length} of {processList.length} processes 
          ({killableCount} killable)
        </ProcessCount>
        
        <KillableFilter>
          <input 
            type="checkbox" 
            id="showKillableOnly" 
            checked={showKillableOnly}
            onChange={() => setShowKillableOnly(!showKillableOnly)}
          />
          <label htmlFor="showKillableOnly">Show killable processes only</label>
        </KillableFilter>
        
        <ProcessTip>Click on a process to view details</ProcessTip>
      </ControlPanel>
      
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
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedProcesses.length > 0 ? (
            filteredAndSortedProcesses.map((process: Process) => (
              <tr 
                key={process.pid} 
                className={`
                  ${killStatus && killStatus.pid === process.pid ? 'highlighted' : ''}
                  ${process.killable ? 'killable' : 'not-killable'}
                `}
                onClick={() => handleProcessClick(process)}
              >
                <td>{process.pid}</td>
                <td>{process.name}</td>
                <td>{process.cpu}%</td>
                <td>{process.memory}%</td>
                <td>{process.user}</td>
                <td>
                  <KillableStatus killable={!!process.killable}>
                    {process.killable ? 'Killable' : 'System Process'}
                  </KillableStatus>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {process.killable ? (
                    <KillButton onClick={() => handleKillProcess(process.pid)}>
                      Kill
                    </KillButton>
                  ) : (
                    <DisabledButton title="System processes cannot be killed">
                      Kill
                    </DisabledButton>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center' }}>
                No processes found
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* Process Details Modal */}
      {selectedProcess && (
        <ProcessDetailsModal>
          <ModalContent>
            <ModalHeader>
              <h3>Process Details</h3>
              <CloseButton onClick={handleCloseDetails}>&times;</CloseButton>
            </ModalHeader>
            
            <DetailItem>
              <DetailLabel>PID:</DetailLabel>
              <DetailValue>{selectedProcess.pid}</DetailValue>
            </DetailItem>
            
            <DetailItem>
              <DetailLabel>Name:</DetailLabel>
              <DetailValue>{selectedProcess.name}</DetailValue>
            </DetailItem>
            
            <DetailItem>
              <DetailLabel>CPU Usage:</DetailLabel>
              <DetailValue>{selectedProcess.cpu}%</DetailValue>
            </DetailItem>
            
            <DetailItem>
              <DetailLabel>Memory Usage:</DetailLabel>
              <DetailValue>{selectedProcess.memory}%</DetailValue>
            </DetailItem>
            
            <DetailItem>
              <DetailLabel>User:</DetailLabel>
              <DetailValue>{selectedProcess.user}</DetailValue>
            </DetailItem>
            
            <DetailItem>
              <DetailLabel>Status:</DetailLabel>
              <DetailValue>
                <KillableStatus killable={!!selectedProcess.killable}>
                  {selectedProcess.killable ? 'Killable' : 'System Process (Cannot Be Killed)'}
                </KillableStatus>
              </DetailValue>
            </DetailItem>
            
            {selectedProcess.killable ? (
              <KillButtonLarge onClick={() => handleKillProcess(selectedProcess.pid)}>
                Terminate Process
              </KillButtonLarge>
            ) : (
              <DisabledButtonLarge title="System processes cannot be killed">
                Cannot Terminate (System Process)
              </DisabledButtonLarge>
            )}
          </ModalContent>
        </ProcessDetailsModal>
      )}
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
  
  tr {
    cursor: pointer;
    
    &:hover {
      background-color: #313244;
    }
  }
  
  tr.highlighted {
    background-color: rgba(249, 226, 175, 0.2);
  }
  
  tr.killable {
    /* Subtle highlight for killable processes */
    &:hover {
      background-color: rgba(166, 227, 161, 0.15);
    }
  }
  
  tr.not-killable {
    opacity: 0.7;
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

const DisabledButton = styled.button`
  background-color: #45475a;
  color: #cdd6f4;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: not-allowed;
  font-weight: bold;
  opacity: 0.7;
`;

const DisabledButtonLarge = styled(DisabledButton)`
  padding: 10px 15px;
  font-size: 16px;
  margin-top: 20px;
  width: 100%;
`;

const KillButtonLarge = styled(KillButton)`
  padding: 10px 15px;
  font-size: 16px;
  margin-top: 20px;
  width: 100%;
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

const ControlPanel = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
`;

const ProcessCount = styled.div`
  color: #cdd6f4;
  font-size: 14px;
`;

const KillableFilter = styled.div`
  display: flex;
  align-items: center;
  color: #cdd6f4;
  
  input {
    margin-right: 8px;
  }
  
  label {
    cursor: pointer;
  }
`;

const ProcessTip = styled.span`
  color: #89b4fa;
  font-style: italic;
`;

const KillStatus = styled.div`
  background-color: #f9e2af;
  color: #11111b;
  padding: 8px 12px;
  margin-bottom: 15px;
  border-radius: 4px;
  font-weight: bold;
`;

const KillableStatus = styled.span<{ killable: boolean }>`
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  background-color: ${props => props.killable ? 'rgba(166, 227, 161, 0.2)' : 'rgba(243, 139, 168, 0.2)'};
  color: ${props => props.killable ? '#a6e3a1' : '#f38ba8'};
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

const ProcessDetailsModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: #1e1e2e;
  border-radius: 8px;
  padding: 20px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #313244;
  padding-bottom: 10px;
  
  h3 {
    margin: 0;
    color: #cdd6f4;
    font-size: 18px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #cdd6f4;
  font-size: 24px;
  cursor: pointer;
  
  &:hover {
    color: #f38ba8;
  }
`;

const DetailItem = styled.div`
  display: flex;
  margin-bottom: 12px;
`;

const DetailLabel = styled.div`
  flex: 0 0 120px;
  font-weight: bold;
  color: #89b4fa;
`;

const DetailValue = styled.div`
  flex: 1;
  color: #cdd6f4;
`;

export default ProcessList; 