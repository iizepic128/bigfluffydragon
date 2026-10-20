@echo off
setlocal EnableExtensions
title JoJo Journey - Open in Opera

if not exist "%~dp0JoJo-Journey.html" (
  echo Extract the entire ZIP first, then run Open in Opera.cmd from the extracted folder.
  pause
  exit /b 1
)

for %%P in (
  "%LOCALAPPDATA%\Programs\Opera\opera.exe"
  "%LOCALAPPDATA%\Programs\Opera\launcher.exe"
  "%LOCALAPPDATA%\Programs\Opera GX\opera.exe"
  "%LOCALAPPDATA%\Programs\Opera GX\launcher.exe"
  "%ProgramFiles%\Opera\opera.exe"
  "%ProgramFiles%\Opera\launcher.exe"
  "%ProgramFiles%\Opera GX\opera.exe"
  "%ProgramFiles%\Opera GX\launcher.exe"
  "%ProgramFiles(x86)%\Opera\opera.exe"
  "%ProgramFiles(x86)%\Opera\launcher.exe"
) do if exist "%%~P" (
  start "" "%%~P" "%~dp0JoJo-Journey.html"
  exit /b 0
)

echo Opera was not found in its usual installation folders.
echo Open Opera or Opera GX, press Ctrl+O, and select:
echo "%~dp0JoJo-Journey.html"
echo.
echo No installation, terminal server, or Internet connection is needed for the preview.
pause
