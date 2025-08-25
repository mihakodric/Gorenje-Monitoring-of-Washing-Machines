@echo off
echo Starting FastAPI Backend Server...
cd /d "backend"
call venv\Scripts\activate.bat
python api_server.py
