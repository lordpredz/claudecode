#!/usr/bin/env bash
# Prepara uma VPS Ubuntu/Debian para rodar o transcript-bot:
# Node.js, ffmpeg, whisper.cpp (compilado localmente) e Ollama.
#
# Rode este script a partir da raiz do repositório clonado na VPS:
#   bash scripts/setup-vps.sh
#
# Precisa de sudo. Idempotente: pode rodar de novo sem quebrar nada.

set -euo pipefail

WHISPER_MODEL="${WHISPER_MODEL:-small}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b-instruct-q4_K_M}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Instalando dependências do sistema (ffmpeg, build tools, cmake, curl, git)"
sudo apt-get update -y
sudo apt-get install -y ffmpeg build-essential cmake git curl

if ! command -v node >/dev/null 2>&1; then
  echo "==> Instalando Node.js 20.x (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "==> Node.js já instalado: $(node -v)"
fi

echo "==> Instalando dependências do projeto (npm install)"
cd "$REPO_ROOT"
npm install

if [ ! -d "$REPO_ROOT/whisper.cpp" ]; then
  echo "==> Clonando whisper.cpp"
  git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$REPO_ROOT/whisper.cpp"
fi

echo "==> Compilando whisper.cpp"
cmake -B "$REPO_ROOT/whisper.cpp/build" -S "$REPO_ROOT/whisper.cpp" -DCMAKE_BUILD_TYPE=Release
cmake --build "$REPO_ROOT/whisper.cpp/build" --config Release -j"$(nproc)"

if [ ! -f "$REPO_ROOT/whisper.cpp/models/ggml-${WHISPER_MODEL}.bin" ]; then
  echo "==> Baixando modelo whisper '${WHISPER_MODEL}'"
  bash "$REPO_ROOT/whisper.cpp/models/download-ggml-model.sh" "$WHISPER_MODEL"
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Instalando Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "==> Ollama já instalado"
fi

echo "==> Baixando modelo do Ollama: ${OLLAMA_MODEL}"
ollama pull "$OLLAMA_MODEL"

if [ ! -f "$REPO_ROOT/.env" ]; then
  echo "==> Criando .env a partir do .env.example"
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
fi

cat <<EOF

==> Setup concluído.

Binário do whisper.cpp:  $REPO_ROOT/whisper.cpp/build/bin/whisper-cli
Modelo whisper:           $REPO_ROOT/whisper.cpp/models/ggml-${WHISPER_MODEL}.bin
Modelo Ollama:            ${OLLAMA_MODEL}

Confira o arquivo .env (paths já batem com os padrões acima) e depois suba o
serviço systemd conforme o README.
EOF
