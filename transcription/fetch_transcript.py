import os
import firebase_admin
from firebase_admin import credentials, firestore

SESSION_ID = "05e21343-549f-4c05-a41d-dcfb40cd36d8" # TODO get session ID

cred_path = os.getenv("FIREBASE_KEY", "./API-keys/interviewer-assistant-e76d2-firebase-adminsdk-fbsvc-e22c760bf0.json")
cred = credentials.Certificate(os.path.expanduser(cred_path))
firebase_admin.initialize_app(cred)
db = firestore.client()

# Fetch all chunks
def get_full_transcript(session_id):
    chunks_ref = db.collection("transcripts").document(session_id).collection("chunks")
    chunks = chunks_ref.order_by("timestamp").stream()

    transcript_parts = []
    for doc in chunks:
        data = doc.to_dict()
        if data.get("type") == "transcript":
            transcript_parts.append(data.get("content", ""))

    return " ".join(transcript_parts)

if __name__ == "__main__":
    full_transcript = get_full_transcript(SESSION_ID)
    print(full_transcript) # TODO send full_transcript to server.js via stdout