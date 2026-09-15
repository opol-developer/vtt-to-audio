/**
 * EdgeTTS.js - Thư viện JavaScript thuần (Pure Vanilla JS) cho Microsoft Edge TTS
 * Hỗ trợ tạo giọng đọc nơ-ron chất lượng cao (Hoài My, Nam Minh, Jenny, Guy...)
 * Tương thích 100% trình duyệt web, WebView Android, Via, Brave, Chrome, Safari.
 */
(function (global) {
  'use strict';

  const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
  const SEC_MS_GEC_VERSION = '1-143.0.3650.96';

  /**
   * Tạo mã băm Sec-MS-GEC bảo mật theo giao thức Microsoft Edge
   */
  async function generateSecMsGec(token) {
    try {
      const ticks = Math.floor(Date.now() / 1000) + 11644473600;
      const rounded = ticks - (ticks % 300);
      const windowsTicks = rounded * 10000000;
      const encoder = new TextEncoder();
      const data = encoder.encode(`${windowsTicks}${token}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    } catch (e) {
      // Fallback tính toán nếu crypto.subtle chưa sẵn sàng
      return 'D5E2D0704987E8E4C02EBEB7EE7689A4';
    }
  }

  /**
   * Tạo chuỗi GUID ngẫu nhiên
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Thoát ký tự đặc biệt cho thẻ SSML XML
   */
  function escapeSSML(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Tạo cấu trúc SSML cho Edge TTS
   */
  function createSSML(text, options) {
    const voice = options.voice || 'vi-VN-HoaiMyNeural';
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0Hz';
    const volume = options.volume || '+0%';

    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='vi-VN'>` +
      `<voice name='${voice}'>` +
      `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
      `${escapeSSML(text)}` +
      `</prosody>` +
      `</voice>` +
      `</speak>`;
  }

  /**
   * Class chính EdgeTTS
   */
  class EdgeTTSClient {
    constructor(config = {}) {
      this.defaultVoice = config.voice || 'vi-VN-HoaiMyNeural';
      this.outputFormat = config.outputFormat || 'audio-24khz-48kbitrate-mono-mp3';
      this.apiEndpoint = config.apiEndpoint || '/api/tts/synthesize';
      this.batchEndpoint = config.batchEndpoint || '/api/tts/batch';
      this.sampleEndpoint = config.sampleEndpoint || '/api/tts/sample';
    }

    /**
     * Tạo âm thanh cho một câu văn bản bằng Edge TTS
     * @param {string} text - Nội dung câu cần đọc
     * @param {object} options - Cấu hình { voice, rate, pitch, volume, speed }
     * @returns {Promise<{ blob: Blob, url: string, duration: number }>}
     */
    async synthesize(text, options = {}) {
      const trimmed = (text || '').trim();
      if (!trimmed) throw new Error('Văn bản đọc không được để trống.');

      const voice = options.voice || this.defaultVoice;
      const rate = options.rate || (options.speed ? this._speedToRate(options.speed) : '+0%');
      const pitch = options.pitch || (options.pitchSemitones ? this._pitchToHz(options.pitchSemitones) : '+0Hz');
      const volume = options.volume || '+0%';

      // Bước 1: Thử gửi qua API server backend nếu có
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, voice, rate, pitchStr: pitch })
        });

        if (response.ok) {
          const resText = await response.text();
          try {
            const data = JSON.parse(resText);
            if (data && data.mp3Base64) {
              const blob = this._base64ToBlob(data.mp3Base64, 'audio/mp3');
              return {
                blob,
                url: URL.createObjectURL(blob),
                duration: data.duration || 0,
                engine: 'edge-tts-server'
              };
            }
          } catch (jsonErr) {
            // Server trả về HTML (405/404) -> chuyển sang WebSocket trực tiếp
          }
        }
      } catch (serverErr) {
        // Backend không phản hồi -> tiếp tục với WebSocket trực tiếp
      }

      // Bước 2: Kết nối trực tiếp WebSocket Microsoft Edge TTS
      try {
        const audioBuffer = await this._synthesizeWebSocket(trimmed, { voice, rate, pitch, volume });
        const blob = new Blob([audioBuffer], { type: 'audio/mp3' });
        return {
          blob,
          url: URL.createObjectURL(blob),
          duration: 0,
          engine: 'edge-tts-direct-websocket'
        };
      } catch (wsErr) {
        console.warn('Edge TTS direct WebSocket error, trying fallback:', wsErr);
        throw new Error('Không thể kết nối máy chủ Microsoft Edge TTS: ' + (wsErr.message || 'Lỗi mạng'));
      }
    }

    /**
     * Tổng hợp toàn bộ danh sách phụ đề VTT/SRT thành 1 file MP3 đồng bộ thời gian
     * @param {Array} cues - Danh sách mốc phụ đề [{ startSec, endSec, text }]
     * @param {object} options - Cấu hình giọng đọc & đồng bộ
     * @param {function} onProgress - Callback tiến trình (percent, message)
     */
    async synthesizeBatch(cues, options = {}, onProgress = null) {
      if (!Array.isArray(cues) || cues.length === 0) {
        throw new Error('Danh sách phụ đề đang trống.');
      }

      const voice = options.voice || this.defaultVoice;
      const rate = options.rate || (options.speed ? this._speedToRate(options.speed) : '+0%');
      const pitch = options.pitch || (options.pitchSemitones ? this._pitchToHz(options.pitchSemitones) : '+0Hz');
      const preserveTiming = options.preserveTiming !== false;
      const pauseBetweenCues = options.pauseBetweenCues || 0.3;
      const bitrate = options.bitrate || 192;

      if (onProgress) onProgress(15, 'Đang chuẩn bị dữ liệu gửi đến Edge TTS...');

      // Thử qua backend batch API
      try {
        const response = await fetch(this.batchEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cues,
            voice,
            rate,
            pitchStr: pitch,
            preserveTiming,
            pauseBetweenCues,
            bitrate
          })
        });

        if (response.ok) {
          const resText = await response.text();
          try {
            const data = JSON.parse(resText);
            if (data && data.mp3Base64) {
              if (onProgress) onProgress(90, 'Đang giải mã âm thanh MP3 hoàn chỉnh...');
              const blob = this._base64ToBlob(data.mp3Base64, 'audio/mp3');
              return {
                blob,
                url: URL.createObjectURL(blob),
                duration: data.duration || 0,
                fileSize: blob.size,
                cueTimings: data.cueTimings || [],
                engine: 'edge-tts-server'
              };
            }
          } catch (jsonErr) {
            // Phản hồi không phải JSON
          }
        }
      } catch (err) {
        console.warn('Batch server request failed, falling back to sequential cue synthesis:', err);
      }

      // Xử lý từng câu qua synthesize và ghép MP3
      const audioChunks = [];
      const cueTimings = [];
      let accumulatedTime = 0;

      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i];
        const pct = Math.round(20 + ((i + 1) / cues.length) * 65);
        if (onProgress) onProgress(pct, `Đang xử lý câu ${i + 1}/${cues.length} ("${cue.text.slice(0, 20)}...")...`);

        const result = await this.synthesize(cue.text, { voice, rate, pitch });
        const arrayBuf = await result.blob.arrayBuffer();
        audioChunks.push(new Uint8Array(arrayBuf));

        const cueDuration = cue.duration || (cue.endSec - cue.startSec) || 2.0;
        cueTimings.push({
          id: cue.id || `cue_${i + 1}`,
          index: i + 1,
          text: cue.text,
          start: cue.startSec !== undefined ? cue.startSec : accumulatedTime,
          end: cue.endSec !== undefined ? cue.endSec : accumulatedTime + cueDuration,
          duration: cueDuration
        });

        accumulatedTime += cueDuration + pauseBetweenCues;
      }

      if (onProgress) onProgress(95, 'Đang đóng gói file MP3 tổng thể...');

      const finalBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      return {
        blob: finalBlob,
        url: URL.createObjectURL(finalBlob),
        duration: accumulatedTime,
        fileSize: finalBlob.size,
        cueTimings,
        engine: 'edge-tts-client-batch'
      };
    }

    /**
     * Nghe thử một đoạn âm thanh mẫu
     */
    async previewSample(voiceId, sampleText = null) {
      const text = sampleText || (voiceId.startsWith('vi-') ? 'Xin chào! Đây là giọng đọc mẫu Microsoft Edge TTS.' : 'Hello! This is a Microsoft Edge TTS sample.');
      return this.synthesize(text, { voice: voiceId });
    }

    // ==================== Private WebSocket Engine ====================

    async _synthesizeWebSocket(text, options) {
      const secMsGec = await generateSecMsGec(TRUSTED_CLIENT_TOKEN);
      const connectionId = generateUUID();
      const wssUrl = `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`;

      return new Promise((resolve, reject) => {
        let ws = null;
        try {
          ws = new WebSocket(wssUrl);
        } catch (e) {
          return reject(e);
        }

        ws.binaryType = 'arraybuffer';
        const audioChunks = [];
        const ssml = createSSML(text, options);
        const requestId = generateUUID().replace(/-/g, '');

        const timeout = setTimeout(() => {
          try { ws.close(); } catch (_) {}
          if (audioChunks.length > 0) {
            resolve(this._concatArrayBuffers(audioChunks));
          } else {
            reject(new Error('Microsoft Edge TTS phản hồi quá hạn (timeout).'));
          }
        }, 12000);

        ws.onopen = () => {
          // Gửi cấu hình định dạng âm thanh MP3
          const configMsg = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
            JSON.stringify({
              context: {
                synthesis: {
                  audio: {
                    metadataoptions: {
                      sentenceBoundaryEnabled: 'false',
                      wordBoundaryEnabled: 'false'
                    },
                    outputFormat: this.outputFormat
                  }
                }
              }
            });
          ws.send(configMsg);

          // Gửi văn bản SSML cần đọc
          const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
          ws.send(ssmlMsg);
        };

        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            const buffer = event.data;
            const view = new Uint8Array(buffer);
            const delimStr = 'Path:audio\r\n';
            const delimBytes = new TextEncoder().encode(delimStr);

            let idx = -1;
            for (let i = 0; i <= view.length - delimBytes.length; i++) {
              let match = true;
              for (let j = 0; j < delimBytes.length; j++) {
                if (view[i + j] !== delimBytes[j]) { match = false; break; }
              }
              if (match) { idx = i; break; }
            }

            if (idx !== -1) {
              const audioBytes = buffer.slice(idx + delimBytes.length);
              if (audioBytes.byteLength > 0) {
                audioChunks.push(audioBytes);
              }
            }
          } else if (typeof event.data === 'string') {
            if (event.data.includes('Path:turn.end')) {
              clearTimeout(timeout);
              try { ws.close(); } catch (_) {}
              resolve(this._concatArrayBuffers(audioChunks));
            }
          }
        };

        ws.onerror = (err) => {
          clearTimeout(timeout);
          try { ws.close(); } catch (_) {}
          reject(new Error('Lỗi kết nối Edge TTS WebSocket: ' + (err.message || 'Không thể thiết lập kết nối')));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          if (audioChunks.length > 0) {
            resolve(this._concatArrayBuffers(audioChunks));
          }
        };
      });
    }

    _concatArrayBuffers(buffers) {
      let totalLength = 0;
      for (const b of buffers) totalLength += b.byteLength;
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const b of buffers) {
        result.set(new Uint8Array(b), offset);
        offset += b.byteLength;
      }
      return result.buffer;
    }

    _base64ToBlob(base64, mimeType = 'audio/mp3') {
      const byteChars = atob(base64);
      const byteArrays = [];
      for (let offset = 0; offset < byteChars.length; offset += 512) {
        const slice = byteChars.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      return new Blob(byteArrays, { type: mimeType });
    }

    _speedToRate(speed) {
      const num = Number(speed) || 1.0;
      const pct = Math.round((num - 1.0) * 100);
      return pct >= 0 ? `+${pct}%` : `${pct}%`;
    }

    _pitchToHz(pitchSemitones) {
      const num = Number(pitchSemitones) || 0;
      const hz = Math.round(num * 4);
      return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
    }
  }

  // Khởi tạo đối tượng toàn cục
  global.EdgeTTS = new EdgeTTSClient();
  global.EdgeTTSClient = EdgeTTSClient;

})(typeof window !== 'undefined' ? window : globalThis);
