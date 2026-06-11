"""One-off: verify the live FTS index passes FTS5 integrity-check (rank=1)."""

import sqlite3

conn = sqlite3.connect(".index/pkms.db")
conn.execute("INSERT INTO notes_fts(notes_fts, rank) VALUES ('integrity-check', 1)")
n = conn.execute("SELECT count(*) FROM notes").fetchone()[0]
print(f"live FTS index: OK ({n} notes)")
