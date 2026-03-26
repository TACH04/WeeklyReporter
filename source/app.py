from flask import Flask, jsonify, request, send_from_directory, Response, stream_with_context
from flask_cors import CORS
import os
import json
from database import get_db
from ollama_client import OllamaClient
from data_sync import sync_data, sync_paste

# Point Flask to the 'static' folder which Vite will build into
app = Flask(__name__, static_folder="static", static_url_path="/")
CORS(app)

ollama = OllamaClient()

# --- REACT APP SERVING ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Only serve the file if it exists in the static folder
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    # Otherwise, fallback to index.html for React Router
    elif os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
    else:
        return jsonify({"error": "Frontend build not found. Please run 'npm run build' in the frontend directory."}), 404

# --- API ENDPOINTS ---

@app.route('/api/residents', methods=['GET'])
def get_residents():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM residents")
    residents_rows = cursor.fetchall()
    
    residents = []
    for r in residents_rows:
        resident_dict = dict(r)
        # Fetch interactions with IDs so they can be edited/deleted
        cursor.execute("SELECT id, content, timestamp FROM interactions WHERE asu_id = ? ORDER BY timestamp DESC", (r['asu_id'],))
        interactions = [dict(row) for row in cursor.fetchall()]
        resident_dict['past_interactions'] = interactions
        residents.append(resident_dict)
        
    conn.close()
    return jsonify(residents)

@app.route('/api/residents', methods=['POST'])
def add_resident():
    data = request.json
    asu_id = data.get('asu_id')
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    room = data.get('room')
    
    if not asu_id:
        return jsonify({"error": "ASU ID is required"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO residents (asu_id, first_name, last_name, email, room) VALUES (?, ?, ?, ?, ?)",
            (asu_id, first_name, last_name, email, room)
        )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
        
    conn.close()
    return jsonify({"success": True, "message": "Resident added successfully"})

@app.route('/api/residents/<asu_id>', methods=['PUT'])
def update_resident(asu_id):
    data = request.json
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    room = data.get('room')
    new_asu_id = data.get('asu_id') # In case they change the ID
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        if new_asu_id and new_asu_id != asu_id:
            # Check if new ID already exists
            cursor.execute("SELECT asu_id FROM residents WHERE asu_id = ?", (new_asu_id,))
            if cursor.fetchone():
                conn.close()
                return jsonify({"error": "New ASU ID already exists"}), 400
            
            # Update resident and rely on ON UPDATE CASCADE if it existed, but we don't have FK constraints with CASCADE currently
            # So we manually update interactions too
            cursor.execute(
                "UPDATE residents SET asu_id = ?, first_name = ?, last_name = ?, email = ?, room = ? WHERE asu_id = ?",
                (new_asu_id, first_name, last_name, email, room, asu_id)
            )
            cursor.execute("UPDATE interactions SET asu_id = ? WHERE asu_id = ?", (new_asu_id, asu_id))
        else:
            cursor.execute(
                "UPDATE residents SET first_name = ?, last_name = ?, email = ?, room = ? WHERE asu_id = ?",
                (first_name, last_name, email, room, asu_id)
            )
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
        
    conn.close()
    return jsonify({"success": True, "message": "Resident updated successfully"})

@app.route('/api/residents/<asu_id>', methods=['DELETE'])
def delete_resident(asu_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Delete interactions first if no CASCADE
        cursor.execute("DELETE FROM interactions WHERE asu_id = ?", (asu_id,))
        cursor.execute("DELETE FROM residents WHERE asu_id = ?", (asu_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    conn.close()
    return jsonify({"success": True, "message": "Resident and their interactions deleted"})

@app.route('/api/interactions/<int:interaction_id>', methods=['PUT'])
def update_interaction(interaction_id):
    data = request.json
    content = data.get('content')
    
    if not content:
        return jsonify({"error": "Content is required"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE interactions SET content = ? WHERE id = ?", (content, interaction_id))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    conn.close()
    return jsonify({"success": True})

@app.route('/api/interactions/<int:interaction_id>', methods=['DELETE'])
def delete_interaction(interaction_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM interactions WHERE id = ?", (interaction_id,))
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    conn.close()
    return jsonify({"success": True})

@app.route('/api/setup/delete', methods=['POST'])
def delete_model():
    model_name = request.json.get('model_name')
    if not model_name:
        return jsonify({"error": "No model name provided"}), 400
    
    success = ollama.delete_model(model_name)
    if success:
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Failed to delete model"}), 500

@app.route('/api/generate', methods=['POST'])
def generate_interaction():
    data = request.json
    asu_id = data.get('asu_id')
    topic = data.get('topic', '')
    
    # Check if a specific model was requested via settings
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'llm_model'")
    custom_model = cursor.fetchone()
    
    if custom_model:
        ollama.model = custom_model['value']
        
    cursor.execute("SELECT * FROM residents WHERE asu_id = ?", (asu_id,))
    resident = cursor.fetchone()
    
    if not resident:
        conn.close()
        return jsonify({"error": "Resident not found"}), 404
        
    cursor.execute("SELECT content FROM interactions WHERE asu_id = ? ORDER BY timestamp ASC", (asu_id,))
    past_interactions = [row['content'] for row in cursor.fetchall()]
    conn.close()
        
    interaction = ollama.generate_interaction(
        f"{resident['first_name']} {resident['last_name']}",
        past_interactions,
        topic
    )
    
    return jsonify({
        "asu_id": asu_id,
        "interaction": interaction
    })

# --- SETUP WIZARD ENDPOINTS ---

@app.route('/api/setup/status', methods=['GET'])
def get_setup_status():
    """Returns Ollama status, installed models, and user profile status."""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT key, value FROM settings")
    settings = {row['key']: row['value'] for row in cursor.fetchall()}
    conn.close()
    
    is_ollama_running = ollama.check_ollama()
    installed_models = ollama.get_installed_models() if is_ollama_running else []
    
    return jsonify({
        "ollama_running": is_ollama_running,
        "installed_models": installed_models,
        "settings": settings,
        "setup_complete": settings.get('setup_complete') == 'true' or settings.get('setup_complete') is True
    })

@app.route('/api/setup/hardware', methods=['GET'])
def check_hardware():
    import psutil
    
    ram_gb = psutil.virtual_memory().total / (1024**3)
    
    # Recommendation Logic
    recommendation = "Low"
    model_name = "qwen2.5:0.5b"
    
    if ram_gb >= 16:
        recommendation = "High"
        model_name = "llama3.2:3b"
    elif ram_gb >= 8:
        recommendation = "Medium"
        model_name = "llama3.2:1b"
        
    return jsonify({
        "ram_gb": round(ram_gb, 2),
        "recommendation_level": recommendation,
        "recommended_model": model_name
    })
    
@app.route('/api/setup/save', methods=['POST'])
def save_setup():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    for key, value in data.items():
        cursor.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, str(value))
        )
    conn.commit()
    conn.close()
    return jsonify({"success": True})
    
@app.route('/api/setup/pull/stream')
def pull_model_stream():
    model_name = request.args.get('model_name')
    if not model_name:
        return jsonify({"error": "No model name provided"}), 400

    def generate():
        # First, send an optional 'starting' status
        yield f"data: {json.dumps({'status': 'starting', 'progress': 0})}\n\n"
        
        response = ollama.pull_model(model_name, stream=True)
        if not response:
            yield f"data: {json.dumps({'status': 'error', 'message': 'Failed to start pull'})}\n\n"
            return

        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    status = data.get('status', 'downloading')
                    completed = data.get('completed', 0)
                    total = data.get('total', 0)
                    
                    progress = 0
                    if total > 0:
                        progress = round((completed / total) * 100, 1)
                    
                    # Yield SSE format
                    yield f"data: {json.dumps({'status': status, 'progress': progress})}\n\n"
                    
                    if status == 'success':
                        break
                except Exception as e:
                    print(f"Error parsing Ollama stream: {e}")
                    continue

    return Response(stream_with_context(generate()), content_type='text/event-stream')

@app.route('/api/setup/pull', methods=['POST'])
def pull_model():
    model_name = request.json.get('model_name')
    if not model_name:
        return jsonify({"error": "No model name provided"}), 400
        
    success = ollama.pull_model(model_name)
    if success:
        return jsonify({"success": True, "message": f"Successfully pulled {model_name}"})
    else:
        return jsonify({"success": False, "error": f"Failed to pull {model_name}"}), 500

# --- DATA SYNC ENDPOINTS ---

@app.route('/api/sync', methods=['POST'])

def run_sync():
    """Triggers the Excel data sync. Accepts an uploaded file."""
    file = request.files.get('file')
    sheet_name = request.form.get('sheet_name') or request.json.get('sheet_name') if request.is_json else request.form.get('sheet_name')
    
    if file:
        # Synchronously sync with the uploaded file buffer
        result = sync_data(file, sheet_name=sheet_name)
    else:
        # Fallback to automatic discovery if no file is uploaded
        result = sync_data(sheet_name=sheet_name)
        
    if result.get("success"):
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@app.route('/api/sync/paste', methods=['POST'])
def run_sync_paste():
    """Triggers the Excel data sync from pasted text."""
    data = request.json
    paste_text = data.get('text')
    if not paste_text:
        return jsonify({"success": False, "error": "No text provided"}), 400
        
    result = sync_paste(paste_text)
    
    if result.get("success"):
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@app.route('/api/data', methods=['GET'])
def get_all_data():
    """Returns all resident data for the Sync page table."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM residents")
    residents_rows = cursor.fetchall()
    
    residents = []
    for r in residents_rows:
        resident_dict = dict(r)
        # Fetch interactions with IDs so they can be edited/deleted
        cursor.execute("SELECT id, content, timestamp FROM interactions WHERE asu_id = ? ORDER BY timestamp DESC", (r['asu_id'],))
        resident_dict['past_interactions'] = [dict(row) for row in cursor.fetchall()]
        residents.append(resident_dict)
        
    conn.close()
    return jsonify(residents)

@app.route('/api/export', methods=['GET'])
def get_export_data():
    """Returns data formatted as TSV for easy pasting into Excel, matching the tracker schema without status flags."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM residents")
    residents_rows = cursor.fetchall()
    
    # Header with 3 side-by-side interaction columns
    header = [
        "ASU ID", "Last Name", "First Name", "Email", "Room",
        "Interaction 1", "Interaction 2", "Interaction 3"
    ]
    
    tsv_rows = ["\t".join(header)]
    
    for r in residents_rows:
        r_dict = dict(r)
        cursor.execute("SELECT content FROM interactions WHERE asu_id = ? ORDER BY timestamp ASC", (r_dict['asu_id'],))
        interactions = [row['content'] for row in cursor.fetchall()]
        
        # Build the row
        row = [
            str(r_dict.get('asu_id', '')),
            r_dict.get('last_name', '') or '',
            r_dict.get('first_name', '') or '',
            r_dict.get('email', '') or '',
            r_dict.get('room', '') or ''
        ]
        
        # Add 3 side-by-side interaction columns
        for i in range(3):
            if i < len(interactions):
                row.append(interactions[i])
            else:
                row.append("")
        
        tsv_rows.append("\t".join(row))
        
    conn.close()
    
    return jsonify({
        "text": "\n".join(tsv_rows),
        "filename": "weekly_reporter_export.txt"
    })

import threading

def run_automation(asu_id, interactions, feedback):
    from automation.submitter import QuestionProSubmitter
    print(f"Starting background automation for ASU ID: {asu_id}")
    try:
        submitter = QuestionProSubmitter(headless=False)
        print("Submitter initialized. Filling report...")
        submitter.fill_report(asu_id, interactions, feedback)
        print("Automation filling complete. Leaving browser open for manual review.")
    except Exception as e:
        print(f"Error in background automation: {e}")
        import traceback
        traceback.print_exc()

@app.route('/api/submit', methods=['POST'])
def submit_report():
    data = request.json
    print(f"Received submit request: {data}")
    asu_id = data.get('asu_id', "1234567890")
    interactions = data.get('interactions', [])
    feedback = data.get('feedback', {})
    
    # Run automation in a separate thread so it doesn't block the Flask response
    thread = threading.Thread(target=run_automation, args=(asu_id, interactions, feedback))
    thread.start()
    
    return jsonify({"message": "Automation started in a separate window. Please check your taskbar."})

@app.route('/api/save', methods=['POST'])
def save_interactions():
    data = request.json
    interactions = data.get('interactions', [])
    
    conn = get_db()
    cursor = conn.cursor()
    
    saved_count = 0
    for item in interactions:
        resident_id = item.get('asu_id')
        summary = item.get('summary')
        if resident_id and summary:
            # Insert the interaction into the interactions table
            cursor.execute(
                "INSERT INTO interactions (asu_id, content) VALUES (?, ?)",
                (resident_id, summary)
            )
            saved_count += 1
            
    conn.commit()
    conn.close()
                
    return jsonify({
        "message": f"Successfully saved {saved_count} interactions to the database.", 
        "saved_count": saved_count
    })

if __name__ == '__main__':
    app.run(debug=True, port=5001)
