# Real-Time Process Monitoring Dashboard

A web application that provides real-time monitoring of system resources and processes. This dashboard allows users to view CPU usage, memory consumption, and a list of running processes with the ability to terminate them.

## Features

- Real-time system information monitoring
  - CPU usage with per-core details
  - Memory usage statistics
  - Dynamic charts showing usage history
- Process management
  - List of all running processes
  - Search functionality for processes
  - Sorting by different metrics (CPU, memory, etc.)
  - Process termination capabilities
- Real-time updates via WebSocket connection

## Project Structure

The project consists of two main parts:

1. **Server**: A Node.js backend that collects system information and process data
2. **Client**: A React frontend for displaying the data in a user-friendly dashboard

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/process-monitoring-dashboard.git
   cd process-monitoring-dashboard
   ```

2. Install server dependencies
   ```
   npm install
   ```

3. Install client dependencies
   ```
   cd client
   npm install
   ```

### Running the Application

1. Start the server
   ```
   npm run start
   ```

2. In a separate terminal, start the client
   ```
   cd client
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

## Technologies Used

### Backend
- Node.js
- Express
- Socket.io
- systeminformation library

### Frontend
- React
- TypeScript
- Styled Components
- Chart.js
- Socket.io Client

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [systeminformation](https://github.com/sebhildebrandt/systeminformation) for system data collection
- [Chart.js](https://www.chartjs.org/) for visualization 