import React from 'react';
import styled from 'styled-components';
import { SystemInfo as SystemInfoType } from '../hooks/useSocket';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Props {
  systemInfo: SystemInfoType | null;
}

// Component for CPU and memory usage history
const SystemInfo: React.FC<Props> = ({ systemInfo }) => {
  const [cpuHistory, setCpuHistory] = React.useState<number[]>(Array(30).fill(0));
  const [memoryHistory, setMemoryHistory] = React.useState<number[]>(Array(30).fill(0));
  
  React.useEffect(() => {
    if (systemInfo) {
      // Update CPU history
      setCpuHistory(prev => {
        const newHistory = [...prev, parseFloat(systemInfo.cpu.load)];
        if (newHistory.length > 30) {
          newHistory.shift();
        }
        return newHistory;
      });
      
      // Update memory history
      setMemoryHistory(prev => {
        const newHistory = [...prev, parseFloat(systemInfo.memory.usedPercent)];
        if (newHistory.length > 30) {
          newHistory.shift();
        }
        return newHistory;
      });
    }
  }, [systemInfo]);

  // Labels for chart (last 30 seconds)
  const labels = Array.from({ length: 30 }, (_, i) => `${-29 + i}s`);
  
  // CPU chart data
  const cpuData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'CPU Usage %',
        data: cpuHistory,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.3,
      },
    ],
  };
  
  // Memory chart data
  const memoryData: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Memory Usage %',
        data: memoryHistory,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.3,
      },
    ],
  };
  
  // Chart options
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
      },
    },
  };

  return (
    <Container>
      <Header>System Information</Header>
      
      {systemInfo ? (
        <>
          <InfoGrid>
            <InfoCard>
              <CardTitle>CPU Usage</CardTitle>
              <CardValue>{systemInfo.cpu.load}%</CardValue>
              <ChartContainer>
                <Line options={options} data={cpuData} />
              </ChartContainer>
            </InfoCard>
            
            <InfoCard>
              <CardTitle>Memory Usage</CardTitle>
              <CardValue>{systemInfo.memory.usedPercent}%</CardValue>
              <MemoryDetail>
                {formatBytes(systemInfo.memory.used)} / {formatBytes(systemInfo.memory.total)}
              </MemoryDetail>
              <ChartContainer>
                <Line options={options} data={memoryData} />
              </ChartContainer>
            </InfoCard>
          </InfoGrid>
          
          <CoresContainer>
            <CardTitle>CPU Cores</CardTitle>
            <CoresGrid>
              {systemInfo.cpu.cores.map((core, index) => (
                <CoreCard key={index}>
                  <CoreTitle>Core {index}</CoreTitle>
                  <CoreValue>{core.load}%</CoreValue>
                  <ProgressBar>
                    <Progress width={parseFloat(core.load)} />
                  </ProgressBar>
                </CoreCard>
              ))}
            </CoresGrid>
          </CoresContainer>
        </>
      ) : (
        <LoadingMessage>Loading system information...</LoadingMessage>
      )}
    </Container>
  );
};

// Helper function to format bytes to human-readable format
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Styled components
const Container = styled.div`
  background-color: #1e1e2e;
  border-radius: 8px;
  padding: 16px;
  color: #cdd6f4;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Header = styled.h2`
  margin-top: 0;
  margin-bottom: 16px;
  color: #cdd6f4;
  font-size: 1.5rem;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const InfoCard = styled.div`
  background-color: #11111b;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const CardTitle = styled.h3`
  margin-top: 0;
  margin-bottom: 8px;
  color: #cdd6f4;
  font-size: 1rem;
`;

const CardValue = styled.div`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 8px;
  color: #89b4fa;
`;

const MemoryDetail = styled.div`
  font-size: 0.9rem;
  color: #bac2de;
  margin-bottom: 16px;
`;

const ChartContainer = styled.div`
  height: 200px;
`;

const CoresContainer = styled.div`
  background-color: #11111b;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const CoresGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const CoreCard = styled.div`
  background-color: #181825;
  border-radius: 6px;
  padding: 12px;
`;

const CoreTitle = styled.div`
  font-size: 0.9rem;
  margin-bottom: 8px;
  color: #bac2de;
`;

const CoreValue = styled.div`
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 8px;
  color: #89b4fa;
`;

const ProgressBar = styled.div`
  height: 8px;
  width: 100%;
  background-color: #313244;
  border-radius: 4px;
  overflow: hidden;
`;

const Progress = styled.div<{ width: number }>`
  height: 100%;
  width: ${props => `${props.width}%`};
  background-color: #89b4fa;
  border-radius: 4px;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 32px;
  color: #bac2de;
  font-style: italic;
`;

export default SystemInfo; 