import sqlite3
import shutil
import os

try:
    original = r'c:\Users\admin\Desktop\New folder (4)\sparse-kuiper\nomad_hub.db'
    copy = r'c:\Users\admin\Desktop\New folder (4)\sparse-kuiper\nomad_hub_temp.db'
    
    # copy the file to avoid locks
    shutil.copyfile(original, copy)
    
    conn = sqlite3.connect(copy)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print(f"Found {len(tables)} tables.")
    
    for table_tuple in tables:
        table_name = table_tuple[0]
        print(f"\n=== Table: {table_name} ===")
        
        cursor.execute(f"PRAGMA table_info('{table_name}');")
        columns = [col[1] for col in cursor.fetchall()]
        print("Columns:", ", ".join(columns))
        
        cursor.execute(f"SELECT * FROM '{table_name}' LIMIT 3;")
        rows = cursor.fetchall()
        for row in rows:
            print(row)
            
    conn.close()
    os.remove(copy)
except Exception as e:
    print("ERROR:", e)
