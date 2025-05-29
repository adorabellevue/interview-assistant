import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

cred_path = os.getenv("FIREBASE_KEY", "./API-keys/interviewer-assistant-e76d2-firebase-adminsdk-fbsvc-e22c760bf0.json")
cred = credentials.Certificate(os.path.expanduser(cred_path))
firebase_admin.initialize_app(cred)
db = firestore.client()

def format_timestamp(ts):
    if hasattr(ts, 'to_datetime'):
        ts = ts.to_datetime()
    return ts.strftime("%H:%M:%S")

def get_full_transcript(session_id):
    chunks_ref = db.collection("transcripts").document(session_id).collection("chunks")
    chunks = chunks_ref.order_by("timestamp").stream()

    transcript_lines = []
    for doc in chunks:
        data = doc.to_dict()
        if data.get("type") == "transcript":
            ts = data.get("timestamp")
            speaker = data.get("speaker", "?")
            content = data.get("content", "")
            time_str = format_timestamp(ts)
            if speaker == 0:
                line = f"[{time_str}] Interviewer: {content}"
            elif speaker == 1:
                line = f"[{time_str}] Interviewee: {content}"
            else:
                line = f"[{time_str}] Unknown Speaker: {content}"
            transcript_lines.append(line)

    return "\n".join(transcript_lines)

if __name__ == "__main__":
    SESSION_ID = sys.argv[1]
    full_transcript = get_full_transcript(SESSION_ID)
    print(full_transcript) # TODO send full_transcript to server.js via stdout