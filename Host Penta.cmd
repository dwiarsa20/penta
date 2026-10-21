@echo off
rem Double-click to host Penta from this computer. Friends join with the link it shows.
title Penta host
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed. Download the LTS version from https://nodejs.org,
  echo install it, then double-click this file again.
  pause
  exit /b 1
)

rem If this is a git copy, get the latest version first.
if exist .git (
  where git >nul 2>nul
  if not errorlevel 1 (
    echo Getting the latest version...
    git pull --ff-only
    if errorlevel 1 echo Couldn't update, so starting the version you have.
  )
)

echo Installing what Penta needs. This is quick after the first time...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo Installing failed. Check your internet connection and try again.
  pause
  exit /b 1
)

call npm run host
pause
