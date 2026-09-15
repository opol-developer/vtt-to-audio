"""
EdgeTTS Python Engine for PyScript (WebAssembly)
Chạy trực tiếp thư viện Python Edge TTS trong trình duyệt thông qua PyScript / Pyodide.
"""
import asyncio
import hashlib
import json
import math
import time
from js import window, document, WebSocket, Uint8Array, Blob, URL, TextEncoder

TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1"
SEC_MS_GEC_VERSION = "1-143.0.3650.96"

def generate_sec_ms_gec(token: str) -> str:
    """Tạo mã Sec-MS-GEC bằng Python hashlib SHA-256."""
    ticks = math.floor(time.time()) + 11644473600
    rounded = ticks - (ticks % 300)
    windows_ticks = rounded * 10000000
    data_str = f"{windows_ticks}{token}"
    hash_obj = hashlib.sha256(data_str.encode('utf-8'))
    return hash_obj.hexdigest().upper()

def generate_uuid() -> str:
    """Tạo mã UUID trong Python."""
    import random
    chars = "0123456789abcdef"
    def r_hex(n):
        return "".join(random.choice(chars) for _ in range(n))
    return f"{r_hex(8)}-{r_hex(4)}-4{r_hex(3)}-a{r_hex(3)}-{r_hex(12)}"

def escape_ssml(text: str) -> str:
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&apos;'))

def create_ssml(text: str, voice: str = "vi-VN-HoaiMyNeural", rate: str = "+0%", pitch: str = "+0Hz", volume: str = "+0%") -> str:
    escaped_text = escape_ssml(text)
    return (
        f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>"
        f"<voice name='{voice}'>"
        f"<prosody pitch='{pitch}' rate='{rate}' volume='{volume}'>"
        f"{escaped_text}"
        f"</prosody>"
        f"</voice>"
        f"</speak>"
    )

class PyEdgeTTS:
    def __init__(self):
        self.default_voice = "vi-VN-HoaiMyNeural"
        self.output_format = "audio-24khz-48kbitrate-mono-mp3"

    async def synthesize(self, text: str, voice: str = None, rate: str = "+0%", pitch: str = "+0Hz") -> dict:
        """Tạo âm thanh giọng đọc từ văn bản bằng Python qua WebSocket Edge TTS."""
        if not text or not text.strip():
            raise ValueError("Văn bản không được để trống")

        selected_voice = voice or self.default_voice
        ssml_content = create_ssml(text, selected_voice, rate, pitch)
        
        sec_ms_gec = generate_sec_ms_gec(TRUSTED_CLIENT_TOKEN)
        connection_id = generate_uuid()
        wss_endpoint = f"{WSS_URL}?TrustedClientToken={TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC={sec_ms_gec}&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}&ConnectionId={connection_id}"
        
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        audio_chunks = []
        
        ws = WebSocket.new(wss_endpoint)
        ws.binaryType = "arraybuffer"
        
        request_id = generate_uuid().replace("-", "")
        
        def on_open(event):
            config_payload = json.dumps({
                "context": {
                    "synthesis": {
                        "audio": {
                            "metadataoptions": {
                                "sentenceBoundaryEnabled": "false",
                                "wordBoundaryEnabled": "false"
                            },
                            "outputFormat": self.output_format
                        }
                    }
                }
            })
            config_msg = f"Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{config_payload}"
            ws.send(config_msg)
            
            ssml_msg = f"X-RequestId:{request_id}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n{ssml_content}"
            ws.send(ssml_msg)

        def on_message(event):
            try:
                data = event.data
                if hasattr(data, "byteLength"):
                    uint8_view = Uint8Array.new(data)
                    delim_bytes = TextEncoder.new().encode("Path:audio\r\n")
                    
                    found_idx = -1
                    length = uint8_view.length - delim_bytes.length
                    for i in range(max(0, length + 1)):
                        match = True
                        for j in range(delim_bytes.length):
                            if uint8_view[i + j] != delim_bytes[j]:
                                match = False
                                break
                        if match:
                            found_idx = i
                            break
                            
                    if found_idx != -1:
                        audio_slice = data.slice(found_idx + delim_bytes.length)
                        if audio_slice.byteLength > 0:
                            audio_chunks.append(audio_slice)
                elif isinstance(data, str) and "Path:turn.end" in data:
                    try:
                        ws.close()
                    except Exception:
                        pass
                    if not future.done():
                        future.set_result(audio_chunks)
            except Exception as ex:
                if not future.done():
                    future.set_exception(ex)

        def on_error(event):
            try:
                ws.close()
            except Exception:
                pass
            if not future.done():
                future.set_exception(RuntimeError("Lỗi kết nối WebSocket từ Python PyScript"))

        def on_close(event):
            if not future.done():
                future.set_result(audio_chunks)

        ws.onopen = on_open
        ws.onmessage = on_message
        ws.onerror = on_error
        ws.onclose = on_close

        # Chờ nhận kết quả âm thanh
        chunks = await future
        
        # Gom các đoạn âm thanh thành Blob MP3
        js_chunks = window.Array.new()
        for chunk in chunks:
            js_chunks.push(chunk)
            
        blob_options = window.Object.new()
        blob_options.type = "audio/mp3"
        mp3_blob = Blob.new(js_chunks, blob_options)
        mp3_url = URL.createObjectURL(mp3_blob)
        
        return {
            "blob": mp3_blob,
            "url": mp3_url,
            "size": mp3_blob.size,
            "engine": "pyscript-python-edge-tts"
        }

# Khởi tạo đối tượng và đăng ký vào window của trình duyệt
py_engine = PyEdgeTTS()
window.pyEdgeTTS = py_engine
window.isPyScriptReady = True

# Thông báo sẵn sàng
print("[PyScript] Thư viện Python Edge TTS đã sẵn sàng trong trình duyệt!")
if hasattr(window, "onPyScriptLoaded"):
    window.onPyScriptLoaded()
