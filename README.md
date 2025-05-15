# Project C

## Description
AI Powered Interviewer Assistant

## Prerequisites
- **API KEYS NEEDED**
- Set up BlackHole



# Mac Audio-MIDI Setup (BlackHole 2-ch)

## Prerequisites

Download BlackHole (2-ch) and run the signed PKG installer.

Open **Audio MIDI Setup**: ⌘ Space ➜ type “Audio MIDI Setup”.

### 1 · Create the Multi-Output Device (“Speakers + BlackHole”)

| Action | Where to click |
|--------|----------------|
| a. Click “＋” (bottom-left) | Create Multi-Output Device |
| b. Tick **Built-in Mac speaker** first, then **BlackHole 2-ch** | (order matters so volume keys keep working) |
| c. Rename the new device | Double-click name ➜ “Speakers + BlackHole” |

### 2 · Make it the default speaker output

Right-click **Speakers + BlackHole** in the sidebar ➜ **Use This Device for Sound Output**.

macOS will now mirror everything you hear to BlackHole while keeping your laptop speakers (or headphones) active.

### 3 · Create the Aggregate Device (“HCI LLM”)

| Action | Where to click |
|--------|----------------|
| a. Click “＋” again | Create Aggregate Device |
| b. Tick **Built-in Mic** and **BlackHole 2-ch** | in the right pane |
| c. Rename the new device | “HCI LLM” |

### 4 · Verify indexes (for your Python script)

Run:
```bash
python -m sounddevice
```
You'll see output similar to:
```text
0 Built-in Microphone  (2 in, 0 out)
1 BlackHole 2ch        (2 in, 2 out)
2 Speakers+BlackHole   (0 in, 2 out)
3 HCI LLM              (4 in, 0 out)
```
Use the index (or exact name) in your `sounddevice.RawInputStream(device=…, …)` call.

### 5 · Run the real-time streamer

```bash

export ASSEMBLYAI_API_KEY=[redacted] \ 
       && export AUDIO_DEVICE_INDEX=4 \ #replace with your index for HCI LLM
       && python realtime_assemblyai.py
```

## Usage
1. Open two terminals.
    - In one terminal, `cd project-c/interview-assistant/client`
    - In the other, `cd project-c/interview-assistant/server`
2. In the `client` terminal run `npm run dev`. In the `server` terminal, run `node server`.
3. To begin recording and testing, click "Start Interview".
4. `ctrl-c` to stop in both terminals.

