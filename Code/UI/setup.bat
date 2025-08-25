@echo off
echo Installing Python dependencies for backend...
cd /d "backend"

@REM activate virtual env
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo Installing Node.js dependencies for frontend...
cd /d "../frontend"
npm install

echo.
echo Setup complete! 
echo.
echo To start the application:
echo 1. Start backend: run "start_backend.bat"
echo 2. Start frontend: run "start_frontend.bat"
echo 3. Open http://localhost:3000 in your browser
pause
