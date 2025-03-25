@echo off
echo ======================================================
echo   Real-Time Process Monitoring Dashboard - Startup
echo ======================================================
echo.

echo Installing server dependencies...
npm install

echo.
echo Installing client dependencies...
cd client
npm install
cd ..

echo.
echo Starting server and client...
echo ======================================================
echo.
echo Press Ctrl+C to stop all processes.
echo.

npm run dev 