#!/bin/bash

# Change directory to the source folder
cd "$(dirname "$0")/source"

echo "========================================="
echo "   Welcome to Weekly Reporter!           "
echo "========================================="
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is missing. Attempting to install automatically via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install python
    else
        echo "Error: Python 3 is not installed and Homebrew was not found."
        echo "Please install it from https://www.python.org/downloads/"
        read -p "Press any key to exit..."
        exit 1
    fi
fi

# Set up virtual environment on first run
if [ ! -d ".venv" ]; then
    echo "First time setup detected. Creating secure virtual environment..."
    python3 -m venv .venv
fi

# Activate Environment
source .venv/bin/activate

# Install requirements (quietly to not scare the user)
echo "Ensuring all required tools are installed..."
./.venv/bin/python3 -m pip install -qr requirements.txt

# Ensure frontend is built
if [ ! -f "static/index.html" ]; then
    echo "Frontend build missing. Attempting to build..."
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        echo "Node.js is missing. Attempting to install automatically via Homebrew..."
        if command -v brew &> /dev/null; then
            brew install node
        else
            echo "Error: Node.js is not installed and Homebrew was not found."
            echo "Please install it from https://nodejs.org/"
            read -p "Press any key to exit..."
            exit 1
        fi
    fi
    
    cd frontend
    echo "Installing frontend dependencies (this may take a minute)..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: npm install failed."
        read -p "Press any key to exit..."
        exit 1
    fi
    
    echo "Building frontend..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "Error: npm run build failed."
        read -p "Press any key to exit..."
        exit 1
    fi
    
    cd ..
fi

# Start the Flask app
echo "Starting Weekly Reporter Server..."
echo "Keep this window open while using the app."
echo ""

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "Stopping server... Goodbye!"
    kill $BACKEND_PID 2>/dev/null
    # Extra safety: kill any remaining app.py processes in this directory
    pkill -f "python3 app.py" 2>/dev/null
    exit
}

# Trap SIGINT (Ctrl+C) and closed window
trap cleanup SIGINT SIGTERM EXIT

./.venv/bin/python3 app.py &
BACKEND_PID=$!

# Wait for server to boot (up to 30 seconds)
echo "Waiting for server to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while ! curl -s "http://localhost:5001" > /dev/null; do
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "Error: Server failed to start within 30 seconds."
        exit 1
    fi
done

# Open in Default Browser
echo "Opening app in your default browser..."
open "http://localhost:5001"

# Keep the script running
wait $BACKEND_PID
