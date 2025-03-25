# Setup Instructions for Process Monitoring Dashboard

This guide will help you set up and run the Real-Time Process Monitoring Dashboard application.

## Prerequisites

Ensure you have the following software installed on your system:

- Node.js (v14 or later)
- npm (v6 or later)

## Step 1: Install Server Dependencies

First, install the dependencies for the server application:

```bash
# In the project root directory
npm install
```

This will install packages like Express, Socket.IO, and systeminformation that are needed for the server.

## Step 2: Install Client Dependencies

Next, install the dependencies for the React client application:

```bash
# Navigate to the client directory
cd client

# Install dependencies
npm install

# Return to the project root
cd ..
```

This will install React, TypeScript, Styled Components, Chart.js, and other necessary packages.

## Step 3: Running the Application

### Development Mode

To run both the server and client applications in development mode:

```bash
# In the project root directory
npm run dev
```

This uses concurrently to start both the server and client processes:
- The server will run on http://localhost:5000
- The client will run on http://localhost:3000

### Running Server and Client Separately

If you prefer to run the server and client in separate terminal windows:

#### Server:
```bash
# In the project root directory
npm run server
```

#### Client:
```bash
# In a new terminal window
cd client
npm start
```

## Step 4: Accessing the Dashboard

Open your web browser and navigate to:

```
http://localhost:3000
```

The dashboard should connect to the server automatically and display real-time system information and process data.

## Troubleshooting

### Socket Connection Issues

If the client cannot connect to the server:

1. Make sure you have all dependencies installed in both the root directory and the client directory
2. Check that both server and client are running
3. Verify the server is running on port 5000
4. Check for any CORS errors in the browser console
5. Ensure no firewall is blocking the connection

### Permission Issues

When trying to kill processes:

1. On Windows, the application might need to be run as Administrator (right-click on Command Prompt/PowerShell and select "Run as Administrator")
2. On Linux/Mac, the application might need sudo privileges
3. Some system processes cannot be terminated by regular users

### Module Not Found Errors

If you encounter module not found errors:

1. Make sure you've installed all dependencies with `npm install` in both root and client directories
2. Try deleting the node_modules folder and package-lock.json in both directories
3. Run `npm install` again in both locations
4. Restart the application

### Event Name Mismatches

If you're seeing connected status but no data appears:

1. Check the browser console for errors
2. Make sure the event names in the server match those expected by the client
3. Verify that the data structure sent by the server matches what the client expects

## Building for Production

To create a production build:

```bash
# In the project root directory
npm run build-client
```

To run the production build:

```bash
# In the project root directory
NODE_ENV=production npm start
```

The application will be available at http://localhost:5000 