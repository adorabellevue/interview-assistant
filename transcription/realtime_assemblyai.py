#!/usr/bin/env python3
"""
Transcribe streaming audio from microphone using AssemblyAI Python SDK.
"""

import os
import sys
import requests
import assemblyai as aai
import sounddevice as sd
import numpy as np
import threading
import signal
import time
from queue import Queue
import os, uuid, datetime as dt
import firebase_admin
from firebase_admin import credentials, firestore

# one‑time SDK init (put near the top of realtime_assemblyai.py) 
cred_path = os.getenv("FIREBASE_KEY", "./API-keys/interviewer-assistant-e76d2-firebase-adminsdk-fbsvc-e22c760bf0.json")
cred = credentials.Certificate(os.path.expanduser(cred_path))
firebase_admin.initialize_app(cred)
db = firestore.client()
session_transcript = ""
questions = ["How Would You Handle a Situation Where a Project You’re Working on Is Behind Schedule?",
             "How Do You Handle Feedback and Criticism of Your Code?"]

# Read API key from environment (prefer ASSEMBLYAI_API_KEY, fallback to ASSEMBLYAI_KEY)
API_KEY = os.getenv("ASSEMBLYAI_API_KEY") or os.getenv("ASSEMBLYAI_KEY")
if not API_KEY:
    print("➜  Set your key:  export ASSEMBLYAI_API_KEY=xxxxx", file=sys.stderr)
    sys.exit(1)
# Configure SDK with API key
aai.settings.api_key = API_KEY

SAMPLE_RATE = 16_000  # 16 kHz sample rate



def rms_db(int16_block):
    """fast RMS→dBFS"""
    if not int16_block.size:
        return -120
    rms = np.sqrt(np.mean(int16_block.astype(np.float32)**2))
    return 20 * np.log10(rms / 32768 + 1e-12)



# Optionally select a specific audio input device via its index
DEVICE_INDEX_ENV = os.getenv("AUDIO_DEVICE_INDEX")
try:
    DEVICE_INDEX = int(DEVICE_INDEX_ENV) if DEVICE_INDEX_ENV else None
except ValueError:
    print(f"Invalid AUDIO_DEVICE_INDEX '{DEVICE_INDEX_ENV}', using default device.", file=sys.stderr)
    DEVICE_INDEX = None

# Determine number of input channels for the selected device
if DEVICE_INDEX is not None:
    dev_info = sd.query_devices(DEVICE_INDEX, 'input')
    print(f"[DEBUG] Selected input device #{DEVICE_INDEX}: {dev_info['name']}")
    CHANNELS = dev_info.get('max_input_channels', 1)
else:
    CHANNELS = 1
BLOCK_SIZE = int(SAMPLE_RATE * 0.1)

print(f"[DEBUG] Using device index={DEVICE_INDEX}, channels={CHANNELS}, block size={BLOCK_SIZE}")

# At top, after DEVICE_INDEX
FOR_MONO_ENV = os.getenv("FORCE_MONO", "").lower()
FORCE_MONO = FOR_MONO_ENV in ("1", "true", "yes")
print(f"[DEBUG] FORCE_MONO={FORCE_MONO}")

# Event handlers
# global variable (top of file, before on_open)
CURRENT_SESSION_ID: str | None = None
CURRENT_SESSION_ID = os.getenv("SESSION_ID")
print(f"Initial session ID from env: {os.getenv('SESSION_ID')}")                 

# def send_to_backend(transcript: str, questions: list[str]):
#     global session_transcript
#     try:
#         response = requests.post(
#             "http://localhost:5001/from-python",
#             json={"transcript": transcript, "questions": questions},
#             timeout=10
#         )
#         print("LLM response: ", response.json())
#         questions.append(response.json())
#         session_transcript = ""
#     except Exception as e:
#         print(f"Error sending to backend: {e}")

def send_to_backend(transcript: str, questions: list[str]):
    global session_transcript
    try:
        response = requests.post(
            "http://localhost:5001/from-python",
            json={"transcript": transcript, "questions": questions},
            timeout=10
        )
        llm_response = response.json()
        
        doc = {
            "type": "llm_response",
            "content": llm_response['reply'],
            "timestamp": dt.datetime.now()
        }
        
        (db.collection("transcripts")
           .document(CURRENT_SESSION_ID)
           .collection("chunks")
           .add(doc))
        
        session_transcript = ""
    except Exception as e:
        print(f"Error sending to backend: {e}")

def on_open(session_opened: aai.RealtimeSessionOpened):
    global CURRENT_SESSION_ID
    print(f"Using session ID: {CURRENT_SESSION_ID}")


def on_data(transcript: aai.RealtimeTranscript):
    print(f"[DEBUG] on_data called with: {transcript}", file=sys.stderr)
    if not transcript.text:
        return
    
    if isinstance(transcript, aai.RealtimeFinalTranscript):
        print(transcript.text, end="\r\n")
    else:
        print(transcript.text, end="\r")

def on_error(error: aai.RealtimeError):
    print("An error occurred:", error)

def on_close():
    print("Closing Session")

# Create the Real-Time transcriber
transcriber = aai.RealtimeTranscriber(
    sample_rate=SAMPLE_RATE,
    on_data=on_data,
    on_error=on_error,
    on_open=on_open,
    on_close=on_close,
)

# Multi-channel: single reader, dispatch channels 0 & 1 via queues
if CHANNELS >= 2:
    q0 = Queue(maxsize=10)
    q1 = Queue(maxsize=10)
    stop_event = threading.Event()

    def read_audio():
        DUCK_THRESHOLD_DB  = -45          # remote louder than this? duck local
        ATTACK_FRAMES      = 1            # 3*100 ms = 300 ms to trigger
        RELEASE_FRAMES     = 1           # 1.5 s of silence to un‑duck
        EMA_ALPHA          = 0.5          # smoothing factor (0‑1)

        # ---- state ----
        ema_remote_db = -120              # start well below noise floor
        duck_state    = False
        attack_cnt    = release_cnt = 0
        print("[DEBUG] Starting multi-channel raw input stream")
        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            dtype='int16',
            channels=CHANNELS,
            device=DEVICE_INDEX,
        ) as stream:
            while not stop_event.is_set():
                data, _ = stream.read(BLOCK_SIZE)
                pcm = np.frombuffer(data, dtype=np.int16).reshape(-1, CHANNELS)

                local  = pcm[:, 0]            # Channel 0
                remote = pcm[:, 1]            # Channel 1

                # --- side‑chain level detection (100 ms) ---
                level_db      = rms_db(remote)
                ema_remote_db = EMA_ALPHA * level_db + (1-EMA_ALPHA) * ema_remote_db  ### NEW

                if ema_remote_db > DUCK_THRESHOLD_DB:
                    attack_cnt += 1; release_cnt = 0
                else:
                    release_cnt += 1; attack_cnt = 0

                if attack_cnt  >= ATTACK_FRAMES:  duck_state = True
                if release_cnt >= RELEASE_FRAMES: duck_state = False

                if duck_state:                   ### NEW
                    local[:] = 0                  # hard mute; use *= 0.1 for -20 dB duck

                # queue the (possibly ducked) data
                q0.put(local.tobytes())
                q1.put(remote.tobytes())

    threading.Thread(target=read_audio, daemon=True).start()
                              # auto‑ID document

    def start_channel(idx, queue):
        session_info = {}   
        def _on_open(sess: aai.RealtimeSessionOpened):
            #session_info["id"] = sess.session_id
            print(f"[Channel {idx}] Session ID:", sess.session_id)

        # def on_data_Firebase(transcript: aai.RealtimeTranscript):
        #         global session_transcript
        #         if not isinstance(transcript, aai.RealtimeFinalTranscript):
        #             return
        #     # fall back to the global session ID captured in on_open
        #         sid = str(getattr(transcript, "session_id", session_info.get("id", "unknown")))

        #     # Firestore accepts plain dicts straight from Pydantic
        #         doc = transcript.model_dump()
        #         (db.collection("transcripts")
        #             .document(sid)          # parent doc per call
        #             .collection("chunks")          # one sub‑doc per utterance
        #             .add(doc))
        #         session_transcript = session_transcript + " " + transcript.text
        
        # no model dump, use dict
        def on_data_Firebase(transcript: aai.RealtimeTranscript):
            global session_transcript
            if not isinstance(transcript, aai.RealtimeFinalTranscript):
                return
            
            doc = {
                "type": "transcript",  
                "content": transcript.text,
                "speaker": idx,
                "timestamp": dt.datetime.now(),
                "punctuated": True
            }

            (db.collection("transcripts")
                .document(CURRENT_SESSION_ID)
                .collection("chunks")
                .add(doc))
            
            session_transcript = session_transcript + " " + transcript.text
                
        def _on_error(err):  print(f"[Channel {idx} ERROR]:", err)
        def _on_close():     print(f"[Channel {idx}] Closed")
                
    
        trans = aai.RealtimeTranscriber(
            sample_rate=SAMPLE_RATE,
            encoding=aai.AudioEncoding.pcm_s16le,
            on_open=_on_open,
            on_data=on_data_Firebase,
            on_error=_on_error,
            on_close=_on_close,
        )
        trans.connect()

        def gen():
            while True:
                yield queue.get()

        trans.stream(gen())
        trans.close()

    for idx, queue in [(0, q0), (1, q1)]:
        threading.Thread(target=start_channel, args=(idx, queue), daemon=True).start()

    try:
        seconds = 0
        while True:
            time.sleep(1)
            seconds += 1
            if seconds % 10 == 0:
                if session_transcript != "":
                    send_to_backend(session_transcript, questions)
                    print("Transcript sent to backend")
            
    except KeyboardInterrupt:
        print("Stopping streams...")
        stop_event.set()
else:
    transcriber.connect()

    # Stream microphone audio (support multi-channel aggregate devices)
    if CHANNELS > 1 and not FORCE_MONO:
        def audio_generator():
            print("[DEBUG] Starting multi-channel audio generator")
            with sd.RawInputStream(
                samplerate=SAMPLE_RATE,
                blocksize=BLOCK_SIZE,
                dtype='int16',
                channels=CHANNELS,
                device=DEVICE_INDEX,
            ) as stream:
                while True:
                    data, _ = stream.read(BLOCK_SIZE)
                    pcm = np.frombuffer(data, dtype=np.int16)
                    pcm = pcm.reshape(-1, CHANNELS)
                    mono = pcm.mean(axis=1).astype(np.int16)
                    chunk_bytes = mono.tobytes()
                    print(f"[DEBUG] Sending mono audio chunk: {len(chunk_bytes)} bytes")
                    yield chunk_bytes
        transcriber.stream(audio_generator())
    else:
        if FORCE_MONO:
            print("[DEBUG] FORCE_MONO enabled, using mono MicrophoneStream fallback")
        else:
            print("[DEBUG] CHANNELS==1 or forcing mono, using mono MicrophoneStream fallback")
        mic_stream = aai.extras.MicrophoneStream(
            sample_rate=SAMPLE_RATE,
            device_index=DEVICE_INDEX,
        )
        transcriber.stream(mic_stream)
    # Close the connection
    transcriber.close()