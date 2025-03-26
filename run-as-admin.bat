@echo off
echo ===================================================
echo   Process Monitoring Dashboard - Admin Launcher
echo ===================================================

:: Check for Admin rights
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if %errorLevel% NEQ 0 (
    echo Administrator privileges are required to access process information.
    echo Requesting elevation...
    
    :: Request elevation through PowerShell
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%~dp0\" && npm run server' -Verb RunAs" 
    exit /b
) else (
    echo Running with administrator privileges - OK
    echo.
    echo Starting server on port 3000...
    echo.
    npm run server
) 