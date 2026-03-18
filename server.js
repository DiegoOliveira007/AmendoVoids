const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();

// Configurações
const CHANNEL = "albedu0"; // <-- MUDE
const URL = `https://www.twitch.tv/${CHANNEL}`;

// Internet Archive
const ACCESS_KEY = "iZWo6DeMPK2f3qPm";
const SECRET_KEY = "XkgvpPMJwQeaQ0Cg";

// ==========================

let isRecording = false;
let currentFile = "";
let currentIdentifier = "";

// Endpoint pra uptime robot
app.get("/", (req, res) => {
  res.send("OK");
});

// Verifica live
function checkLive() {
  exec(`yt-dlp -j ${URL}`, (err, stdout) => {
    if (err) return;

    try {
      const data = JSON.parse(stdout);

      if (data.is_live && !isRecording) {
        console.log("Live detectada!");
        startRecording();
      } else {
        console.log("Live Offiline");
      }
    } catch {
      console.log("Erro ao verificar");
    }
  });
}

// Inicia gravação
function startRecording() {
  isRecording = true;

  currentFile = `${CHANNEL}-${Date.now()}.mp4`;
  currentIdentifier = `live-${CHANNEL}-${Date.now()}`;

  const cmd = `yt-dlp --hls-use-mpegts -o "${currentFile}" ${URL}`;

  const proc = exec(cmd);

  proc.on("exit", () => {
    console.log("⛔ Live terminou");
    uploadToArchive();
    isRecording = false;
  });
}

// Upload pro Internet Archive
function uploadToArchive() {
  console.log("Enviando para Internet Archive");

  const cmd = `
    curl --location --request PUT "https://s3.us.archive.org/${currentIdentifier}/${currentFile}" \
    --header "authorization: LOW ${ACCESS_KEY}:${SECRET_KEY}" \
    --header "x-archive-auto-make-bucket:1" \
    --header "x-archive-meta-title:${currentIdentifier}" \
    --header "x-archive-meta-mediatype:movies" \
    --upload-file "${currentFile}"
  `;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.log("Erro no upload");
      return;
    }

    console.log("Upload concluído!");

    // 🧹 apagar arquivo local
    fs.unlink(currentFile, () => {
      console.log("Arquivo deletado localmente");
    });
  });
}

// Checa a cada 60s
setInterval(checkLive, 60000);

app.listen(3000, () => {
  console.log("Bot está funcionando");
});