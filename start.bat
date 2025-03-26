@echo off
echo ===================================================
echo   Real-Time Process Monitoring Dashboard Launcher
echo ===================================================

:: Check for Admin rights
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if %errorLevel% NEQ 0 (
    echo ERROR: Administrator privileges are required to access process information.
    echo Please right-click on this batch file and select "Run as administrator"
    echo.
    pause
    exit /B 1
)

echo Running with administrator privileges - OK
echo.

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing server dependencies...
    call npm install
    if %errorLevel% NEQ 0 (
        echo Error installing server dependencies.
        pause
        exit /B 1
    )
)

:: Check if client dependencies are installed
if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
    if %errorLevel% NEQ 0 (
        echo Error installing client dependencies.
        pause
        exit /B 1
    )
)

echo.
echo Starting server and client...
echo.
echo NOTE: The server will run on port 3000

:: Start the server separately
echo Starting server in a new window...
start "Process Monitor Server" cmd /k "npm run server"

:: Wait a bit for the server to start
timeout /t 3 /nobreak

:: Start the client
echo Starting client...
cd client
start "Process Monitor Client" cmd /k "npm run start"
cd ..

echo.
echo Both server and client are now running.
echo To close everything, please close the command windows.
echo.
pause 