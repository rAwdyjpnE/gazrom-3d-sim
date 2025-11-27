import json
import os
import threading
import time
from typing import Any

import uvicorn
import webview
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic.alias_generators import to_camel

class CamelCaseModel(BaseModel):
    class Config:
        alias_generator = to_camel
        populate_by_name = True

class Command(CamelCaseModel):
    command: str
    payload: dict[str, Any] = {}

API_WINDOW = None
DB = {"student_submissions": {}}

app = FastAPI(title="3D Studio API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def execute_js(js_code: str) -> Any:
    if not API_WINDOW: raise HTTPException(status_code=503, detail="GUI window not available.")
    try:
        return API_WINDOW.evaluate_js(js_code)
    except Exception as e:
        print(f"JS Error: {e}")
        return None

@app.post("/api/commands")
def post_command(data: Command):
    return {"status": "ok", "command": data.command, "result": execute_js(f"window.localApi.executeCommand('{data.command}', {json.dumps(data.payload)})")}

@app.post("/api/submit_answers")
def submit_answers(payload: dict):
    if not (student_id := payload.get("studentId")): raise HTTPException(status_code=400, detail="studentId is required")
    DB["student_submissions"][student_id] = {"ticketId": payload.get("ticketId"), "answers": payload.get("answers"), "status": "submitted_to_ai", "timestamp": time.time()}
    print(f"Received answers from {student_id}. Saved for AI processing.")
    return {"message": "Answers submitted successfully"}

@app.get("/api/student/status/{student_id}")
def get_student_status(student_id: str):
    return {"status": "processing", "message": "AI is analyzing your answers..."} if (submission := DB["student_submissions"].get(student_id)) else {"status": "no_submission"}

def run_server(port: int):
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="error")

def run_gui(port: int):
    global API_WINDOW
    API_WINDOW = webview.create_window('3D Studio', f"{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'login.html')}?port={port}", width=1440, height=900, resizable=True, min_size=(1024, 768), background_color='#0B1120')
    webview.start(debug=True, http_server=True)

def main(port: int = 5000):
    threading.Thread(target=run_server, args=(port,), daemon=True).start()
    print(f"--- 3D STUDIO ---\nAPI: http://127.0.0.1:{port}")
    run_gui(port)

if __name__ == '__main__':
    import typer
    typer.run(main)