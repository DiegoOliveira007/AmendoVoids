const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();

// ========= CONFIG =========
const CHANNEL = "AmendoGordoOficial"; // <-- streamer
const URL = `https://www.twitch.tv/${CHANNEL}`;

// Internet Archive
const ACCESS_KEY = "iZWo6DeMPK2f3qPm";
const SECRET_KEY = "XkgvpPMJwQeaQ0Cg";
// ==========================

let isRecording = false;
let currentFile = "";
let currentIdentifier = "";
let currentTitle = "";

// endpoint (UptimeRobot)
app.get("/", (req, res) => {
  res.send("OK");
});

// 🔍 verificar live
function checkLive() {
  exec(`yt-dlp -j ${URL}`, (err, stdout) => {
    if (err) return;

    try {
      const data = JSON.parse(stdout);

      if (data.is_live && !isRecording) {
        console.log("🔴 Live detectada!");
        startRecording(data.title || "");
      } else {
        console.log("⚪ Offline...");
      }
    } catch {
      console.log("Erro ao verificar");
    }
  });
}

// ▶️ iniciar gravação
function startRecording(title) {
  isRecording = true;

  const timestamp = new Date().toISOString().slice(0, 10);
  const safeTitle = title
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  const baseName = safeTitle ? `${safeTitle} - ${timestamp}` : `${CHANNEL}-${timestamp}`;
  currentFile = `${baseName}.mp4`;
  currentTitle = safeTitle || CHANNEL;
  currentIdentifier = `live-${CHANNEL}-${Date.now()}`;

  const cmd = `yt-dlp --hls-use-mpegts --no-part -o "${currentFile}" ${URL}`;

  console.log(`📹 Gravando em: ${currentFile}`);

  exec(cmd, { maxBuffer: 100 * 1024 * 1024 }, (err) => {
    if (err) {
      console.log("⚠️ yt-dlp encerrou com erro:", err.message);
    }

    console.log("⛔ Live terminou");
    console.log("Arquivo:", currentFile);

    if (fs.existsSync(currentFile)) {
      uploadToArchive();
    } else {
      console.log("❌ Arquivo não encontrado, upload cancelado");
      isRecording = false;
    }
  });
}

// ☁️ upload pro Internet Archive
function uploadToArchive() {
  console.log("☁️ Enviando para Internet Archive...");

  const encodedFile = encodeURIComponent(currentFile);

  const cmd = `
    curl --location --request PUT "https://s3.us.archive.org/${currentIdentifier}/${encodedFile}" \
    --header "authorization: LOW ${ACCESS_KEY}:${SECRET_KEY}" \
    --header "x-archive-auto-make-bucket:1" \
    --header "x-archive-meta-title:${currentTitle}" \
    --header "x-archive-meta-mediatype:movies" \
    --upload-file "${currentFile}"
  `;

  exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.log("❌ Erro no upload:", err.message);
      isRecording = false;
      return;
    }

    console.log("✅ Upload concluído!");
    console.log(`🔗 https://archive.org/details/${currentIdentifier}`);

    fs.unlink(currentFile, () => {
      console.log("🗑️ Arquivo local deletado");
    });

    isRecording = false;
  });
}

// ⏱️ loop
setInterval(checkLive, 60000);

// iniciar servidor
app.listen(3000, () => {
  console.log("🤖 Bot rodando...");
});