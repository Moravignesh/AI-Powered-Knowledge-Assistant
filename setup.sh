#!/bin/bash
set -e

echo "============================================"
echo "  AI Knowledge Assistant - Setup Script"
echo "============================================"

echo ""
echo "[1/4] Setting up Backend..."
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env created. Edit backend/.env with your settings."
fi

cd ..

echo ""
echo "[2/4] Setting up Frontend..."
cd frontend

npm install

if [ ! -f .env ]; then
    cp .env.example .env
fi

cd ..

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env — add OPENAI_API_KEY and DATABASE_URL"
echo "  2. Start backend:  cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "  3. Start frontend: cd frontend && npm run dev"
