@echo off
echo ============================================
echo   AI Knowledge Assistant - Setup Script
echo ============================================

echo.
echo [1/4] Setting up Backend...
cd backend

if not exist venv (
    python -m venv venv
    echo Virtual environment created.
)

call venv\Scripts\activate

pip install -r requirements.txt

if not exist .env (
    copy .env.example .env
    echo .env file created. Please edit backend\.env with your settings.
)

echo Backend setup complete!
cd ..

echo.
echo [2/4] Setting up Frontend...
cd frontend

npm install

if not exist .env (
    copy .env.example .env
)

echo Frontend setup complete!
cd ..

echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Edit backend\.env and add your OPENAI_API_KEY and DATABASE_URL
echo 2. Make sure MySQL is running and database 'ai_knowledge_db' exists
echo 3. Run start_backend.bat to start the API
echo 4. Run start_frontend.bat to start the React app
echo.
pause
