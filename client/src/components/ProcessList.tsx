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
  const { processList, killProcess, connectionError } = useSocket();
  const [sortField, setSortField] = useState<keyof Process>('cpu');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processList.length > 0) {
      setIsLoading(false);
      setError(null);
    }
  }, [processList]);

  useEffect(() => {
    if (connectionError) {
      setError(connectionError);
      setIsLoading(false);
    }
  }, [connectionError]);

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
      const response = await killProcess(pid);
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
      
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' 
          ? aNum - bNum 
          : bNum - aNum;
      }
      
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    });

  if (isLoading) {
    return (
      <Container>
        <LoadingMessage>Loading processes...</LoadingMessage>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorMessage>{error}</ErrorMessage>
      </Container>
    );
  }

  return (
    <Container>
      <SearchInput
        type="text"
        placeholder="Search processes..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
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
          {filteredAndSortedProcesses.map((process: Process) => (
            <tr key={process.pid}>
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
          ))}
          {filteredAndSortedProcesses.length === 0 && (
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
  padding: 1rem;
  background: #1e1e2e;
  border-radius: 8px;
  margin: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: #cdd6f4;
  font-size: 1.1rem;
`;

const ErrorMessage = styled.div`
  text-align: center;
  padding: 2rem;
  color: #f38ba8;
  font-size: 1.1rem;
  background: rgba(243, 139, 168, 0.1);
  border-radius: 4px;
  margin: 1rem;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.5rem;
  margin-bottom: 1rem;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 4px;
  color: #cdd6f4;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #89b4fa;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  color: #cdd6f4;

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #45475a;
  }

  th {
    background: #313244;
    cursor: pointer;
    user-select: none;
    font-weight: 600;

    &:hover {
      background: #45475a;
    }
  }

  tr:hover {
    background: #313244;
  }
`;

const KillButton = styled.button`
  padding: 0.25rem 0.75rem;
  background: #f38ba8;
  color: #1e1e2e;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;

  &:hover {
    background: #f5c2e7;
  }
`;

export default ProcessList; 