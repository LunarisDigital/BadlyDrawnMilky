@echo off
cd /d "%~dp0"
echo Starting local preview server for BadlyDrawnMilky...
echo Once it starts, open the http://localhost address it prints in your browser.
echo Press Ctrl+C to stop the server when you're done.
npx --yes serve -l 5500 .
