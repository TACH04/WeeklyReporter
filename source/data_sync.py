import os
import glob
import pandas as pd
from database import get_db
import math
from datetime import datetime
import math
import re

def detect_column_mapping(df):
    """
    Intelligently maps DataFrame columns to expected database fields.
    Returns: mapping dict, header_row_index (or None)
    """
    mapping = {
        'asu_id': None,
        'first_name': None,
        'last_name': None,
        'email': None,
        'room': None,
        'interactions': []
    }
    
    header_row_idx = None
    ignored_cols = set()
    # 1. Search for a header row in the first 10 rows
    for idx, row in df.head(10).iterrows():
        row_str = " ".join([str(val).lower() for val in row if not pd.isna(val)])
        if ('name' in row_str or 'email' in row_str) and ('id' in row_str or 'interaction' in row_str or 'room' in row_str or 'code' in row_str):
            header_row_idx = idx
            break
            
    if header_row_idx is not None:
        row = df.iloc[header_row_idx]
        for col_idx, val in enumerate(row):
            if pd.isna(val):
                continue
            val_str = str(val).lower().strip()
            
            if 'email' in val_str:
                mapping['email'] = col_idx
            elif 'room' in val_str or 'code' in val_str:
                mapping['room'] = col_idx
            elif 'first name' in val_str or 'first' in val_str or 'given' in val_str:
                mapping['first_name'] = col_idx
            elif 'last name' in val_str or 'last' in val_str or 'surname' in val_str:
                mapping['last_name'] = col_idx
            elif 'name' in val_str and mapping['first_name'] is None and mapping['last_name'] is None:
                mapping['first_name'] = col_idx
            elif 'id' in val_str and 'empid' in val_str:
                mapping['asu_id'] = col_idx
            elif 'id' in val_str.split():
                mapping['asu_id'] = col_idx
            elif 'interaction' in val_str or 'notes' in val_str:
                mapping['interactions'].append(col_idx)
            # Explicitly IGNORE academic fields so they don't get sucked into interactions
            elif any(k in val_str for k in ['major', 'degree', 'program', 'plan', 'concentration', 'college']):
                ignored_cols.add(col_idx)
                continue
                
    # 2. Data profiling fallback
    start_idx = (header_row_idx + 1) if header_row_idx is not None else 0
    sample_df = df.iloc[start_idx:].dropna(how='all')
    
    if not sample_df.empty:
        for col_idx in df.columns:
            col_data = sample_df[col_idx].dropna().astype(str)
            if col_idx in ignored_cols:
                continue

            if mapping['asu_id'] is None:
                digits_only = col_data.str.replace(r'\.0$', '', regex=True)
                if digits_only.str.match(r'^\d{9,10}$').mean() > 0.5:
                    mapping['asu_id'] = col_idx
                    
            if mapping['email'] is None:
                if col_data.str.contains(r'@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', regex=True).mean() > 0.5:
                    mapping['email'] = col_idx
                    
            if mapping['room'] is None:
                if col_data.str.contains(r'^[A-Z]+-\d+').mean() > 0.3 or col_data.str.contains(r'\w+-\w+').mean() > 0.3:
                    mapping['room'] = col_idx
                    
            if col_idx not in mapping.values() and col_idx not in mapping['interactions']:
                # Major names (25-35 chars) can look like short interactions.
                # Actual interactions are almost always sentences or paragraphs (usually >60 chars)
                # and tend to have common punctuations.
                mean_len = col_data.str.len().mean()
                if mean_len > 60:
                    mapping['interactions'].append(col_idx)

    if mapping['asu_id'] is None: mapping['asu_id'] = 0
    if mapping['last_name'] is None: mapping['last_name'] = 1
    if mapping['first_name'] is None: mapping['first_name'] = 2
    if mapping['email'] is None: mapping['email'] = 3
    if mapping['room'] is None: mapping['room'] = 4
    # Removed hardcoded fallback [6, 8, 10] for interactions to prevent mis-mapping
    # if not mapping['interactions']: 
    #     mapping['interactions'] = [6, 8, 10]
        
    assigned_cols = set()
    for k, v in mapping.items():
        if k != 'interactions' and v is not None:
            assigned_cols.add(v)
            
    mapping['interactions'] = [c for c in mapping['interactions'] if c not in assigned_cols]
    
    return mapping, header_row_idx

def get_latest_excel_tracker():
    """Finds the latest Excel tracker file in the project root."""
    search_dir = os.path.dirname(os.path.abspath(__file__))
    # Looking for files that match typical tracker naming conventions
    excel_files = glob.glob(os.path.join(search_dir, "*.xlsx"))
    if not excel_files:
        return None
    
    # Sort by modification time to get the newest one
    latest_file = max(excel_files, key=os.path.getmtime)
    return latest_file

def sync_data(file_input=None, sheet_name=None):
    """
    Syncs resident data from an Excel file input.
    file_input can be a file path (string) or a file-like object (buffer).
    """
    if not file_input:
        file_input = get_latest_excel_tracker()
        
    if not file_input:
        return {"success": False, "error": "No Excel tracker file provided or found."}

    source_name = os.path.basename(file_input) if isinstance(file_input, str) else "uploaded file"
    print(f"Reading {source_name}...")
    try:
        # Load Excel workbook to inspect sheets
        xl = pd.ExcelFile(file_input)
        sheet_names = xl.sheet_names
        
        selected_sheet = sheet_name
        
        if not selected_sheet:
            # If multiple sheets, and no specific one requested, ask for clarification
            # UNLESS there is only one sheet total.
            if len(sheet_names) > 1:
                # Heuristic: if there's a sheet with "spring" or "current", we COULD auto-select,
                # but the user explicitly asked to "ask for clarification" if there are multiple sheets.
                # To be safe and follow the request literally:
                return {
                    "success": False, 
                    "requires_sheet_selection": True, 
                    "sheets": sheet_names,
                    "message": "Multiple sheets found. Please select which one to sync."
                }
            selected_sheet = sheet_names[0]
            
        print(f"Selected sheet: '{selected_sheet}'")
        
        # Load the selected sheet without headers to ensure we don't skip the first resident
        df = pd.read_excel(file_input, sheet_name=selected_sheet, header=None)
        
        return sync_dataframe(df, f"{source_name} - {selected_sheet}")
    except Exception as e:
        return {"success": False, "error": str(e)}

def sync_paste(paste_text):
    """
    Syncs resident data from pasted TSV text natively copied from Excel.
    """
    import io
    print("Reading pasted text...")
    try:
        # Pasted text from Excel is TSV
        df = pd.read_csv(io.StringIO(paste_text), sep='\t', header=None)
        return sync_dataframe(df, "pasted text")
    except Exception as e:
        return {"success": False, "error": f"Failed to parse pasted text: {str(e)}"}

def sync_dataframe(df, source_name):
    try:
        mapping, header_row_idx = detect_column_mapping(df)
        print(f"Detected column mapping: {mapping}, Header row: {header_row_idx}")
        
        # --- Backup Existing DB File ---
        import shutil
        current_time_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weekly_reporter.db")
        backup_name = f"weekly_reporter_backup_{current_time_str}.db"
        
        if os.path.exists(db_path):
            shutil.copy2(db_path, os.path.join(os.path.dirname(os.path.abspath(__file__)), backup_name))
            print(f"Backed up database to {backup_name}")
            
        conn = get_db()
        cursor = conn.cursor()
        
        # --- Clear Existing Data for Full Replacement ---
        cursor.execute("DELETE FROM interactions")
        cursor.execute("DELETE FROM residents")
        conn.commit()
        print("Cleared existing residents and interactions for full replacement.")

        residents_synced = 0
        new_residents = []
        new_interactions = []
        
        start_idx = (header_row_idx + 1) if header_row_idx is not None else 0
        df_data = df.iloc[start_idx:]
        
        for index, row in df_data.iterrows():
            id_col = mapping['asu_id']
            asuid_raw = row.iloc[id_col] if id_col is not None and id_col < len(row) else None
            
            asuid = str(asuid_raw).split('.')[0] if not pd.isna(asuid_raw) else None
            if not asuid or len(asuid) < 5 or asuid.lower() == 'nan':
                continue
                
            fn_col = mapping['first_name']
            ln_col = mapping['last_name']
            em_col = mapping['email']
            rm_col = mapping['room']
            
            first_name = str(row.iloc[fn_col]) if fn_col is not None and fn_col < len(row) and not pd.isna(row.iloc[fn_col]) else None
            last_name = str(row.iloc[ln_col]) if ln_col is not None and ln_col < len(row) and not pd.isna(row.iloc[ln_col]) else None
            email = str(row.iloc[em_col]) if em_col is not None and em_col < len(row) and not pd.isna(row.iloc[em_col]) else None
            room = str(row.iloc[rm_col]) if rm_col is not None and rm_col < len(row) and not pd.isna(row.iloc[rm_col]) else None
            
            resident_tuple = (asuid, first_name, last_name, email, room)
            new_residents.append(resident_tuple)
            
            for i in mapping['interactions']:
                if i < len(row) and not pd.isna(row.iloc[i]):
                    val = str(row.iloc[i]).strip()
                    if val and val.lower() != 'nan':
                        new_interactions.append((asuid, val))
            
            residents_synced += 1
            
        # Insert all new residents at once
        if new_residents:
            cursor.executemany(
                "INSERT INTO residents (asu_id, first_name, last_name, email, room) VALUES (?, ?, ?, ?, ?)",
                new_residents
            )
            
        # Insert all interactions
        if new_interactions:
            cursor.executemany(
                "INSERT INTO interactions (asu_id, content) VALUES (?, ?)",
                new_interactions
            )
            
        conn.commit()
        conn.close()
        
        return {
            "success": True, 
            "message": f"Successfully replaced database with {residents_synced} residents from {source_name}. Backup: {backup_name}",
            "synced_count": residents_synced,
            "backup_collection": backup_name
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    result = sync_data()
    print(result)
