@echo off
echo Starting Elevateher Python Backend (Demo Mode)...
cd services
call ..\.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000
