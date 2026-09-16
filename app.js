/**
 * VTT to Audio AI - Microsoft Edge TTS Engine
 * Chuyển đổi toàn bộ file phụ đề WebVTT sang MP3 qua 1 yêu cầu duy nhất (Single Request)
 * Hỗ trợ giọng đọc Microsoft Edge TTS (Hoài My, Nam Minh, Jenny, Guy) không giới hạn & không cần API Key.
 */

// Default Configuration & Voice Profiles
const DEFAULT_CONFIG = {
  voices: [
    {
      id: "vi-VN-HoaiMyNeural",
      name: "Hoài My (Nữ)",
      gender: "female",
      toneDescription: "Ấm áp, truyền cảm, trong trẻo, chuẩn giọng thuyết minh & sách nói",
      style: "Giọng Nữ Thuyết Minh & Sách Nói",
      previewPrompt: "Xin chào! Đây là giọng đọc Hoài My của Microsoft Edge TTS, rất vui được đồng hành cùng nội dung của bạn.",
      recommendedFor: "Phim tài liệu, audiobook, review phim, video TikTok/Reels, bài giảng"
    },
    {
      id: "vi-VN-NamMinhNeural",
      name: "Nam Minh (Nam)",
      gender: "male",
      toneDescription: "Trầm ấm, đĩnh đạc, rõ ràng, dứt khoát chuẩn thời sự & podcast",
      style: "Giọng Nam Thời Sự & Podcast",
      previewPrompt: "Chào bạn, tôi là Nam Minh. Giọng đọc mang lại sự tin cậy, đĩnh đạc và truyền cảm cho các bản tin.",
      recommendedFor: "Thời sự, podcast, phóng sự tài chính, review công nghệ, trailer"
    },
    {
      id: "en-US-JennyNeural",
      name: "Jenny (Nữ - US)",
      gender: "female",
      toneDescription: "Trong trẻo, tươi sáng, chuẩn giọng Anh-Mỹ tự nhiên và lưu loát",
      style: "Giọng Nữ Tiếng Anh (Mỹ)",
      previewPrompt: "Hello! I am Jenny from Microsoft Edge TTS, ready to narrate your English subtitles smoothly.",
      recommendedFor: "Video song ngữ, thuyết minh tiếng Anh, bài học ngoại ngữ"
    },
    {
      id: "en-US-GuyNeural",
      name: "Guy (Nam - US)",
      gender: "male",
      toneDescription: "Nam tính, tự tin, đĩnh đạc chuẩn giọng Anh-Mỹ hiện đại",
      style: "Giọng Nam Tiếng Anh (Mỹ)",
      previewPrompt: "Hi there! I am Guy, offering a clear, confident and natural American English narration.",
      recommendedFor: "Video công nghệ quốc tế, thuyết trình tiếng Anh, vlog"
    }
  ],
  tones: [
    {
      id: "default",
      label: "Tự nhiên chuẩn Microsoft (Mặc định)",
      description: "Ngữ điệu tự nhiên, thông minh, ngắt nghỉ cân đối theo ngữ cảnh",
      rate: "+0%",
      pitch: "+0Hz"
    },
    {
      id: "story",
      label: "Đọc truyện & Sách nói (Chậm rãi, truyền cảm)",
      description: "Tốc độ vừa phải, trầm ấm, tạo cảm giác lôi cuốn sâu lắng",
      rate: "-5%",
      pitch: "-2Hz"
    },
    {
      id: "news",
      label: "Thời sự & Phóng sự (Dứt khoát, tự tin)",
      description: "Tốc độ nhanh vừa, rõ chữ, chuẩn phong cách phát thanh viên",
      rate: "+5%",
      pitch: "+0Hz"
    },
    {
      id: "energetic",
      label: "Vlog & Năng động (Tươi vui, hoạt bát)",
      description: "Tốc độ nhanh, sinh động, phù hợp video ngắn TikTok/YouTube",
      rate: "+10%",
      pitch: "+4Hz"
    },
    {
      id: "calm",
      label: "Thư giãn & Chữa lành (Dịu nhẹ, thanh thản)",
      description: "Chậm rãi, êm ái, mang lại cảm giác bình yên",
      rate: "-10%",
      pitch: "-4Hz"
    }
  ],
  sampleVtt: `WEBVTT - Mẫu thuyết minh phim tài liệu vịnh Hạ Long

00:00:01.500 --> 00:00:04.800
Nằm ở vùng Đông Bắc Việt Nam, vịnh Hạ Long là một kỳ quan thiên nhiên vô giá.

00:00:05.200 --> 00:00:09.500
Hàng ngàn hòn đảo đá vôi sừng sững nhô lên giữa làn nước trong xanh ngọc bích.

00:00:10.000 --> 00:00:14.200
Mỗi buổi sớm mai, màn sương mờ ảo bao phủ khắp các hang động cổ xưa.

00:00:15.000 --> 00:00:19.300
Nơi đây không chỉ là thắng cảnh, mà còn là bản giao hưởng huyền diệu của đất trời.

00:00:20.100 --> 00:00:24.000
Chào đón bạn đến với hành trình khám phá di sản thiên nhiên thế giới tuyệt mỹ này.`
};

// Global State
const state = {
  cues: [],
  fileName: 'mau-thuyet-minh.vtt',
  fileType: 'vtt', // 'vtt' | 'srt' | 'txt' | 'csv'
  hasTimeline: true, // boolean: true if cues have timestamps, false for continuous text
  activeTab: 'cues',
  isStaticWeb: false, // true if running without backend server (pure static web, file://, GitHub Pages)
  settings: {
    engine: 'auto', // 'auto' | 'pyscript' | 'js' | 'edge'
    voice: 'vi-VN-HoaiMyNeural',
    speed: 1.0,
    pitch: 0,
    toneStyle: 'default',
    preserveTiming: true,
    pauseBetweenCues: 0.5,
    bitrate: 192
  },
  isGenerating: false,
  playingCueId: null,
  activePlaybackCueIndex: null,
  generationResult: null,
  config: DEFAULT_CONFIG,
  customArtistSet: false, // true if user explicitly entered an artist name in metadata modal
  mp3Metadata: {
    title: 'Mẫu thuyết minh Vịnh Hạ Long',
    artist: 'Hoài My (Nữ)',
    album: 'VoiceSub AI Project',
    year: new Date().getFullYear().toString(),
    date: new Date().toISOString().slice(0, 10),
    genre: 'Thuyết minh / Phụ đề',
    comment: 'Tạo bởi VoiceSub AI - Microsoft Edge TTS',
    coverImage: null // { dataUrl, bytes, mimeType }
  }
};

// Audio Elements
const cueAudio = new Audio();
const mainAudio = new Audio();

// ==================== 1. Universal Parsing (VTT, SRT, TXT, CSV) ====================

function parseVttTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  let hours = 0, minutes = 0, seconds = 0;
  if (parts.length === 3) {
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    seconds = parseFloat(parts[2].replace(',', '.')) || 0;
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10) || 0;
    seconds = parseFloat(parts[1].replace(',', '.')) || 0;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function formatVttTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function formatPlayerTime(sec) {
  if (isNaN(sec) || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Subtitle Parser (WebVTT & SRT)
function parseVtt(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues = [];
  let index = 1;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const timeMatch = line.match(/((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/);
      if (timeMatch) {
        const startTimeStr = timeMatch[1].replace(',', '.');
        const endTimeStr = timeMatch[2].replace(',', '.');
        const startSec = parseVttTime(startTimeStr);
        const endSec = parseVttTime(endTimeStr);

        i++;
        const textLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }

        const text = textLines.join(' ').replace(/<[^>]*>/g, '').trim();
        if (text) {
          cues.push({
            id: 'cue_' + index,
            index: index,
            startTime: startTimeStr,
            endTime: endTimeStr,
            startSec: startSec,
            endSec: endSec,
            duration: Math.max(0.1, endSec - startSec),
            text: text
          });
          index++;
        }
      }
    }
    i++;
  }

  // If no timestamp was found, fallback to parse as TXT
  if (cues.length === 0 && content.trim().length > 0) {
    return parseTxt(content);
  }

  return cues;
}

// Plain Text Parser (.txt / scripts / books) - No Timeline required
function parseTxt(content) {
  const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues = [];
  let index = 1;
  let cumulativeTime = 0;

  for (let line of rawLines) {
    line = line.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Clean optional leading list numbering like "1.", "1/", "[1]"
    const cleanText = line.replace(/^(\d+[\.\/\-\)]\s*|\[\d+\]\s*)/, '').trim();
    if (!cleanText) continue;

    const estDuration = Math.max(1.5, Math.min(10, cleanText.length * 0.08));
    const startSec = cumulativeTime;
    const endSec = cumulativeTime + estDuration;
    cumulativeTime = endSec + 0.5;

    cues.push({
      id: 'cue_' + index,
      index: index,
      startTime: formatVttTime(startSec),
      endTime: formatVttTime(endSec),
      startSec: startSec,
      endSec: endSec,
      duration: estDuration,
      text: cleanText
    });
    index++;
  }

  return cues;
}

// CSV Parser (.csv) - Handles with or without timeline
function parseCsv(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const cues = [];
  let index = 1;
  let cumulativeTime = 0;

  // Simple robust CSV row splitter supporting quotes
  function parseCsvRow(rowStr) {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < rowStr.length; i++) {
      const ch = rowStr[i];
      if (ch === '"') {
        if (inQuotes && rowStr[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  let hasExplicitTimeCol = false;
  let startColIdx = -1;
  let endColIdx = -1;
  let textColIdx = -1;

  for (let r = 0; r < lines.length; r++) {
    const rawRow = lines[r].trim();
    if (!rawRow) continue;
    const cells = parseCsvRow(rawRow);
    if (cells.length === 0) continue;

    // Check header row on first line
    if (r === 0) {
      const lower = cells.map(c => c.toLowerCase());
      const hasHeaderWord = lower.some(c => c.includes('stt') || c.includes('index') || c.includes('text') || c.includes('nội dung') || c.includes('câu') || c.includes('start') || c.includes('time'));
      if (hasHeaderWord) {
        startColIdx = lower.findIndex(c => c.includes('start') || c.includes('bắt đầu') || c.includes('from'));
        endColIdx = lower.findIndex(c => c.includes('end') || c.includes('kết thúc') || c.includes('to'));
        textColIdx = lower.findIndex(c => c.includes('text') || c.includes('nội dung') || c.includes('content') || c.includes('câu') || c.includes('thoại'));
        if (startColIdx >= 0 && endColIdx >= 0) hasExplicitTimeCol = true;
        continue; // skip header
      }
    }

    // Extract text and timestamps
    let text = '';
    let startSec = cumulativeTime;
    let endSec = cumulativeTime + 3;

    if (hasExplicitTimeCol && startColIdx >= 0 && endColIdx >= 0 && textColIdx >= 0) {
      startSec = parseVttTime(cells[startColIdx]);
      endSec = parseVttTime(cells[endColIdx]);
      text = cells[textColIdx] || '';
    } else if (cells.length >= 3 && cells[0].includes('-->')) {
      // row format: [ "00:00:01 --> 00:00:04", "Text" ]
      const timeMatch = cells[0].match(/((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{2}:)?\d{2}:\d{2}[\.,]\d{3})/);
      if (timeMatch) {
        startSec = parseVttTime(timeMatch[1]);
        endSec = parseVttTime(timeMatch[2]);
        text = cells[1] || '';
      }
    } else {
      // Find the main text column
      if (textColIdx >= 0 && cells[textColIdx]) {
        text = cells[textColIdx];
      } else if (cells.length === 1) {
        text = cells[0];
      } else if (cells.length >= 2) {
        // If col 0 is a number, take col 1
        if (/^\d+$/.test(cells[0])) {
          text = cells[1];
        } else {
          text = cells.join(' - ');
        }
      }
    }

    text = text.replace(/^"|"$/g, '').trim();
    if (!text) continue;

    const estDuration = Math.max(1.5, Math.min(10, text.length * 0.08));
    if (!hasExplicitTimeCol) {
      startSec = cumulativeTime;
      endSec = cumulativeTime + estDuration;
      cumulativeTime = endSec + 0.5;
    }

    cues.push({
      id: 'cue_' + index,
      index: index,
      startTime: formatVttTime(startSec),
      endTime: formatVttTime(endSec),
      startSec: startSec,
      endSec: endSec,
      duration: Math.max(0.5, endSec - startSec),
      text: text
    });
    index++;
  }

  return cues;
}

// Universal File Parser
function parseAnyFile(content, fileName = '') {
  const ext = fileName.toLowerCase().split('.').pop();
  let cues = [];

  if (ext === 'txt') {
    cues = parseTxt(content);
    state.fileType = 'txt';
    state.hasTimeline = false;
  } else if (ext === 'csv') {
    cues = parseCsv(content);
    state.fileType = 'csv';
    state.hasTimeline = content.includes('-->') || content.toLowerCase().includes('start');
  } else {
    // Default VTT / SRT
    if (content.includes('-->')) {
      cues = parseVtt(content);
      state.fileType = ext === 'srt' ? 'srt' : 'vtt';
      state.hasTimeline = true;
    } else if (content.includes(',') || content.includes(';') || content.includes('\t')) {
      cues = parseCsv(content);
      state.fileType = 'csv';
      state.hasTimeline = false;
    } else {
      cues = parseTxt(content);
      state.fileType = 'txt';
      state.hasTimeline = false;
    }
  }

  return cues;
}

// Download Helper
function downloadFile(filename, textContent, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([textContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ==================== 2. Audio Processing Utilities ====================

function base64ToBlob(base64Str, mimeType = 'audio/mp3') {
  const binary = atob(base64Str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ==================== 3. Rendering Functions ====================

function renderHeaderStatus() {
  const apiKeyText = document.getElementById('header-api-text');
  const statusDot = document.getElementById('header-api-status-dot');
  const headerApiBtn = document.getElementById('header-api-btn');

  if (apiKeyText) apiKeyText.textContent = 'Edge TTS';
  if (statusDot) {
    statusDot.className = 'status-dot dot-green';
    statusDot.title = 'Microsoft Edge TTS: Đang hoạt động (Neural Voices)';
  }
  if (headerApiBtn) {
    headerApiBtn.title = 'Sử dụng 100% Microsoft Edge TTS Neural chất lượng cao';
  }
}

function renderModeButtons() {
  const btnTimed = document.getElementById('mode-btn-timed');
  const btnUntimed = document.getElementById('mode-btn-untimed');
  if (btnTimed && btnUntimed) {
    if (state.hasTimeline) {
      btnTimed.classList.add('active');
      btnUntimed.classList.remove('active');
    } else {
      btnUntimed.classList.add('active');
      btnTimed.classList.remove('active');
    }
  }
}

function renderCompactBar() {
  const engineTag = document.getElementById('compact-engine-tag');
  const speedTag = document.getElementById('compact-speed-tag');
  const pitchTag = document.getElementById('compact-pitch-tag');
  const timingInfo = document.getElementById('compact-timing-info');

  const selectedVoiceObj = state.config.voices.find(v => v.id === state.settings.voice);
  const voiceName = selectedVoiceObj ? selectedVoiceObj.name : state.settings.voice;

  if (engineTag) {
    engineTag.textContent = state.settings.engine === 'browser' ? 'Giọng Trình duyệt (Offline)' : `${voiceName}`;
  }
  if (speedTag) speedTag.textContent = `${state.settings.speed.toFixed(2)}x`;
  if (pitchTag) pitchTag.textContent = `${state.settings.pitch * 4 >= 0 ? '+' : ''}${state.settings.pitch * 4}Hz`;
  if (timingInfo) {
    const typeBadge = `<span class="badge-file-type">${(state.fileType || 'VTT').toUpperCase()}</span>`;
    if (state.hasTimeline && state.settings.preserveTiming) {
      timingInfo.innerHTML = `${typeBadge} Khớp mốc thời gian phụ đề`;
    } else {
      timingInfo.innerHTML = `${typeBadge} Đọc liên tục (Không timeline) • Nghỉ: ${state.settings.pauseBetweenCues}s`;
    }
  }
  renderModeButtons();
}

function renderCuesTimeline() {
  const container = document.getElementById('cues-timeline-list');
  const emptyState = document.getElementById('cues-empty-state');
  const rawTextarea = document.getElementById('raw-vtt-textarea');
  const countLabel = document.getElementById('cues-count-label');

  if (countLabel) {
    countLabel.textContent = `${state.cues.length} ${state.hasTimeline ? 'câu phụ đề' : 'đoạn văn bản'}`;
  }

  if (!container) return;

  if (state.cues.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (rawTextarea) rawTextarea.value = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Update raw textarea in accordance with the current format/mode
  if (rawTextarea) {
    if (state.hasTimeline) {
      let rawStr = 'WEBVTT\n\n';
      state.cues.forEach(c => {
        rawStr += `${c.startTime} --> ${c.endTime}\n${c.text}\n\n`;
      });
      rawTextarea.value = rawStr.trim();
    } else if (state.fileType === 'csv') {
      let csvStr = 'STT,Nội dung\n';
      state.cues.forEach(c => {
        csvStr += `${c.index},"${c.text.replace(/"/g, '""')}"\n`;
      });
      rawTextarea.value = csvStr.trim();
    } else {
      let txtStr = '';
      state.cues.forEach(c => {
        txtStr += `${c.text}\n`;
      });
      rawTextarea.value = txtStr.trim();
    }
  }

  container.innerHTML = '';
  state.cues.forEach((cue) => {
    const card = document.createElement('div');
    card.className = `cue-card ${state.activePlaybackCueIndex === cue.index ? 'active-playback' : ''}`;
    card.id = `cue-item-cue_${cue.index}`;
    card.setAttribute('data-id', cue.id);

    const isPlayingThis = state.playingCueId === cue.id;
    const wordCount = cue.text.split(/\s+/).filter(Boolean).length;
    const charCount = cue.text.length;

    let timeBadgeHtml = '';
    if (state.hasTimeline) {
      timeBadgeHtml = `
        <div class="cue-row-time">
          <span class="cue-time-badge">
            <span class="material-symbols-outlined" style="font-size:13px;">schedule</span>
            ${cue.startTime} ➔ ${cue.endTime}
          </span>
          <span class="cue-duration-tag">${cue.duration.toFixed(1)}s</span>
        </div>
      `;
    } else {
      timeBadgeHtml = `
        <div class="cue-row-time">
          <span class="cue-time-badge" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;">
            <span class="material-symbols-outlined" style="font-size:13px;">format_quote</span>
            ${wordCount} từ • ${charCount} ký tự
          </span>
          <span class="cue-duration-tag" style="background:var(--color-primary-light); color:var(--color-primary);">Đọc nối tiếp</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="cue-row-top">
        <div class="cue-row-top-left">
          <span class="cue-index">${state.hasTimeline ? '#' + cue.index : 'Đoạn ' + cue.index}</span>
        </div>
        <div class="cue-row-top-right">
          <button type="button" class="btn btn-secondary btn-sm preview-cue-btn" data-id="${cue.id}">
            <span class="material-symbols-outlined icon-sm">${isPlayingThis ? 'pause' : 'play_arrow'}</span>
            <span>${isPlayingThis ? 'Dừng' : 'Phát thử'}</span>
          </button>
          <button type="button" class="btn btn-rose-soft btn-sm delete-cue-btn" data-id="${cue.id}" title="Xóa câu này">
            <span class="material-symbols-outlined icon-sm">delete</span>
          </button>
        </div>
      </div>
      ${timeBadgeHtml}
      <textarea class="cue-text-input" data-id="${cue.id}" rows="2">${escapeHtml(cue.text)}</textarea>
    `;
    container.appendChild(card);
  });

  // Clicking on a cue seeks to its position during audio playback
  container.querySelectorAll('.cue-card').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('input')) return;
      const id = item.getAttribute('data-id');
      const cue = state.cues.find(c => c.id === id);
      if (cue && state.generationResult && mainAudio.src) {
        const timing = state.generationResult.cueTimings?.find(t => t.id === id || t.index === cue.index);
        const seekTime = timing ? timing.start : cue.startSec;
        if (typeof seekTime === 'number' && !isNaN(seekTime)) {
          mainAudio.currentTime = seekTime;
          if (mainAudio.paused) mainAudio.play();
        }
      }
    });
  });

  // Event bindings
  container.querySelectorAll('.cue-text-input').forEach(t => {
    t.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const cue = state.cues.find(c => c.id === id);
      if (cue) cue.text = e.target.value;
    });
    t.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const cue = state.cues.find(c => c.id === id);
      if (cue) {
        cue.text = e.target.value.trim();
        renderCuesTimeline();
      }
    });
  });

  container.querySelectorAll('.delete-cue-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      state.cues = state.cues.filter(c => c.id !== id);
      state.cues.forEach((c, i) => c.index = i + 1);
      renderCuesTimeline();
    });
  });

  container.querySelectorAll('.preview-cue-btn').forEach(b => {
    b.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const cue = state.cues.find(c => c.id === id);
      if (cue) handlePreviewSingleCue(cue);
    });
  });
}

// Export Functions
function exportVtt() {
  if (state.cues.length === 0) return alert('Không có nội dung để xuất.');
  let rawStr = 'WEBVTT\n\n';
  state.cues.forEach(c => {
    rawStr += `${c.startTime} --> ${c.endTime}\n${c.text}\n\n`;
  });
  const baseName = (state.fileName || 'thuyet-minh').replace(/\.[^/.]+$/, '');
  downloadFile(`${baseName}.vtt`, rawStr.trim(), 'text/vtt;charset=utf-8');
}

function exportTxt() {
  if (state.cues.length === 0) return alert('Không có nội dung để xuất.');
  let rawStr = state.cues.map(c => c.text).join('\n\n');
  const baseName = (state.fileName || 'thuyet-minh').replace(/\.[^/.]+$/, '');
  downloadFile(`${baseName}.txt`, rawStr.trim(), 'text/plain;charset=utf-8');
}

function exportCsv() {
  if (state.cues.length === 0) return alert('Không có nội dung để xuất.');
  let csvStr = '';
  if (state.hasTimeline) {
    csvStr = 'STT,Thời gian bắt đầu,Thời gian kết thúc,Thời lượng (s),Nội dung\n';
    state.cues.forEach(c => {
      csvStr += `${c.index},${c.startTime},${c.endTime},${c.duration.toFixed(2)},"${c.text.replace(/"/g, '""')}"\n`;
    });
  } else {
    csvStr = 'STT,Nội dung\n';
    state.cues.forEach(c => {
      csvStr += `${c.index},"${c.text.replace(/"/g, '""')}"\n`;
    });
  }
  const baseName = (state.fileName || 'thuyet-minh').replace(/\.[^/.]+$/, '');
  downloadFile(`${baseName}.csv`, csvStr.trim(), 'text/csv;charset=utf-8');
}

function renderVoiceCards() {
  const container = document.getElementById('voice-cards-grid');
  if (!container) return;

  container.innerHTML = '';
  state.config.voices.forEach(voice => {
    const isSelected = state.settings.voice === voice.id && state.settings.engine === 'edge';
    const card = document.createElement('div');
    card.className = `voice-card ${isSelected ? 'selected' : ''}`;
    card.setAttribute('data-voice-id', voice.id);

    card.innerHTML = `
      <div class="voice-card-header">
        <span class="voice-name">${voice.name}</span>
        <span class="voice-gender-badge ${voice.gender === 'female' ? 'badge-female' : 'badge-male'}">
          ${voice.gender === 'female' ? 'Nữ' : 'Nam'}
        </span>
      </div>
      <div class="voice-desc">${voice.toneDescription}</div>
      <div style="font-size:10px; color:var(--text-sub); margin-bottom:10px;"><strong>Phù hợp:</strong> ${voice.recommendedFor}</div>
      <div class="flex-between">
        <button type="button" class="btn btn-amber-soft btn-sm test-voice-btn" data-voice="${voice.id}">
          <span class="material-symbols-outlined icon-sm">play_arrow</span>
          <span>Nghe giọng mẫu</span>
        </button>
        <span style="font-size:11px; font-weight:700; color:${isSelected ? 'var(--color-accent)' : 'var(--text-muted)'};">
          ${isSelected ? '✓ Đang chọn' : 'Chọn'}
        </span>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.test-voice-btn')) return;
      state.settings.voice = voice.id;
      
      // Auto sync artist name in MP3 Metadata with newly selected voice if user hasn't typed custom artist
      if (!state.customArtistSet) {
        if (!state.mp3Metadata) state.mp3Metadata = {};
        state.mp3Metadata.artist = voice.name;
      }
      
      renderVoiceCards();
      renderCompactBar();
      updatePlayerMetadataDisplay();
    });

    card.querySelector('.test-voice-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      handlePreviewVoiceSample(voice.id, voice.previewPrompt);
    });

    container.appendChild(card);
  });
}

function renderPlayer(result) {
  const playerSection = document.getElementById('audio-player-section');
  if (!playerSection) return;

  if (!result) {
    playerSection.style.display = 'none';
    return;
  }

  playerSection.style.display = 'block';
  const formattedDur = formatPlayerTime(result.duration);
  document.getElementById('player-duration-text').textContent = formattedDur;
  const durLabel = document.getElementById('player-duration-label');
  if (durLabel) durLabel.textContent = formattedDur;
  document.getElementById('player-size-text').textContent = (result.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
  document.getElementById('player-bitrate-text').textContent = `${result.bitrate} kbps`;

  mainAudio.src = result.url;
  updatePlayerMetadataDisplay();
}

function updatePlayerMetadataDisplay() {
  const displayTitle = document.getElementById('player-display-title');
  const displayArtist = document.getElementById('player-display-artist');
  const coverThumb = document.getElementById('player-cover-thumb');
  const defaultIcon = document.getElementById('player-default-icon');

  const selectedVoiceObj = state.config.voices.find(v => v.id === state.settings.voice);
  const currentVoiceName = selectedVoiceObj ? selectedVoiceObj.name : state.settings.voice;

  const activeTitle = (state.mp3Metadata && state.mp3Metadata.title) || state.fileName.replace(/\.[^/.]+$/, '') || 'Bản Ghi Âm Thanh MP3 Hoàn Chỉnh';
  const activeArtist = (state.mp3Metadata && state.mp3Metadata.artist) || currentVoiceName || 'VoiceSub AI';

  if (displayTitle) displayTitle.textContent = activeTitle;
  if (displayArtist) displayArtist.textContent = activeArtist;

  if (coverThumb && defaultIcon) {
    if (state.mp3Metadata && state.mp3Metadata.coverImage && state.mp3Metadata.coverImage.dataUrl) {
      coverThumb.src = state.mp3Metadata.coverImage.dataUrl;
      coverThumb.style.display = 'block';
      defaultIcon.style.display = 'none';
    } else {
      coverThumb.style.display = 'none';
      defaultIcon.style.display = 'block';
    }
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==================== 4. Backend Actions & TTS Synthesis ====================

/**
 * Safe fetch JSON helper - gracefully handles 405/404 on static hosts
 */
async function safeFetchJson(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (res.status === 405 || res.status === 404) {
      const err = new Error(`Máy chủ chạy chế độ tĩnh (Mã ${res.status}).`);
      err.isStaticOr405 = true;
      throw err;
    }

    const text = await res.text();
    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      if (text.includes('405 Not Allowed') || text.includes('File not found') || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) {
        const err = new Error(`Môi trường web tĩnh hoặc máy chủ phản hồi mã ${res.status}.`);
        err.isStaticOr405 = true;
        throw err;
      }
      throw new Error(`Phản hồi máy chủ: ${text.slice(0, 80)}`);
    }

    if (!res.ok) {
      throw new Error(data?.error || `Lỗi yêu cầu: HTTP ${res.status}`);
    }

    return data;
  } catch (err) {
    throw err;
  }
}

// Client-side fallback audio player using Web Speech API
function speakNativeClient(text, lang = 'vi-VN') {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = Number(state.settings.speed) || 1.0;
  utter.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const targetVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
  if (targetVoice) utter.voice = targetVoice;

  window.speechSynthesis.speak(utter);
}

async function handlePreviewVoiceSample(voiceId, text) {
  cueAudio.pause();

  // 1. If PyScript Python Engine is chosen and ready
  if (state.settings.engine === 'pyscript' && window.pyEdgeTTS) {
    try {
      const sampleText = text || (voiceId.startsWith('vi-') ? 'Xin chào! Đây là giọng đọc mẫu qua PyScript Python.' : 'Hello! This is a Python PyScript sample.');
      const result = await window.pyEdgeTTS.synthesize(sampleText, voiceId, '+0%', '+0Hz');
      if (result && result.url) {
        cueAudio.src = result.url;
        cueAudio.play();
        return;
      }
    } catch (pyErr) {
      console.warn('Lỗi chạy PyScript Python, chuyển sang phương thức dự phòng:', pyErr);
    }
  }

  // 2. Pure JS EdgeTTS Client
  if (state.settings.engine === 'js' && window.EdgeTTS) {
    try {
      const res = await window.EdgeTTS.previewSample(voiceId, text);
      if (res && res.url) {
        cueAudio.src = res.url;
        cueAudio.play();
        return;
      }
    } catch (jsErr) {
      console.warn('EdgeTTS JS error, fallback to server/client:', jsErr);
    }
  }

  // 3. Server or Automatic Edge TTS
  try {
    const data = await safeFetchJson('/api/tts/sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voice: voiceId, text })
    });

    if (!data.mp3Base64) {
      throw new Error(data.error || 'Không nhận được dữ liệu giọng mẫu từ Microsoft Edge TTS.');
    }

    const mp3Blob = base64ToBlob(data.mp3Base64, 'audio/mp3');
    cueAudio.src = URL.createObjectURL(mp3Blob);
    cueAudio.play();
  } catch (err) {
    if (err.isStaticOr405) {
      // Fallback to client browser voice in pure static mode
      speakNativeClient(text || (voiceId.startsWith('vi-') ? 'Xin chào, đây là giọng đọc mẫu.' : 'Hello, this is a sample voice.'));
    } else {
      console.error('Lỗi nghe thử giọng Microsoft Edge TTS:', err);
      alert(`Lỗi Microsoft Edge TTS: ${err.message || 'Không thể kết nối máy chủ.'}`);
    }
  }
}

async function handlePreviewSingleCue(cue) {
  if (state.playingCueId === cue.id) {
    cueAudio.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.playingCueId = null;
    renderCuesTimeline();
    return;
  }

  cueAudio.pause();
  state.playingCueId = cue.id;
  renderCuesTimeline();

  const tone = state.config.tones.find(t => t.id === state.settings.toneStyle);
  const rate = tone ? tone.rate : undefined;
  const pitchStr = tone ? tone.pitch : undefined;

  // 1. PyScript Python Engine
  if (state.settings.engine === 'pyscript' && window.pyEdgeTTS) {
    try {
      const result = await window.pyEdgeTTS.synthesize(cue.text, state.settings.voice, rate || '+0%', pitchStr || '+0Hz');
      if (result && result.url) {
        cueAudio.src = result.url;
        cueAudio.onended = () => {
          state.playingCueId = null;
          renderCuesTimeline();
        };
        cueAudio.onerror = () => {
          state.playingCueId = null;
          renderCuesTimeline();
        };
        cueAudio.play();
        return;
      }
    } catch (pyErr) {
      console.warn('Lỗi PyScript câu đơn:', pyErr);
    }
  }

  // 2. Pure JS EdgeTTS Client
  if (state.settings.engine === 'js' && window.EdgeTTS) {
    try {
      const res = await window.EdgeTTS.synthesize(cue.text, {
        voice: state.settings.voice,
        speed: state.settings.speed,
        rate,
        pitch: pitchStr
      });
      if (res && res.url) {
        cueAudio.src = res.url;
        cueAudio.onended = () => {
          state.playingCueId = null;
          renderCuesTimeline();
        };
        cueAudio.onerror = () => {
          state.playingCueId = null;
          renderCuesTimeline();
        };
        cueAudio.play();
        return;
      }
    } catch (jsErr) {
      console.warn('Lỗi EdgeTTS JS câu đơn:', jsErr);
    }
  }

  // 3. Server / Safe Fetch
  try {
    const data = await safeFetchJson('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cue.text,
        voice: state.settings.voice,
        speed: state.settings.speed,
        pitch: state.settings.pitch,
        rate,
        pitchStr
      })
    });

    if (!data.mp3Base64) {
      throw new Error(data.error || 'Lỗi khi tạo giọng đọc câu này từ Microsoft Edge TTS.');
    }

    const mp3Blob = base64ToBlob(data.mp3Base64, 'audio/mp3');
    cueAudio.src = URL.createObjectURL(mp3Blob);
    cueAudio.onended = () => {
      state.playingCueId = null;
      renderCuesTimeline();
    };
    cueAudio.onerror = () => {
      state.playingCueId = null;
      renderCuesTimeline();
    };
    cueAudio.play();
  } catch (err) {
    if (err.isStaticOr405) {
      // Direct speech in static webview
      speakNativeClient(cue.text);
      setTimeout(() => {
        state.playingCueId = null;
        renderCuesTimeline();
      }, Math.max(1500, cue.duration * 1000));
    } else {
      console.error('Lỗi tạo giọng đọc câu đơn từ Microsoft Edge TTS:', err);
      state.playingCueId = null;
      renderCuesTimeline();
      alert(`Lỗi Microsoft Edge TTS: ${err.message || 'Không thể tạo âm thanh cho câu này.'}`);
    }
  }
}

// Generate Full Audio in a Single Request to Edge TTS backend
async function handleGenerateFullAudio() {
  if (state.cues.length === 0) {
    alert('Vui lòng thêm ít nhất một câu phụ đề để tạo âm thanh.');
    return;
  }

  const progressBox = document.getElementById('batch-progress-box');
  const progressText = document.getElementById('batch-progress-text');
  const progressBar = document.getElementById('batch-progress-bar');
  const percentText = document.getElementById('batch-percent-text');

  if (progressBox) {
    progressBox.classList.add('active');
    progressBox.classList.remove('error');
    if (progressBar) progressBar.style.backgroundColor = '';
  }

  const updateProgress = (pct, msg) => {
    if (progressText) progressText.textContent = msg;
    if (progressBar) progressBar.style.width = pct + '%';
    if (percentText) percentText.textContent = `${pct}%`;
  };

  const tone = state.config.tones.find(t => t.id === state.settings.toneStyle);
  const rate = tone ? tone.rate : undefined;
  const pitchStr = tone ? tone.pitch : undefined;

  // 1. PyScript Python Engine Execution
  if (state.settings.engine === 'pyscript' && window.pyEdgeTTS) {
    updateProgress(20, 'Đang khởi chạy PyScript Python WebAssembly Engine...');
    try {
      const audioChunks = [];
      const cueTimings = [];
      let accumulatedTime = 0;
      const total = state.cues.length;

      for (let i = 0; i < total; i++) {
        const cue = state.cues[i];
        const pct = Math.round(20 + ((i + 1) / total) * 70);
        updateProgress(pct, `[PyScript Python] Đang chuyển đổi câu ${i + 1}/${total} ("${cue.text.slice(0, 20)}...")...`);

        const res = await window.pyEdgeTTS.synthesize(cue.text, state.settings.voice, rate || '+0%', pitchStr || '+0Hz');
        const buf = await res.blob.arrayBuffer();
        audioChunks.push(new Uint8Array(buf));

        const cueDuration = cue.duration || (cue.endSec - cue.startSec) || 2.0;
        cueTimings.push({
          id: cue.id || `cue_${i + 1}`,
          index: i + 1,
          text: cue.text,
          start: cue.startSec !== undefined ? cue.startSec : accumulatedTime,
          end: cue.endSec !== undefined ? cue.endSec : accumulatedTime + cueDuration,
          duration: cueDuration
        });
        accumulatedTime += cueDuration + (state.settings.pauseBetweenCues || 0.3);
      }

      updateProgress(95, 'Đang hoàn tất gói file MP3 từ PyScript...');
      const finalBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      state.generationResult = {
        blob: finalBlob,
        url: URL.createObjectURL(finalBlob),
        duration: accumulatedTime,
        fileSize: finalBlob.size,
        bitrate: state.settings.bitrate,
        cueTimings
      };

      renderPlayer(state.generationResult);
      updateProgress(100, 'Hoàn tất! Đã tạo file MP3 bằng PyScript Python Engine thành công.');

      if (progressText) {
        progressText.innerHTML = '<span class="material-symbols-outlined icon-sm" style="color:var(--color-accent); vertical-align:middle;">check_circle</span> <strong>Thành công (PyScript):</strong> File MP3 đã sẵn sàng tải về!';
      }

      setTimeout(() => {
        if (progressBox) progressBox.classList.remove('active');
      }, 2500);

      const playerSec = document.getElementById('audio-player-section');
      if (playerSec) playerSec.scrollIntoView({ behavior: 'smooth' });
      return;
    } catch (pyErr) {
      console.warn('Lỗi xử lý qua PyScript Python, chuyển sang phương thức dự phòng:', pyErr);
    }
  }

  // 2. Pure JS EdgeTTS Client (if chosen)
  if (state.settings.engine === 'js' && window.EdgeTTS) {
    try {
      updateProgress(30, 'Đang gửi qua EdgeTTS JavaScript Client...');
      const res = await window.EdgeTTS.synthesizeBatch(state.cues, {
        voice: state.settings.voice,
        speed: state.settings.speed,
        rate,
        pitch: pitchStr,
        preserveTiming: state.hasTimeline && state.settings.preserveTiming,
        pauseBetweenCues: state.settings.pauseBetweenCues,
        bitrate: state.settings.bitrate
      }, updateProgress);

      if (res && res.blob) {
        state.generationResult = res;
        renderPlayer(state.generationResult);
        updateProgress(100, 'Hoàn tất! Đã tạo file MP3 thành công.');
        setTimeout(() => {
          if (progressBox) progressBox.classList.remove('active');
        }, 2500);
        const playerSec = document.getElementById('audio-player-section');
        if (playerSec) playerSec.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    } catch (jsErr) {
      console.warn('Lỗi EdgeTTS JS Batch:', jsErr);
    }
  }

  updateProgress(20, `Đang chuẩn bị toàn bộ ${state.cues.length} câu phụ đề gửi sang Microsoft Edge TTS...`);

  try {
    updateProgress(45, 'Đang gửi yêu cầu chuyển đổi Microsoft Edge TTS toàn bộ sang MP3...');

    const data = await safeFetchJson('/api/tts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cues: state.cues,
        voice: state.settings.voice,
        speed: state.settings.speed,
        pitch: state.settings.pitch,
        rate,
        pitchStr,
        preserveTiming: state.hasTimeline && state.settings.preserveTiming,
        pauseBetweenCues: state.settings.pauseBetweenCues,
        bitrate: state.settings.bitrate,
      })
    });

    if (!data || !data.mp3Base64) {
      throw new Error(data?.error || 'Không nhận được dữ liệu âm thanh từ Microsoft Edge TTS.');
    }

    const mp3Blob = base64ToBlob(data.mp3Base64, 'audio/mp3');
    const backendCueTimings = data.cueTimings;
    const backendDuration = data.duration;

    if (!mp3Blob) {
      throw new Error('Không thể tạo file âm thanh MP3.');
    }

    updateProgress(85, 'Đang đồng bộ mốc thời gian và chuẩn bị bản phát MP3...');

    const mp3Url = URL.createObjectURL(mp3Blob);

    // Get true audio duration
    let totalDuration = backendDuration;
    if (!totalDuration || totalDuration <= 0) {
      const tempAudio = new Audio(mp3Url);
      await new Promise((resolve) => {
        tempAudio.onloadedmetadata = () => resolve();
        tempAudio.onerror = () => resolve();
        setTimeout(resolve, 1500);
      });
      totalDuration = (tempAudio.duration && isFinite(tempAudio.duration) && tempAudio.duration > 0)
        ? tempAudio.duration
        : (state.cues[state.cues.length - 1]?.endSec || 30);
    }

    // Use backend's exact calculated timings or calculate accurate fallback
    let cueTimings = backendCueTimings;
    if (!cueTimings || cueTimings.length === 0) {
      if (state.hasTimeline && state.settings.preserveTiming) {
        cueTimings = state.cues.map(c => ({
          id: c.id,
          index: c.index,
          text: c.text,
          start: c.startSec,
          end: c.endSec,
          duration: c.duration,
        }));
      } else {
        const totalChars = Math.max(1, state.cues.reduce((acc, c) => acc + (c.text.length || 1), 0));
        let accumulatedTime = 0;
        cueTimings = state.cues.map(c => {
          const cueRatio = (c.text.length || 1) / totalChars;
          const cueDur = cueRatio * totalDuration;
          const start = accumulatedTime;
          const end = accumulatedTime + cueDur;
          accumulatedTime = end;
          return {
            id: c.id,
            index: c.index,
            text: c.text,
            start: Number(start.toFixed(3)),
            end: Number(end.toFixed(3)),
            duration: Number(cueDur.toFixed(3)),
          };
        });
      }
    }

    state.generationResult = {
      blob: mp3Blob,
      url: mp3Url,
      duration: totalDuration,
      fileSize: mp3Blob.size,
      bitrate: state.settings.bitrate,
      cueTimings: cueTimings
    };

    renderPlayer(state.generationResult);
    updateProgress(100, 'Hoàn tất! Đã tạo file MP3 cho toàn bộ VTT thành công.');

    if (progressText) {
      progressText.innerHTML = '<span class="material-symbols-outlined icon-sm" style="color:var(--color-accent); vertical-align:middle;">check_circle</span> <strong>Thành công:</strong> Toàn bộ file MP3 đã sẵn sàng tải về!';
    }

    setTimeout(() => {
      if (progressBox) progressBox.classList.remove('active');
    }, 2500);

    // Scroll to player
    const playerSec = document.getElementById('audio-player-section');
    if (playerSec) playerSec.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    if (progressBox) {
      progressBox.classList.add('error');
    }
    if (progressBar) {
      progressBar.style.backgroundColor = 'var(--rose-primary)';
    }

    let userMsg = err.message || 'Không thể tạo âm thanh.';
    if (err.isStaticOr405) {
      userMsg = 'Trang web đang chạy trên máy chủ tĩnh (như GitHub Pages) nên không có máy chủ tạo file MP3 nơ-ron. Vui lòng deploy lên Cloud Run, Render, Vercel hoặc chạy Node.js local để xuất file MP3 Microsoft Edge TTS chuẩn.';
    }

    if (progressText) {
      progressText.innerHTML = `<span class="material-symbols-outlined icon-sm" style="color:var(--rose-primary); vertical-align:middle;">error</span> <strong>✕ Lỗi:</strong> ${escapeHtml(userMsg)}`;
    }
    alert('Không thể tạo file MP3:\n\n' + userMsg);
  }
}

// Download MP3 Handler
async function handleDownloadMp3() {
  if (state.cues.length === 0) {
    alert('Vui lòng thêm hoặc nạp file phụ đề VTT trước.');
    return;
  }

  if (!state.generationResult || !state.generationResult.blob) {
    await handleGenerateFullAudio();
    if (state.generationResult && state.generationResult.blob) {
      await executeMp3Download();
    }
    return;
  }

  await executeMp3Download();
}

// ==================== ID3v2.3 Metadata Engine ====================

function encodeUTF16LE(str) {
  const buf = new Uint8Array(2 + str.length * 2);
  buf[0] = 0xFF; buf[1] = 0xFE; // BOM (Little Endian)
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[2 + i * 2] = code & 0xFF;
    buf[2 + i * 2 + 1] = (code >> 8) & 0xFF;
  }
  return buf;
}

function createUTF16TextFrame(frameId, text) {
  if (!text && text !== 0) return null;
  const str = String(text).trim();
  if (!str) return null;
  const utf16Bytes = encodeUTF16LE(str);
  const data = new Uint8Array(1 + utf16Bytes.length);
  data[0] = 0x01; // UTF-16 with BOM
  data.set(utf16Bytes, 1);

  const header = new Uint8Array(10);
  for (let i = 0; i < 4; i++) header[i] = frameId.charCodeAt(i);
  const len = data.length;
  header[4] = (len >> 24) & 0xFF;
  header[5] = (len >> 16) & 0xFF;
  header[6] = (len >> 8) & 0xFF;
  header[7] = len & 0xFF;

  const res = new Uint8Array(10 + len);
  res.set(header, 0);
  res.set(data, 10);
  return res;
}

function createCommentFrame(comment, lang = 'vie') {
  if (!comment) return null;
  const str = String(comment).trim();
  if (!str) return null;
  const utf16Bytes = encodeUTF16LE(str);

  // Prefix: Encoding (0x01) + Lang (3 bytes) + Empty Description (0xFF, 0xFE, 0x00, 0x00)
  const prefix = new Uint8Array([
    0x01,
    lang.charCodeAt(0) || 118,
    lang.charCodeAt(1) || 105,
    lang.charCodeAt(2) || 101,
    0xFF, 0xFE, 0x00, 0x00
  ]);

  const data = new Uint8Array(prefix.length + utf16Bytes.length);
  data.set(prefix, 0);
  data.set(utf16Bytes, prefix.length);

  const header = new Uint8Array(10);
  const frameId = 'COMM';
  for (let i = 0; i < 4; i++) header[i] = frameId.charCodeAt(i);
  const len = data.length;
  header[4] = (len >> 24) & 0xFF;
  header[5] = (len >> 16) & 0xFF;
  header[6] = (len >> 8) & 0xFF;
  header[7] = len & 0xFF;

  const res = new Uint8Array(10 + len);
  res.set(header, 0);
  res.set(data, 10);
  return res;
}

function createPictureFrame(imageBytes, mimeType = 'image/jpeg') {
  if (!imageBytes || imageBytes.length === 0) return null;
  const mimeBytes = [];
  for (let i = 0; i < mimeType.length; i++) mimeBytes.push(mimeType.charCodeAt(i));
  mimeBytes.push(0);

  const prefixLen = 1 + mimeBytes.length + 1 + 1;
  const data = new Uint8Array(prefixLen + imageBytes.length);
  data[0] = 0x00; // ISO-8859-1 for MIME and description
  data.set(mimeBytes, 1);
  data[1 + mimeBytes.length] = 0x03; // Front Cover
  data[1 + mimeBytes.length + 1] = 0x00; // Empty description
  data.set(imageBytes, prefixLen);

  const header = new Uint8Array(10);
  const frameId = 'APIC';
  for (let i = 0; i < 4; i++) header[i] = frameId.charCodeAt(i);
  const len = data.length;
  header[4] = (len >> 24) & 0xFF;
  header[5] = (len >> 16) & 0xFF;
  header[6] = (len >> 8) & 0xFF;
  header[7] = len & 0xFF;

  const res = new Uint8Array(10 + len);
  res.set(header, 0);
  res.set(data, 10);
  return res;
}

function applyMetadataToMp3(mp3ArrayBuffer, metadata) {
  if (!metadata) return new Blob([mp3ArrayBuffer], { type: 'audio/mp3' });
  const frames = [];

  // Title (TIT2)
  if (metadata.title) {
    const f = createUTF16TextFrame('TIT2', metadata.title);
    if (f) frames.push(f);
  }
  // Artist / Author (TPE1)
  if (metadata.artist) {
    const f = createUTF16TextFrame('TPE1', metadata.artist);
    if (f) frames.push(f);
  }
  // Album (TALB)
  if (metadata.album) {
    const f = createUTF16TextFrame('TALB', metadata.album);
    if (f) frames.push(f);
  }
  // Year (TYER)
  if (metadata.year) {
    const f = createUTF16TextFrame('TYER', metadata.year);
    if (f) frames.push(f);
  }
  // Date (TDRC)
  if (metadata.date) {
    const f = createUTF16TextFrame('TDRC', metadata.date);
    if (f) frames.push(f);
  }
  // Genre (TCON)
  if (metadata.genre) {
    const f = createUTF16TextFrame('TCON', metadata.genre);
    if (f) frames.push(f);
  }
  // Comment (COMM)
  if (metadata.comment) {
    const f = createCommentFrame(metadata.comment);
    if (f) frames.push(f);
  }
  // Cover Art (APIC)
  if (metadata.coverImage && metadata.coverImage.bytes) {
    const f = createPictureFrame(metadata.coverImage.bytes, metadata.coverImage.mimeType || 'image/jpeg');
    if (f) frames.push(f);
  }

  if (frames.length === 0) {
    return new Blob([mp3ArrayBuffer], { type: 'audio/mp3' });
  }

  let totalFramesLen = 0;
  for (const f of frames) totalFramesLen += f.length;

  // ID3v2.3 header (10 bytes)
  const id3Header = new Uint8Array(10);
  id3Header[0] = 0x49; // 'I'
  id3Header[1] = 0x44; // 'D'
  id3Header[2] = 0x33; // '3'
  id3Header[3] = 0x03; // version 2.3
  id3Header[4] = 0x00; // revision
  id3Header[5] = 0x00; // flags

  // Syncsafe integer for frames length
  id3Header[6] = (totalFramesLen >> 21) & 0x7F;
  id3Header[7] = (totalFramesLen >> 14) & 0x7F;
  id3Header[8] = (totalFramesLen >> 7) & 0x7F;
  id3Header[9] = totalFramesLen & 0x7F;

  // Strip existing ID3 header if present
  const mp3Bytes = new Uint8Array(mp3ArrayBuffer);
  let audioOffset = 0;
  if (mp3Bytes.length >= 10 && mp3Bytes[0] === 0x49 && mp3Bytes[1] === 0x44 && mp3Bytes[2] === 0x33) {
    const oldTagSize = ((mp3Bytes[6] & 0x7F) << 21) |
                       ((mp3Bytes[7] & 0x7F) << 14) |
                       ((mp3Bytes[8] & 0x7F) << 7) |
                       (mp3Bytes[9] & 0x7F);
    audioOffset = oldTagSize + 10;
  }
  const cleanAudioBytes = mp3Bytes.subarray(audioOffset);

  const finalData = new Uint8Array(10 + totalFramesLen + cleanAudioBytes.length);
  finalData.set(id3Header, 0);
  let offset = 10;
  for (const f of frames) {
    finalData.set(f, offset);
    offset += f.length;
  }
  finalData.set(cleanAudioBytes, offset);

  return new Blob([finalData], { type: 'audio/mp3' });
}

async function executeMp3Download() {
  if (!state.generationResult || !state.generationResult.blob) {
    alert('Chưa có dữ liệu âm thanh để xuất MP3.');
    return;
  }

  const rawTitle = (state.mp3Metadata && state.mp3Metadata.title) || state.fileName.replace(/\.[^/.]+$/, '') || 'thuyet-minh';
  const cleanTitle = rawTitle.trim().replace(/[\\/:*?"<>|]/g, '_');
  const downloadName = `${cleanTitle}.mp3`;

  try {
    const rawBuffer = await state.generationResult.blob.arrayBuffer();
    const taggedBlob = applyMetadataToMp3(rawBuffer, state.mp3Metadata);

    const url = URL.createObjectURL(taggedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (err) {
    console.error('Lỗi khi nhúng metadata MP3:', err);
    // Fallback directly downloading original audio blob
    const url = URL.createObjectURL(state.generationResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

// Drawer & Modal Openers
function openVoiceDrawer() {
  const drawer = document.getElementById('voice-settings-drawer');
  if (drawer) drawer.classList.add('active');
}

function closeVoiceDrawer() {
  const drawer = document.getElementById('voice-settings-drawer');
  if (drawer) drawer.classList.remove('active');
}

function openInfoModal() {
  const modal = document.getElementById('api-key-modal');
  if (modal) modal.classList.add('active');
}

function closeInfoModal() {
  const modal = document.getElementById('api-key-modal');
  if (modal) modal.classList.remove('active');
}

function openMetadataModal() {
  const titleInput = document.getElementById('meta-title-input');
  const artistInput = document.getElementById('meta-artist-input');
  const albumInput = document.getElementById('meta-album-input');
  const dateInput = document.getElementById('meta-date-input');
  const yearInput = document.getElementById('meta-year-input');
  const genreSelect = document.getElementById('meta-genre-select');
  const commentInput = document.getElementById('meta-comment-input');

  const selectedVoiceObj = state.config.voices.find(v => v.id === state.settings.voice);
  const currentVoiceName = selectedVoiceObj ? selectedVoiceObj.name : state.settings.voice;

  const activeTitle = (state.mp3Metadata && state.mp3Metadata.title) || state.fileName.replace(/\.[^/.]+$/, '');
  const activeArtist = (state.mp3Metadata && state.mp3Metadata.artist) || currentVoiceName;

  if (titleInput) titleInput.value = activeTitle || '';
  if (artistInput) artistInput.value = activeArtist || '';
  if (albumInput) albumInput.value = (state.mp3Metadata && state.mp3Metadata.album) || '';
  if (dateInput) dateInput.value = (state.mp3Metadata && state.mp3Metadata.date) || new Date().toISOString().slice(0, 10);
  if (yearInput) yearInput.value = (state.mp3Metadata && state.mp3Metadata.year) || new Date().getFullYear().toString();
  if (genreSelect) genreSelect.value = (state.mp3Metadata && state.mp3Metadata.genre) || 'Thuyết minh / Phụ đề';
  if (commentInput) commentInput.value = (state.mp3Metadata && state.mp3Metadata.comment) || '';

  renderCoverPreviewInModal();

  const modal = document.getElementById('mp3-metadata-modal');
  if (modal) modal.classList.add('active');
}

function closeMetadataModal() {
  const modal = document.getElementById('mp3-metadata-modal');
  if (modal) modal.classList.remove('active');
}

function saveMetadataFromModal(showFeedback = true) {
  const titleInput = document.getElementById('meta-title-input');
  const artistInput = document.getElementById('meta-artist-input');
  const albumInput = document.getElementById('meta-album-input');
  const dateInput = document.getElementById('meta-date-input');
  const yearInput = document.getElementById('meta-year-input');
  const genreSelect = document.getElementById('meta-genre-select');
  const commentInput = document.getElementById('meta-comment-input');

  if (!state.mp3Metadata) state.mp3Metadata = {};
  if (titleInput) state.mp3Metadata.title = titleInput.value.trim();
  if (artistInput) {
    state.mp3Metadata.artist = artistInput.value.trim();
    state.customArtistSet = true;
  }
  if (albumInput) state.mp3Metadata.album = albumInput.value.trim();
  if (dateInput) state.mp3Metadata.date = dateInput.value;
  if (yearInput) state.mp3Metadata.year = yearInput.value.trim();
  if (genreSelect) state.mp3Metadata.genre = genreSelect.value;
  if (commentInput) state.mp3Metadata.comment = commentInput.value.trim();

  updatePlayerMetadataDisplay();

  if (showFeedback) {
    const saveBtn = document.getElementById('save-meta-modal-btn');
    if (saveBtn) {
      const origHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">check_circle</span> <span>Đã lưu!</span>';
      saveBtn.style.borderColor = 'var(--emerald-primary)';
      setTimeout(() => {
        saveBtn.innerHTML = origHtml;
        saveBtn.style.borderColor = '';
      }, 1500);
    }
  }
}

function renderCoverPreviewInModal() {
  const previewImg = document.getElementById('meta-cover-preview-img');
  const emptyIcon = document.getElementById('cover-empty-icon');
  const emptyText = document.getElementById('cover-empty-text');
  const removeBtn = document.getElementById('meta-remove-cover-btn');

  if (state.mp3Metadata && state.mp3Metadata.coverImage && state.mp3Metadata.coverImage.dataUrl) {
    if (previewImg) {
      previewImg.src = state.mp3Metadata.coverImage.dataUrl;
      previewImg.style.display = 'block';
    }
    if (emptyIcon) emptyIcon.style.display = 'none';
    if (emptyText) emptyText.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'inline-flex';
  } else {
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (emptyIcon) emptyIcon.style.display = 'block';
    if (emptyText) emptyText.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function handleCoverImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Vui lòng chọn một tệp hình ảnh (JPG, PNG, WebP).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobReader = new FileReader();
        blobReader.onload = (ev) => {
          if (!state.mp3Metadata) state.mp3Metadata = {};
          state.mp3Metadata.coverImage = {
            dataUrl: canvas.toDataURL('image/jpeg', 0.88),
            bytes: new Uint8Array(ev.target.result),
            mimeType: 'image/jpeg'
          };
          renderCoverPreviewInModal();
          updatePlayerMetadataDisplay();
        };
        blobReader.readAsArrayBuffer(blob);
      }, 'image/jpeg', 0.88);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function removeCoverImage() {
  if (state.mp3Metadata) {
    state.mp3Metadata.coverImage = null;
  }
  const fileInput = document.getElementById('meta-cover-file-input');
  if (fileInput) fileInput.value = '';
  renderCoverPreviewInModal();
  updatePlayerMetadataDisplay();
}

// ==================== 5. Initialize & Event Listeners ====================

function initEventListeners() {
  // Mode switch buttons (Timed vs Untimed)
  const modeBtnTimed = document.getElementById('mode-btn-timed');
  const modeBtnUntimed = document.getElementById('mode-btn-untimed');

  if (modeBtnTimed) {
    modeBtnTimed.addEventListener('click', () => {
      state.hasTimeline = true;
      state.settings.preserveTiming = true;
      const preserveCheck = document.getElementById('setting-preserve-timing');
      if (preserveCheck) preserveCheck.checked = true;
      renderCompactBar();
      renderCuesTimeline();
    });
  }

  if (modeBtnUntimed) {
    modeBtnUntimed.addEventListener('click', () => {
      state.hasTimeline = false;
      renderCompactBar();
      renderCuesTimeline();
    });
  }

  // Export Buttons
  const exportVttBtn = document.getElementById('export-vtt-btn');
  const exportTxtBtn = document.getElementById('export-txt-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');

  if (exportVttBtn) exportVttBtn.addEventListener('click', exportVtt);
  if (exportTxtBtn) exportTxtBtn.addEventListener('click', exportTxt);
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

  // File Upload Drag & Drop
  const dropzone = document.getElementById('upload-dropzone');
  const fileInput = document.getElementById('vtt-file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  function handleFileSelect(file) {
    state.fileName = file.name;
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    if (state.mp3Metadata) {
      if (!state.mp3Metadata.title || state.mp3Metadata.title === 'Mẫu thuyết minh Vịnh Hạ Long') {
        state.mp3Metadata.title = baseName;
      }
    }
    updatePlayerMetadataDisplay();

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      state.cues = parseAnyFile(content, file.name);
      renderCuesTimeline();
      renderCompactBar();
      renderHeaderStatus();

      const fileInfoName = document.getElementById('file-info-name');
      if (fileInfoName) {
        fileInfoName.textContent = `${file.name} (${state.cues.length} câu) - Sẵn sàng tạo âm thanh`;
        fileInfoName.style.color = 'var(--color-accent)';
        fileInfoName.style.fontWeight = '700';
      }
    };
    reader.readAsText(file);
  }

  // Tab switcher
  const tabCues = document.getElementById('tab-btn-cues');
  const tabRaw = document.getElementById('tab-btn-raw');
  const viewCues = document.getElementById('view-cues-list');
  const viewRaw = document.getElementById('view-raw-vtt');

  if (tabCues && tabRaw && viewCues && viewRaw) {
    tabCues.addEventListener('click', () => {
      tabCues.classList.add('active');
      tabRaw.classList.remove('active');
      viewCues.style.display = 'block';
      viewRaw.style.display = 'none';
    });

    tabRaw.addEventListener('click', () => {
      tabRaw.classList.add('active');
      tabCues.classList.remove('active');
      viewCues.style.display = 'none';
      viewRaw.style.display = 'block';
    });
  }

  // Apply Raw text
  const applyRawBtn = document.getElementById('apply-raw-vtt-btn');
  if (applyRawBtn) {
    applyRawBtn.addEventListener('click', () => {
      const textarea = document.getElementById('raw-vtt-textarea');
      if (textarea) {
        state.cues = parseAnyFile(textarea.value, state.fileName);
        renderCuesTimeline();
        renderCompactBar();
        renderHeaderStatus();
        if (tabCues) tabCues.click();
      }
    });
  }

  // Add new Cue
  const addCueBtn = document.getElementById('add-new-cue-btn');
  if (addCueBtn) {
    addCueBtn.addEventListener('click', () => {
      const lastCue = state.cues[state.cues.length - 1];
      const startSec = lastCue ? lastCue.endSec + 0.5 : 0;
      const endSec = startSec + 3.0;
      const newCue = {
        id: 'cue_' + (state.cues.length + 1),
        index: state.cues.length + 1,
        startTime: formatVttTime(startSec),
        endTime: formatVttTime(endSec),
        startSec: startSec,
        endSec: endSec,
        duration: 3.0,
        text: 'Nội dung thuyết minh mới...'
      };
      state.cues.push(newCue);
      renderCuesTimeline();
      renderCompactBar();
      renderHeaderStatus();
      setTimeout(() => {
        const el = document.getElementById(`cue-item-${newCue.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    });
  }

  // Voice Settings Triggers
  const openVoiceBtnHeader = document.getElementById('header-voice-btn');
  const openVoiceBtnCompact = document.getElementById('compact-open-voice-btn');
  const bannerApiBtn = document.getElementById('banner-api-btn');
  const closeVoiceBtn = document.getElementById('close-voice-drawer-btn');
  const doneVoiceBtn = document.getElementById('done-voice-drawer-btn');

  [openVoiceBtnHeader, openVoiceBtnCompact, bannerApiBtn].forEach(b => {
    if (b) b.addEventListener('click', openVoiceDrawer);
  });

  [closeVoiceBtn, doneVoiceBtn].forEach(b => {
    if (b) b.addEventListener('click', closeVoiceDrawer);
  });

  const drawerOverlay = document.getElementById('voice-settings-drawer');
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) closeVoiceDrawer();
    });
  }

  // Info Modal Triggers
  const headerApiBtn = document.getElementById('header-api-btn');
  const modalCloseBtn = document.getElementById('close-api-modal-btn');
  const modalSaveBtn = document.getElementById('save-api-key-btn');
  const infoModalOverlay = document.getElementById('api-key-modal');

  if (headerApiBtn) headerApiBtn.addEventListener('click', openInfoModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeInfoModal);
  if (modalSaveBtn) modalSaveBtn.addEventListener('click', closeInfoModal);
  if (infoModalOverlay) {
    infoModalOverlay.addEventListener('click', (e) => {
      if (e.target === infoModalOverlay) closeInfoModal();
    });
  }

  // Reset Settings
  const resetSettingsBtn = document.getElementById('reset-settings-btn');
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', () => {
      state.settings = {
        engine: 'auto',
        voice: 'vi-VN-HoaiMyNeural',
        speed: 1.0,
        pitch: 0,
        toneStyle: 'default',
        preserveTiming: true,
        pauseBetweenCues: 0.5,
        bitrate: 192
      };
      state.customArtistSet = false;
      if (state.mp3Metadata) {
        state.mp3Metadata.artist = 'Hoài My (Nữ)';
      }
      syncSettingsForm();
      renderVoiceCards();
      renderCompactBar();
      updatePlayerMetadataDisplay();
    });
  }

  // Form Controls
  const engineSelect = document.getElementById('setting-engine');
  const toneSelect = document.getElementById('setting-tone');
  const speedSlider = document.getElementById('setting-speed');
  const speedVal = document.getElementById('setting-speed-val');
  const pitchSlider = document.getElementById('setting-pitch');
  const pitchVal = document.getElementById('setting-pitch-val');
  const preserveCheck = document.getElementById('setting-preserve-timing');
  const pauseSlider = document.getElementById('setting-pause');
  const pauseVal = document.getElementById('setting-pause-val');
  const bitrateSelect = document.getElementById('setting-bitrate');

  if (engineSelect) {
    engineSelect.addEventListener('change', () => {
      state.settings.engine = engineSelect.value;
      renderCompactBar();
    });
  }

  // PyScript Ready Listener
  window.onPyScriptLoaded = function() {
    console.log('PyScript Edge TTS Engine đã tải hoàn tất.');
    const badgeText = document.getElementById('pyscript-status-text');
    if (badgeText) {
      badgeText.innerHTML = '<strong>PyScript Python Engine:</strong> Sẵn sàng';
    }
  };

  if (toneSelect) {
    toneSelect.addEventListener('change', () => {
      state.settings.toneStyle = toneSelect.value;
      renderCompactBar();
    });
  }

  if (speedSlider && speedVal) {
    speedSlider.addEventListener('input', () => {
      state.settings.speed = parseFloat(speedSlider.value);
      const pct = Math.round((state.settings.speed - 1.0) * 100);
      speedVal.textContent = `${state.settings.speed.toFixed(2)}x (${pct >= 0 ? '+' : ''}${pct}%)`;
      renderCompactBar();
    });
  }

  if (pitchSlider && pitchVal) {
    pitchSlider.addEventListener('input', () => {
      state.settings.pitch = parseInt(pitchSlider.value, 10);
      const hz = state.settings.pitch * 4;
      pitchVal.textContent = `${hz >= 0 ? '+' : ''}${hz}Hz`;
      renderCompactBar();
    });
  }

  if (preserveCheck) {
    preserveCheck.addEventListener('change', () => {
      state.settings.preserveTiming = preserveCheck.checked;
      renderCompactBar();
    });
  }

  if (pauseSlider && pauseVal) {
    pauseSlider.addEventListener('input', () => {
      state.settings.pauseBetweenCues = parseFloat(pauseSlider.value);
      pauseVal.textContent = state.settings.pauseBetweenCues.toFixed(1) + 's';
      renderCompactBar();
    });
  }

  if (bitrateSelect) {
    bitrateSelect.addEventListener('change', () => {
      state.settings.bitrate = parseInt(bitrateSelect.value, 10);
      renderCompactBar();
    });
  }

  function syncSettingsForm() {
    if (engineSelect) engineSelect.value = state.settings.engine;
    if (toneSelect) toneSelect.value = state.settings.toneStyle;
    if (speedSlider) speedSlider.value = state.settings.speed;
    if (speedVal) {
      const pct = Math.round((state.settings.speed - 1.0) * 100);
      speedVal.textContent = `${state.settings.speed.toFixed(2)}x (${pct >= 0 ? '+' : ''}${pct}%)`;
    }
    if (pitchSlider) pitchSlider.value = state.settings.pitch;
    if (pitchVal) {
      const hz = state.settings.pitch * 4;
      pitchVal.textContent = `${hz >= 0 ? '+' : ''}${hz}Hz`;
    }
    if (preserveCheck) preserveCheck.checked = state.settings.preserveTiming;
    if (pauseSlider) pauseSlider.value = state.settings.pauseBetweenCues;
    if (pauseVal) pauseVal.textContent = state.settings.pauseBetweenCues.toFixed(1) + 's';
    if (bitrateSelect) bitrateSelect.value = state.settings.bitrate;
  }

  // Batch Audio Generation Buttons
  const genButtons = document.querySelectorAll('#floating-generate-btn, #timeline-generate-btn, .btn-generate-audio');
  genButtons.forEach(btn => {
    btn.addEventListener('click', handleGenerateFullAudio);
  });

  // Audio Player Controls
  const playPauseBtn = document.getElementById('player-play-pause-btn');
  const waveformTrack = document.getElementById('player-waveform-track');
  const waveformProgress = document.getElementById('player-waveform-progress');
  const currentTimeSpan = document.getElementById('player-current-time');
  const downloadMp3Btn = document.getElementById('player-download-btn');

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
      if (mainAudio.paused) {
        mainAudio.play();
        playPauseBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">pause</span>';
      } else {
        mainAudio.pause();
        playPauseBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">play_arrow</span>';
      }
    });
  }

  mainAudio.addEventListener('timeupdate', () => {
    const cur = mainAudio.currentTime;
    const dur = mainAudio.duration || 1;
    const pct = (cur / dur) * 100;
    if (waveformProgress) waveformProgress.style.width = pct + '%';
    if (currentTimeSpan) currentTimeSpan.textContent = formatPlayerTime(cur);

    // Highlight active cue in timeline
    if (state.generationResult && state.generationResult.cueTimings) {
      const activeTiming = state.generationResult.cueTimings.find(t => cur >= t.start && cur <= t.end);
      const newActiveIdx = activeTiming ? activeTiming.index : null;
      if (newActiveIdx !== state.activePlaybackCueIndex) {
        state.activePlaybackCueIndex = newActiveIdx;
        renderCuesTimeline();
        if (newActiveIdx) {
          const el = document.getElementById(`cue-item-cue_${newActiveIdx}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  });

  mainAudio.addEventListener('loadedmetadata', () => {
    const durLabel = document.getElementById('player-duration-label');
    if (durLabel && !isNaN(mainAudio.duration) && isFinite(mainAudio.duration)) {
      durLabel.textContent = formatPlayerTime(mainAudio.duration);
    }
  });

  mainAudio.addEventListener('ended', () => {
    if (playPauseBtn) playPauseBtn.innerHTML = '<span class="material-symbols-outlined icon-sm">play_arrow</span>';
    if (waveformProgress) waveformProgress.style.width = '0%';
    if (currentTimeSpan) currentTimeSpan.textContent = '00:00';
    state.activePlaybackCueIndex = null;
    renderCuesTimeline();
  });

  if (waveformTrack) {
    waveformTrack.addEventListener('click', (e) => {
      const rect = waveformTrack.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      if (mainAudio.duration) {
        mainAudio.currentTime = pos * mainAudio.duration;
      }
    });
  }

  if (downloadMp3Btn) {
    downloadMp3Btn.addEventListener('click', () => {
      handleDownloadMp3();
    });
  }

  // Metadata Modal Event Listeners
  const playerMetaBtn = document.getElementById('player-metadata-btn');
  const drawerMetaBtn = document.getElementById('open-meta-from-drawer-btn');
  const closeMetaModalBtn = document.getElementById('close-meta-modal-btn');
  const cancelMetaModalBtn = document.getElementById('cancel-meta-modal-btn');
  const saveMetaModalBtn = document.getElementById('save-meta-modal-btn');
  const saveAndDownloadMetaBtn = document.getElementById('save-and-download-meta-btn');
  const metaModalOverlay = document.getElementById('mp3-metadata-modal');

  if (playerMetaBtn) playerMetaBtn.addEventListener('click', openMetadataModal);
  if (drawerMetaBtn) drawerMetaBtn.addEventListener('click', openMetadataModal);
  if (closeMetaModalBtn) closeMetaModalBtn.addEventListener('click', closeMetadataModal);
  if (cancelMetaModalBtn) cancelMetaModalBtn.addEventListener('click', closeMetadataModal);

  if (metaModalOverlay) {
    metaModalOverlay.addEventListener('click', (e) => {
      if (e.target === metaModalOverlay) closeMetadataModal();
    });
  }

  if (saveMetaModalBtn) {
    saveMetaModalBtn.addEventListener('click', () => {
      saveMetadataFromModal(true);
    });
  }

  if (saveAndDownloadMetaBtn) {
    saveAndDownloadMetaBtn.addEventListener('click', async () => {
      saveMetadataFromModal(false);
      closeMetadataModal();
      await handleDownloadMp3();
    });
  }

  // Cover Art picker
  const coverBox = document.getElementById('cover-preview-box');
  const chooseCoverBtn = document.getElementById('meta-choose-cover-btn');
  const coverFileInput = document.getElementById('meta-cover-file-input');
  const removeCoverBtn = document.getElementById('meta-remove-cover-btn');

  if (coverBox && coverFileInput) {
    coverBox.addEventListener('click', () => coverFileInput.click());
  }
  if (chooseCoverBtn && coverFileInput) {
    chooseCoverBtn.addEventListener('click', () => coverFileInput.click());
  }
  if (coverFileInput) {
    coverFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleCoverImageFile(e.target.files[0]);
      }
    });
  }
  if (removeCoverBtn) {
    removeCoverBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCoverImage();
    });
  }

  // Auto-sync year from date input
  const metaDateInput = document.getElementById('meta-date-input');
  const metaYearInput = document.getElementById('meta-year-input');
  if (metaDateInput && metaYearInput) {
    metaDateInput.addEventListener('change', () => {
      if (metaDateInput.value) {
        metaYearInput.value = metaDateInput.value.slice(0, 4);
      }
    });
  }
}

// Environment detection
async function detectEnvironment() {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      renderHeaderStatus();
    }
  } catch {
    renderHeaderStatus();
  }
}

// Load config from voices.json if available
async function loadConfig() {
  await detectEnvironment();

  try {
    const res = await fetch('./voices.json');
    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.voices && data.tones) {
          state.config = data;
        }
      } catch {}
    }
  } catch (e) {
    console.log('Using embedded default config fallback');
  }

  // Load sample VTT by default
  state.cues = parseVtt(state.config.sampleVtt);
  renderVoiceCards();
  renderCuesTimeline();
  renderCompactBar();
  renderHeaderStatus();
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadConfig();
});
