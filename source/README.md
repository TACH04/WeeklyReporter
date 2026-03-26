# Weekly Reporter 🚀

An automated tool for Residential Assistants to generate and submit weekly interaction reports using local AI (Ollama).

## ✨ Features
- **Local AI**: Private and secure interaction generation via [Ollama](https://ollama.com/).
- **Smart Formatting**: Matches ASU's tracker and QuestionPro schema.
- **One-Click Automation**: Automatically fills out the QuestionPro form in Chrome using Selenium.
- **Hardware Optimized**: Recommends the best AI model (Llama 3.2 or Qwen 2.5) for your specific computer.

## 🛠️ Prerequisites
- **Google Chrome**: Required for the automation to work.
- **Python 3.10+**: Make sure Python is installed on your system.
- **Ollama**: Download and install from [ollama.com](https://ollama.com/).

## 🚀 Getting Started

> [!TIP]
> **New to Weekly Reporter?** Check out our [**Quick Start Guide**](file:///Users/tannerhochberg/Desktop/Weekly%20Reporter/QUICK_START.md) for a step-by-step walkthrough!

### Option 1: Quick Start (Recommended for Users)
1. **Download the latest release**: Get the `Weekly Reporter` folder.
2. **Launch the App**:
   - **Mac**: Double-click `Start-Mac.command`.
   - **Windows**: Double-click `Start-Windows.bat`.
3. **Follow the Wizard**: The app will open in Chrome and guide you through downloading the AI model.

### Option 2: Run from Source (For Developers)
1. **Clone the Repo**:
   ```bash
   git clone https://github.com/yourusername/weekly-reporter.git
   cd weekly-reporter
   ```
2. **Setup Backend**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   python app.py
   ```
3. **Setup Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## 📦 How to Share with Friends
To give this app to someone else, send them the folder **EXCEPT** for these files (to keep it clean):
- `.venv/` (The app will recreate this automatically)
- `weekly_reporter.db` (This contains your personal settings and data)
- any `__pycache__` folders

## 🧪 Testing a "Fresh" Experience
If you want to see what it's like for a brand-new user:
1. Delete the `weekly_reporter.db` file in the root folder.
2. Close Ollama if it's running.
3. Run the startup script for your OS.

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Developed for ASU RAs.*
