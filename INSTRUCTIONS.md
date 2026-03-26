# Weekly Reporter Instructions

Welcome to **Weekly Reporter**! This application helps you manage resident interactions and generate reports using AI.

## 🚀 How to Start

### On macOS
1. Open the `Weekly Reporter` folder.
2. Double-click **`start_mac.command`**.
   - *Note: The first time you run this, it will set up a secure environment. This may take a minute.*

### On Windows
1. Open the `Weekly Reporter` folder.
2. Double-click **`start_win.bat`**.
   - *Note: Keep the terminal window open while you use the app.*

---

## 📋 Using the Excel Tracker

The application automatically reads data from your Excel tracker.
- Ensure your tracker is named something recognizable (e.g., `Tanners tracker.xlsx`) and is located inside the `source` folder.
- The app will intelligently map columns like "ASU ID", "First Name", and "Last Name".

---

## 🛠 Troubleshooting

- **Server won't start:** Ensure you have Python 3 installed.
- **Frontend not visible:** If the web app shows an error about a missing build, ensure you have **Node.js** installed. The startup script will try to build it for you on the first run.
- **Port 5001 is busy:** Close any other instances of Weekly Reporter or other apps using that port.
- **AI not responding:** Ensure Ollama is installed and running on your machine.

---

> [!TIP]
> You can export this file to **PDF** by opening it in a Markdown editor or using "Print to PDF" in your browser if viewing on GitHub.
