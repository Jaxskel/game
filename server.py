"""
VoxAI - Voice AI Backend Server
Serves the frontend and proxies chat completions to PersonalPlex 7B
via a local model server (llama.cpp, Ollama, vLLM, etc.)
"""

import json
import os
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", 8000))

# Where the actual LLM inference server runs (llama.cpp server, Ollama, vLLM, etc.)
MODEL_BACKEND = os.environ.get("MODEL_BACKEND", "http://localhost:8080")


class VoxAIHandler(SimpleHTTPRequestHandler):
    """Handles static files, the main page, and API proxy."""

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Serve the main page
        if path == "/" or path == "/index.html":
            self._serve_file("templates/index.html", "text/html")
            return

        # Serve static files
        if path.startswith("/static/"):
            file_path = path.lstrip("/")
            if path.endswith(".css"):
                content_type = "text/css"
            elif path.endswith(".js"):
                content_type = "application/javascript"
            elif path.endswith(".png"):
                content_type = "image/png"
            elif path.endswith(".svg"):
                content_type = "image/svg+xml"
            else:
                content_type = "application/octet-stream"
            self._serve_file(file_path, content_type)
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        parsed = urlparse(self.path)

        # Proxy chat completions to the model backend
        if parsed.path == "/v1/chat/completions":
            self._proxy_chat_completion()
            return

        self.send_error(404, "Not Found")

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def _serve_file(self, filepath, content_type):
        try:
            with open(filepath, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(data)
        except FileNotFoundError:
            self.send_error(404, "File not found")

    def _proxy_chat_completion(self):
        """Forward chat completion requests to the model backend."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            request_data = json.loads(body)

            # Forward to model backend
            backend_url = f"{MODEL_BACKEND}/v1/chat/completions"
            req = Request(
                backend_url,
                data=json.dumps(request_data).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            try:
                with urlopen(req, timeout=120) as resp:
                    response_data = resp.read()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self._set_cors_headers()
                    self.end_headers()
                    self.wfile.write(response_data)
            except URLError:
                # Model backend not available - return a helpful fallback
                fallback = self._generate_fallback(request_data)
                self._send_json(200, fallback)

        except Exception as e:
            self._send_json(500, {"error": {"message": str(e), "type": "server_error"}})

    def _generate_fallback(self, request_data):
        """Generate an OpenAI-compatible fallback when the model backend is down."""
        messages = request_data.get("messages", [])
        user_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_msg = msg.get("content", "")
                break

        reply = (
            f"The PersonalPlex 7B model server is not currently running at {MODEL_BACKEND}. "
            "To set it up:\n\n"
            "1. Install llama-cpp-python: pip install llama-cpp-python[server]\n"
            "2. Download a PersonalPlex 7B GGUF model\n"
            "3. Run: python -m llama_cpp.server --model ./personalplex-7b.gguf --host 0.0.0.0 --port 8080\n\n"
            "Or use Ollama:\n"
            "1. Install Ollama from https://ollama.ai\n"
            "2. Pull a model: ollama pull personalplex-7b\n"
            "3. Ollama serves on port 11434 by default\n\n"
            "Set MODEL_BACKEND env var to point to your inference server."
        )

        return {
            "id": "fallback-0",
            "object": "chat.completion",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": reply},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }

    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._set_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format, *args):
        print(f"[VoxAI] {args[0]}")


def main():
    server = HTTPServer((HOST, PORT), VoxAIHandler)
    print(f"""
╔══════════════════════════════════════════════╗
║           VoxAI - Voice AI Assistant         ║
╠══════════════════════════════════════════════╣
║  Server:   http://{HOST}:{PORT:<21s}  ║
║  Backend:  {MODEL_BACKEND:<33s}║
║                                              ║
║  Open http://localhost:{PORT} in your browser  ║
╚══════════════════════════════════════════════╝
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[VoxAI] Server stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
