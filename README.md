# VoxAI - Voice AI Assistant

A voice-enabled AI chat application powered by the PersonalPlex 7B model. Features a modern dark UI with real-time voice input, text-to-speech responses, and conversation history.

## Features

- Voice input via browser Speech Recognition API
- Text-to-speech response playback
- Chat history with local persistence
- Configurable model parameters (temperature, max tokens)
- Dark/light theme toggle
- Mobile-responsive layout
- OpenAI-compatible API backend (works with llama.cpp, Ollama, vLLM)

## Quick Start

```bash
# 1. Start the VoxAI server
python server.py

# 2. Open in your browser
# http://localhost:8000
```

## Model Backend Setup

The app needs a local LLM inference server running. Choose one:

### Option A: llama-cpp-python
```bash
pip install llama-cpp-python[server]
python -m llama_cpp.server --model ./personalplex-7b.gguf --host 0.0.0.0 --port 8080
```

### Option B: Ollama
```bash
# Install from https://ollama.ai
ollama pull personalplex-7b
# Runs on port 11434 by default
MODEL_BACKEND=http://localhost:11434 python server.py
```

### Option C: vLLM
```bash
pip install vllm
python -m vllm.entrypoints.openai.api_server --model personalplex-7b --port 8080
```

## Configuration

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8000` | Server port |
| `MODEL_BACKEND` | `http://localhost:8080` | LLM inference server URL |

In-app settings (gear icon) let you adjust the API endpoint, voice, speech rate, temperature, and max tokens.

## Project Structure

```
├── server.py              # Python backend server
├── templates/
│   └── index.html         # Main application page
├── static/
│   ├── css/
│   │   └── style.css      # UI styles
│   └── js/
│       └── app.js         # Frontend application logic
├── requirements.txt       # Dependencies info
└── README.md
```
