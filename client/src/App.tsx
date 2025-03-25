import React from 'react';
import styled from 'styled-components';
import SystemInfo from './components/SystemInfo';
import ProcessList from './components/ProcessList';
import useSocket from './hooks/useSocket';

const App: React.FC = () => {
  const { systemInfo, connectionError } = useSocket();

  return (
    <Container>
      <Header>
        <Title>Process Monitor</Title>
      </Header>

      {connectionError && (
        <ErrorBanner>
          {connectionError}
          <br />
          Please make sure the server is running on port 3001
        </ErrorBanner>
      )}

      <MainContent>
        <SystemInfo systemInfo={systemInfo} />
        <ProcessList />
      </MainContent>

      <Footer>
        <FooterText>Real-Time Process Monitoring Dashboard</FooterText>
      </Footer>
    </Container>
  );
};

const Container = styled.div`
  min-height: 100vh;
  background: #11111b;
  color: #cdd6f4;
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  background: #1e1e2e;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  color: #89b4fa;
`;

const MainContent = styled.main`
  flex: 1;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Footer = styled.footer`
  background: #1e1e2e;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
`;

const FooterText = styled.p`
  margin: 0;
  color: #6c7086;
  font-size: 0.9rem;
`;

const ErrorBanner = styled.div`
  background: #f38ba8;
  color: #1e1e2e;
  padding: 1rem;
  margin: 1rem;
  border-radius: 4px;
  text-align: center;
  font-weight: 600;
`;

export default App; 