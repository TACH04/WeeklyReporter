#!/bin/bash

# Change directory to the source folder
cd "$(dirname "$0")/source"

echo "========================================="
echo "   Welcome to Weekly Reporter!           "
echo "========================================="
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed."
    echo "Please download and install it from https://www.python.org/downloads/"
    echo "Press any key to exit..."
    read -n 1
    exit 1
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
pip install -qr requirements.txt

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

python3 app.py &
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
