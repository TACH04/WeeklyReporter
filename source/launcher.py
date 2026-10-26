import os
import sys
import subprocess
import venv

def get_base_dir():
    # If run as a script, this is the directory containing launcher.py
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
VENV_DIR = os.path.join(BASE_DIR, ".venv")

if os.name == 'nt': # Windows
    VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe")
else:
    VENV_PYTHON = os.path.join(VENV_DIR, "bin", "python")

def print_step(msg):
    print(f"\n[*] {msg}")

def print_error(msg):
    print(f"\n[!] ERROR: {msg}")

def ensure_venv():
    if not os.path.exists(VENV_DIR):
        print_step("Prerequisites not found. Creating virtual environment...")
        try:
            # Create a virtual environment with pip
            venv.create(VENV_DIR, with_pip=True)
        except Exception as e:
            print_error(f"Failed to create virtual environment: {e}")
            sys.exit(1)
        print("Virtual environment created successfully.")
    else:
        print_step("Virtual environment found.")

def install_dependencies():
    req_file = os.path.join(BASE_DIR, "requirements.txt")
    if not os.path.exists(req_file):
        print_error(f"requirements.txt not found in {BASE_DIR}")
        sys.exit(1)

    print_step("Verifying dependencies...")
    try:
        subprocess.check_call(
            [VENV_PYTHON, "-m", "pip", "install", "-q", "-r", req_file],
            cwd=BASE_DIR
        )
    except subprocess.CalledProcessError as e:
        print_error(f"Failed to install dependencies: {e}")
        sys.exit(1)
    print("Dependencies are up to date.")

def verify_frontend():
    print_step("Verifying frontend assets...")
    index_file = os.path.join(BASE_DIR, "static", "index.html")
    if not os.path.exists(index_file):
        print_error(f"Frontend assets not found: {index_file}")
        print("The application appears to be incomplete. Please make sure the 'static' folder exists inside 'source'.")
        sys.exit(1)
    print("Frontend assets found.")

def start_server():
    print_step("Starting Weekly Reporter Server...")
    print("Keep this window open while using the application. You can close it to stop the server.")
    
    app_script = os.path.join(BASE_DIR, "app.py")
    
    try:
        # Run the server. app.py handles port binding and opening the browser.
        subprocess.check_call([VENV_PYTHON, app_script], cwd=BASE_DIR)
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
    except subprocess.CalledProcessError:
        print_error("Server crashed or failed to start.")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error when starting the server: {e}")
        sys.exit(1)

def main():
    print("=========================================")
    print("    Weekly Reporter Application")
    print("=========================================")
    
    ensure_venv()
    install_dependencies()
    verify_frontend()
    start_server()

if __name__ == '__main__':
    main()
