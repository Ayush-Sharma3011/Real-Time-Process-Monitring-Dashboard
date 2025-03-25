# Process Monitor Server

Backend for the Real-Time Process Monitoring Dashboard.

## Features

- Real-time CPU usage monitoring
- Real-time memory usage statistics
- Process list with sorting by resource usage
- Process termination capability
- WebSocket communication for real-time updates

## Requirements

- Node.js 14.x or higher
- npm or yarn

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Development mode:
   ```
   npm run dev
   ```

3. Build for production:
   ```
   npm run build
   ```

4. Start production server:
   ```
   npm start
   ```

## API Endpoints

- `GET /api/health` - Check server health

## WebSocket Events

### Server to Client
- `system-info` - CPU and memory information
- `process-list` - List of running processes
- `kill-process-response` - Response after kill process attempt

### Client to Server
- `kill-process` - Request to terminate a process

## Environment Variables

- `PORT` - Server port (default: 5000) 