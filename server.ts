import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import crypto from "crypto";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with generous limit for audio payloads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Enable CORS for WebView, Via, Brave, mobile browsers and embedded frames
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Helper to chunk text safely for TTS
function splitTextForTTS(text: string, maxLen = 180): string[] {
  const sentences = text.split(/([.,!?;:\n\r]+)/g);
  const chunks: string[] = [];
  let current = "";

  for (let i = 0; i < sentences.length; i++) {
    const piece = sentences[i];
    if (current.length + piece.length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// 100% Pure Microsoft Edge TTS Engine
export async function generateTTSAudio(
  text: string,
  options: {
    voice?: string;
    rate?: string;
    pitch?: string;
    volume?: string;
  } = {}
): Promise<Buffer> {
  const voice = options.voice || "vi-VN-HoaiMyNeural";
  const rate = options.rate || "+0%";
  const pitch = options.pitch || "+0Hz";
  const volume = options.volume || "+0%";

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error("Nội dung văn bản không được để trống.");
  }

  // Split into safe chunks for Microsoft Edge TTS if text is long
  const chunks = splitTextForTTS(trimmedText, 250);
  const chunkAudioBuffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    let lastError: any = null;
    let chunkBuffer: Buffer | null = null;

    // Retry loop for Microsoft Edge TTS WebSocket resilience
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const streamResult = tts.toStream(chunkText, {
          pitch,
          rate,
          volume,
        });
        const audioStream = (streamResult as any).audioStream || streamResult;

        const buffers: Buffer[] = [];
        chunkBuffer = await new Promise<Buffer>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            try { tts.close(); } catch {}
            if (buffers.length > 0) resolve(Buffer.concat(buffers));
            else reject(new Error(`Microsoft Edge TTS phản hồi quá hạn (timeout) tại đoạn ${i + 1}`));
          }, 15000);

          audioStream.on("data", (chunk: Buffer) => {
            buffers.push(chunk);
          });

          audioStream.on("end", () => {
            clearTimeout(timeoutId);
            try { tts.close(); } catch {}
            resolve(Buffer.concat(buffers));
          });

          audioStream.on("error", (err: any) => {
            clearTimeout(timeoutId);
            try { tts.close(); } catch {}
            reject(err);
          });
        });

        if (chunkBuffer && chunkBuffer.length > 0) {
          break; // Succeeded
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Microsoft Edge TTS thử lại lần ${attempt}/3 cho câu "${chunkText.slice(0, 25)}...":`, err?.message || err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 350 * attempt));
        }
      }
    }

    if (!chunkBuffer || chunkBuffer.length === 0) {
      throw new Error(`Lỗi Microsoft Edge TTS: Không thể tạo âm thanh cho đoạn "${chunkText.slice(0, 30)}..." (${lastError?.message || "Lỗi kết nối máy chủ Edge TTS"})`);
    }

    chunkAudioBuffers.push(chunkBuffer);
  }

  return Buffer.concat(chunkAudioBuffers);
}

// Convert speed multiplier to Edge TTS rate string (e.g. 1.0 -> "+0%", 1.25 -> "+25%")
function speedToRateString(speed: number): string {
  const percent = Math.round((speed - 1.0) * 100);
  return percent >= 0 ? `+${percent}%` : `${percent}%`;
}

// Convert pitch semitones to Edge TTS pitch string
function pitchToHzString(pitchSemitones: number): string {
  const hz = Math.round(pitchSemitones * 4);
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    engine: "edge-tts",
    ready: true,
  });
});

// Synthesize single segment or preview with Microsoft Edge TTS
app.all("/api/tts/synthesize", async (req, res) => {
  try {
    const params = req.method === "GET" ? req.query : req.body;
    const { text, voice = "vi-VN-HoaiMyNeural", speed = 1.0, pitch = 0, rate, pitchStr } = params;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Nội dung văn bản không được để trống." });
    }

    const calculatedRate = rate || speedToRateString(Number(speed) || 1.0);
    const calculatedPitch = pitchStr || pitchToHzString(Number(pitch) || 0);

    const mp3Buffer = await generateTTSAudio(text.trim(), {
      voice: String(voice),
      rate: String(calculatedRate),
      pitch: String(calculatedPitch),
    });

    res.json({
      success: true,
      mp3Base64: mp3Buffer.toString("base64"),
      voice,
    });
  } catch (error: any) {
    console.error("TTS synthesis error:", error);
    res.status(500).json({
      error: error.message || "Lỗi khi tạo giọng đọc TTS.",
    });
  }
});

import { spawn } from "child_process";

// Helper to decode MP3/WAV buffer to raw 16-bit PCM mono at specified sample rate
export function decodeAudioToPCM(buffer: Buffer, sampleRate = 24000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-f", "s16le",
      "-ac", "1",
      "-ar", String(sampleRate),
      "pipe:1"
    ]);
    const chunks: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", () => {});
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg decode failed with exit code ${code}`));
    });
    ffmpeg.stdin.write(buffer);
    ffmpeg.stdin.end();
  });
}

// Helper to encode raw 16-bit PCM mono to MP3 at specified bitrate
export function encodePCMToMP3(pcmBuffer: Buffer, sampleRate = 24000, bitrate = 192): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-f", "s16le",
      "-ar", String(sampleRate),
      "-ac", "1",
      "-i", "pipe:0",
      "-c:a", "libmp3lame",
      "-b:a", `${bitrate}k`,
      "-f", "mp3",
      "pipe:1"
    ]);
    const chunks: Buffer[] = [];
    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", () => {});
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg encode failed with exit code ${code}`));
    });
    ffmpeg.stdin.write(pcmBuffer);
    ffmpeg.stdin.end();
  });
}

// Helper to parse VTT time string or numeric seconds to float seconds
function parseVttTimeString(val: any): number {
  if (typeof val === "number" && !isNaN(val)) return Math.max(0, val);
  if (typeof val !== "string") return 0;
  const str = val.trim().replace(",", ".");
  const parts = str.split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.max(0, n);
}

// Batch / Full VTT synthesize endpoint with Microsoft Edge TTS & VTT Timestamp Synchronization
app.all("/api/tts/batch", async (req, res) => {
  try {
    const params = req.method === "GET" ? req.query : req.body;
    let cues = params.cues;
    if (typeof cues === "string") {
      try { cues = JSON.parse(cues); } catch {}
    }
    const {
      text,
      voice = "vi-VN-HoaiMyNeural",
      speed = 1.0,
      pitch = 0,
      rate,
      pitchStr,
      preserveTiming = true,
      pauseBetweenCues = 0.3,
      bitrate = 192,
    } = params;

    const calculatedRate = rate || speedToRateString(Number(speed) || 1.0);
    const calculatedPitch = pitchStr || pitchToHzString(Number(pitch) || 0);

    // If a simple single text block was passed without cue timestamps
    if ((!Array.isArray(cues) || cues.length === 0) && typeof text === "string" && text.trim()) {
      const mp3Buffer = await generateTTSAudio(text.trim(), {
        voice,
        rate: calculatedRate,
        pitch: calculatedPitch,
      });

      return res.json({
        success: true,
        mp3Base64: mp3Buffer.toString("base64"),
        fileSize: mp3Buffer.length,
        duration: 0,
        cueTimings: [],
        voice,
      });
    }

    if (!Array.isArray(cues) || cues.length === 0) {
      return res.status(400).json({ error: "Không tìm thấy danh sách câu phụ đề để tạo âm thanh." });
    }

    // Normalize and sort cues by start time
    const normalizedCues = cues
      .map((c: any, idx: number) => {
        const start = parseVttTimeString(c.startSec !== undefined ? c.startSec : c.startTime);
        const end = parseVttTimeString(c.endSec !== undefined ? c.endSec : c.endTime);
        return {
          id: c.id || `cue_${idx + 1}`,
          index: c.index !== undefined ? c.index : idx + 1,
          startSec: start,
          endSec: Math.max(start + 0.5, end),
          text: (c.text || "").trim(),
        };
      })
      .filter((c: any) => c.text.length > 0)
      .sort((a, b) => a.startSec - b.startSec);

    if (normalizedCues.length === 0) {
      return res.status(400).json({ error: "Nội dung văn bản trong các câu phụ đề đang trống." });
    }

    const sampleRate = 24000;
    const isPreserveTiming = preserveTiming !== false;
    const cueAudioBuffers: { cue: any; pcm: Buffer; durationSec: number }[] = [];

    // Synthesize each cue's audio segment with controlled parallel concurrency
    const BATCH_CONCURRENCY = 4;
    for (let i = 0; i < normalizedCues.length; i += BATCH_CONCURRENCY) {
      const slice = normalizedCues.slice(i, i + BATCH_CONCURRENCY);
      const sliceResults = await Promise.all(
        slice.map(async (cue) => {
          try {
            const mp3 = await generateTTSAudio(cue.text, {
              voice,
              rate: calculatedRate,
              pitch: calculatedPitch,
            });
            const pcm = await decodeAudioToPCM(mp3, sampleRate);
            const durationSec = (pcm.length / 2) / sampleRate;
            return { cue, pcm, durationSec };
          } catch (err: any) {
            console.warn(`Lỗi tạo TTS cho câu ${cue.index} ("${cue.text}"):`, err?.message || err);
            // Fallback to a brief 0.4s silence for broken cues
            const fallbackPcm = Buffer.alloc(sampleRate * 2 * 0.4);
            return { cue, pcm: fallbackPcm, durationSec: 0.4 };
          }
        })
      );
      cueAudioBuffers.push(...sliceResults);
    }

    // Assemble master PCM stream with exact timestamp positioning & silence gaps
    const pcmChunks: Buffer[] = [];
    const cueTimings: { id: string; index: number; text: string; start: number; end: number; duration: number }[] = [];
    let currentSamplePosition = 0;

    for (let i = 0; i < cueAudioBuffers.length; i++) {
      const { cue, pcm } = cueAudioBuffers[i];
      const cueSamples = pcm.length / 2;

      if (isPreserveTiming) {
        const targetStartSample = Math.round(cue.startSec * sampleRate);
        if (targetStartSample > currentSamplePosition) {
          const silenceSamples = targetStartSample - currentSamplePosition;
          pcmChunks.push(Buffer.alloc(silenceSamples * 2));
          currentSamplePosition = targetStartSample;
        } else if (currentSamplePosition > targetStartSample && i > 0) {
          // Preceding speech overlapped slightly past target start. Add tiny safety micro-gap (50ms)
          const microGapSamples = Math.round(0.05 * sampleRate);
          pcmChunks.push(Buffer.alloc(microGapSamples * 2));
          currentSamplePosition += microGapSamples;
        }
      } else {
        // Continuous mode: insert user-specified pause between cues
        if (i > 0 && Number(pauseBetweenCues) > 0) {
          const pauseSamples = Math.round(Number(pauseBetweenCues) * sampleRate);
          pcmChunks.push(Buffer.alloc(pauseSamples * 2));
          currentSamplePosition += pauseSamples;
        }
      }

      const actualStartSec = currentSamplePosition / sampleRate;
      pcmChunks.push(pcm);
      currentSamplePosition += cueSamples;
      const actualEndSec = currentSamplePosition / sampleRate;

      cueTimings.push({
        id: cue.id,
        index: cue.index,
        text: cue.text,
        start: Number(actualStartSec.toFixed(3)),
        end: Number(actualEndSec.toFixed(3)),
        duration: Number((actualEndSec - actualStartSec).toFixed(3)),
      });
    }

    // Optional: If preserving timing and last cue has end timestamp, pad silence to complete video track
    const lastCue = normalizedCues[normalizedCues.length - 1];
    if (isPreserveTiming && lastCue && lastCue.endSec) {
      const targetEndSample = Math.round(lastCue.endSec * sampleRate);
      if (targetEndSample > currentSamplePosition) {
        const finalSilenceSamples = targetEndSample - currentSamplePosition;
        pcmChunks.push(Buffer.alloc(finalSilenceSamples * 2));
        currentSamplePosition = targetEndSample;
      }
    }

    const masterPCM = Buffer.concat(pcmChunks);
    const totalDuration = Number(((masterPCM.length / 2) / sampleRate).toFixed(3));

    // Encode final continuous synchronized master PCM to high quality MP3
    const finalMp3Buffer = await encodePCMToMP3(masterPCM, sampleRate, Number(bitrate) || 192);

    res.json({
      success: true,
      mp3Base64: finalMp3Buffer.toString("base64"),
      fileSize: finalMp3Buffer.length,
      duration: totalDuration,
      cueTimings,
      voice,
      preserveTiming: isPreserveTiming,
    });
  } catch (error: any) {
    console.error("TTS batch error:", error);
    res.status(500).json({
      error: error.message || "Lỗi khi tạo âm thanh toàn bộ VTT.",
    });
  }
});

// Quick voice sample preview endpoint
app.all("/api/tts/sample", async (req, res) => {
  try {
    const params = req.method === "GET" ? req.query : req.body;
    const { voice = "vi-VN-HoaiMyNeural", text } = params;
    const sampleText = text || (voice.startsWith("vi-") ? "Xin chào, đây là giọng đọc mẫu." : "Hello, this is a sample voice.");

    const mp3Buffer = await generateTTSAudio(sampleText, {
      voice,
      rate: "+0%",
      pitch: "+0Hz",
    });

    res.json({
      success: true,
      mp3Base64: mp3Buffer.toString("base64"),
      voice,
    });
  } catch (error: any) {
    console.error("Voice sample error:", error);
    res.status(500).json({
      error: error.message || "Không thể tạo giọng mẫu.",
    });
  }
});

// Export MP4 endpoint using ffmpeg
app.post("/api/export-mp4", async (req, res) => {
  try {
    const { mp3Base64, filename = "vtt-audio" } = req.body;
    if (!mp3Base64 || typeof mp3Base64 !== "string") {
      return res.status(400).json({ error: "Không tìm thấy dữ liệu âm thanh để tạo file MP4." });
    }

    const fs = await import("fs/promises");
    const os = await import("os");
    const { execFile } = await import("child_process");
    const util = await import("util");
    const execFilePromise = util.promisify(execFile);

    const tempDir = os.tmpdir();
    const id = Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    const inputMp3Path = path.join(tempDir, `input_${id}.mp3`);
    const outputMp4Path = path.join(tempDir, `output_${id}.mp4`);

    const mp3Buffer = Buffer.from(mp3Base64, "base64");
    await fs.writeFile(inputMp3Path, mp3Buffer);

    // Run ffmpeg to wrap / convert audio into standard MPEG-4 AAC container (.mp4)
    await execFilePromise("ffmpeg", [
      "-y",
      "-i", inputMp3Path,
      "-c:a", "aac",
      "-b:a", "192k",
      outputMp4Path,
    ]);

    const mp4Buffer = await fs.readFile(outputMp4Path);

    // Clean up temp files in background
    fs.unlink(inputMp3Path).catch(() => {});
    fs.unlink(outputMp4Path).catch(() => {});

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}.mp4"`);
    res.send(mp4Buffer);
  } catch (err: any) {
    console.error("Export MP4 error:", err);
    res.status(500).json({ error: "Lỗi chuyển đổi sang MP4: " + (err?.message || "Không xác định") });
  }
});

// Catch-all for undefined /api routes to always return JSON (never plain text "File not found!")
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: `Endpoint không tồn tại: ${req.method} ${req.originalUrl}`,
    status: 404,
  });
});

// Setup Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`VTT to Audio Edge TTS Server running at http://localhost:${PORT}`);
  });
}

startServer();
