/**
 * Script para criar um executável Windows da aplicação
 */
const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const electronBuilder = require("electron-builder");
const glob = require("glob");

// Diretório raiz do projeto
const rootDir = path.join(__dirname, "..");

// Diretório para build temporário
const buildDir = path.join(rootDir, "build");

// Diretório para distribuição
const distDir = path.join(rootDir, "dist");

// Pasta de temas
const themesDir = path.join(rootDir, "themes");

// Configuração do Electron
const electronConfig = {
  main: path.join(buildDir, "main.js"),
  preload: path.join(buildDir, "preload.js"),
};

// Limpar diretórios de build e dist
console.log("Limpando diretórios de build e dist...");
try {
  // Tentar remover o diretório de build
  if (fs.existsSync(buildDir)) {
    fs.removeSync(buildDir);
  }

  // Tentar remover o diretório de dist com tratamento de erro
  if (fs.existsSync(distDir)) {
    try {
      fs.removeSync(distDir);
    } catch (err) {
      console.warn(
        "Aviso: Não foi possível remover completamente o diretório dist: " +
          err.message
      );
      console.log("Tentando remover arquivos individuais...");

      // Tentar remover arquivos individuais
      const files = fs.readdirSync(distDir);
      for (const file of files) {
        try {
          const filePath = path.join(distDir, file);
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.removeSync(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.warn(
            "Não foi possível remover " + file + ": " + fileErr.message
          );
        }
      }
    }
  }
} catch (err) {
  console.error("Erro ao limpar diretórios: " + err.message);
}

// Criar diretórios
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Criar arquivo main.js do Electron
console.log("Criando arquivo main.js do Electron...");
const mainContentLines = [
  "const { app, BrowserWindow, dialog, ipcMain } = require('electron');",
  "const path = require('path');",
  "const fs = require('fs');",
  "const http = require('http');",
  "const { spawn } = require('child_process');",
  "",
  "// Variáveis globais",
  "let mainWindow;",
  "let server;",
  "let serverProcess;",
  "let serverPort = 3000;",
  "let serverUrl = 'http://localhost:' + serverPort;",
  "let serverReady = false;",
  "",
  "// Log de inicialização",
  "function log(message) {",
  "  console.log('[Main Process] ' + message);",
  "  try {",
  "    const logPath = path.join(process.cwd(), 'app-debug.log');",
  "    fs.appendFileSync(logPath, new Date().toISOString() + ' - ' + message + '\\n');",
  "  } catch (err) {",
  "    console.error('Erro ao escrever log:', err);",
  "  }",
  "}",
  "",
  "log('=== INICIALIZAÇÃO DO APLICATIVO ===');",
  "log('Data/Hora: ' + new Date().toISOString());",
  "log('Caminho do executável: ' + process.execPath);",
  "log('Diretório de trabalho original: ' + process.cwd());",
  "",
  "// Alterar o diretório de trabalho para o diretório do executável",
  "process.env.ES_PORTABLE_MODE = true;",
  "process.env.ES_ROOT_PATH = 'Y:/images/RIESCADE';",
  "",
  "// Função para iniciar o servidor Node.js",
  "function startServer() {",
  "  log('Iniciando servidor Node.js...');",
  "  ",
  "  try {",
  "    // Caminho para o arquivo server.js",
  "    const serverPath = path.join(__dirname, 'server.js');",
  "    log('Caminho do servidor: ' + serverPath);",
  "    ",
  "    // Verificar se o arquivo existe",
  "    if (!fs.existsSync(serverPath)) {",
  "      log('ERRO: Arquivo do servidor não encontrado: ' + serverPath);",
  "      dialog.showErrorBox(",
  "        'Erro ao Iniciar Servidor',",
  "        'Arquivo do servidor não encontrado: ' + serverPath",
  "      );",
  "      return;",
  "    }",
  "    ",
  "    // Iniciar o servidor diretamente no processo principal",
  "    log('Iniciando servidor no processo principal...');",
  "    ",
  "    try {",
  "      // Carregar o módulo do servidor",
  "      const server = require(serverPath);",
  "      log('Servidor carregado com sucesso');",
  "      ",
  "      // O servidor já deve estar rodando após o require",
  "      serverReady = true;",
  "      ",
  "      // Redirecionar para o servidor se a janela já estiver pronta",
  "      if (mainWindow && !mainWindow.isDestroyed()) {",
  "        setTimeout(() => {",
  "          mainWindow.loadURL('http://localhost:3000');",
  "        }, 1000);",
  "      }",
  "    } catch (err) {",
  "      log('ERRO ao carregar servidor: ' + err.message);",
  "      log(err.stack);",
  "      ",
  "      dialog.showErrorBox(",
  "        'Erro ao Iniciar Servidor',",
  "        'Não foi possível iniciar o servidor: ' + err.message",
  "      );",
  "    }",
  "  } catch (err) {",
  "    log('ERRO ao iniciar servidor: ' + err.message);",
  "    dialog.showErrorBox(",
  "      'Erro ao Iniciar Servidor',",
  "      'Não foi possível iniciar o servidor: ' + err.message",
  "    );",
  "  }",
  "}",
  "",
  "// Função para criar a janela principal",
  "function createWindow() {",
  "  log('Tentando criar janela principal...');",
  "  ",
  "  try {",
  "    // Tamanho e posição específicos para garantir que a janela seja visível",
  "    const screenElectron = require('electron').screen;",
  "    const primaryDisplay = screenElectron.getPrimaryDisplay();",
  "    const { width, height } = primaryDisplay.workAreaSize;",
  "    ",
  "    log('Resolução da tela principal: ' + width + 'x' + height);",
  "    ",
  "    // Criar uma janela centralizada com tamanho fixo",
  "    mainWindow = new BrowserWindow({",
  "      width: 1280,",
  "      height: 720,",
  "      x: Math.floor(width / 2 - 640),",
  "      y: Math.floor(height / 2 - 360),",
  "      show: false, // Não mostrar até estar pronta",
  "      backgroundColor: '#2d2d2d',",
  "      webPreferences: {",
  "        preload: path.join(__dirname, 'preload.js'),",
  "        nodeIntegration: false,",
  "        contextIsolation: true",
  "      }",
  "    });",
  "    ",
  "    log('Janela criada com sucesso');",
  "    ",
  "    // Carregar uma tela de carregamento enquanto o servidor inicia",
  "    const loadingHTML = `",
  "      <!DOCTYPE html>",
  "      <html>",
  "      <head>",
  '        <meta charset="UTF-8">',
  "        <title>ES Theme Engine - Carregando</title>",
  "        <style>",
  "          body {",
  "            font-family: Arial, sans-serif;",
  "            background-color: #2d2d2d;",
  "            color: white;",
  "            display: flex;",
  "            flex-direction: column;",
  "            align-items: center;",
  "            justify-content: center;",
  "            height: 100vh;",
  "            margin: 0;",
  "            padding: 20px;",
  "            text-align: center;",
  "          }",
  "          h1 { margin-bottom: 20px; }",
  "          .loader {",
  "            border: 5px solid #f3f3f3;",
  "            border-top: 5px solid #3498db;",
  "            border-radius: 50%;",
  "            width: 50px;",
  "            height: 50px;",
  "            animation: spin 2s linear infinite;",
  "            margin: 20px auto;",
  "          }",
  "          @keyframes spin {",
  "            0% { transform: rotate(0deg); }",
  "            100% { transform: rotate(360deg); }",
  "          }",
  "          .status { margin: 20px 0; font-size: 18px; }",
  "          .message { color: #aaa; margin-top: 20px; }",
  "        </style>",
  "      </head>",
  "      <body>",
  "        <h1>ES Theme Engine</h1>",
  '        <div class="loader"></div>',
  '        <div class="status">Iniciando servidor...</div>',
  '        <div class="message">Aguarde enquanto o servidor está sendo iniciado.</div>',
  "        ",
  "        <script>",
  "          // Verificar periodicamente se o servidor está pronto",
  "          let attempts = 0;",
  "          const maxAttempts = 30; // 30 segundos",
  "          ",
  "          function checkServer() {",
  "            attempts++;",
  "            fetch('http://localhost:3000')",
  "              .then(response => {",
  "                if (response.ok) {",
  "                  window.location.href = 'http://localhost:3000';",
  "                } else {",
  "                  if (attempts < maxAttempts) {",
  "                    setTimeout(checkServer, 1000);",
  "                  } else {",
  "                    document.querySelector('.status').textContent = 'Tempo esgotado!';",
  "                    document.querySelector('.message').textContent = 'O servidor não respondeu a tempo. Tente reiniciar o aplicativo.';",
  "                  }",
  "                }",
  "              })",
  "              .catch(error => {",
  "                if (attempts < maxAttempts) {",
  "                  setTimeout(checkServer, 1000);",
  "                } else {",
  "                  document.querySelector('.status').textContent = 'Erro ao conectar!';",
  "                  document.querySelector('.message').textContent = 'Não foi possível conectar ao servidor. Tente reiniciar o aplicativo.';",
  "                }",
  "              });",
  "          }",
  "          ",
  "          // Iniciar verificação após 3 segundos",
  "          setTimeout(checkServer, 3000);",
  "        </script>",
  "      </body>",
  "      </html>",
  "    `;",
  "    ",
  "    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHTML));",
  "    ",
  "    // Quando a janela estiver pronta para ser mostrada",
  "    mainWindow.once('ready-to-show', () => {",
  "      log('Janela pronta para ser mostrada');",
  "      mainWindow.show();",
  "      log('Janela visível');",
  "      ",
  "      // Se o servidor já estiver pronto, redirecionar para ele",
  "      if (serverReady && mainWindow && !mainWindow.isDestroyed()) {",
  "        setTimeout(() => {",
  "          mainWindow.loadURL('http://localhost:3000');",
  "        }, 1000);",
  "      }",
  "    });",
  "    ",
  "    // Monitorar erros",
  "    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {",
  "      log('ERRO ao carregar página: ' + errorDescription + ' (código ' + errorCode + ')');",
  "    });",
  "    ",
  "    // Evento de fechamento",
  "    mainWindow.on('closed', () => {",
  "      log('Janela principal fechada');",
  "      mainWindow = null;",
  "    });",
  "  } catch (error) {",
  "    log('ERRO CRÍTICO ao criar janela: ' + error.message);",
  "    log(error.stack);",
  "    ",
  "    // Tentar mostrar uma caixa de diálogo, mesmo sem janela",
  "    dialog.showErrorBox(",
  "      'Erro Crítico',",
  "      'Falha ao criar janela principal: ' + error.message + '\\n\\nVerifique o arquivo de log para mais detalhes.'",
  "    );",
  "  }",
  "}",
  "",
  "// Inicializar o aplicativo",
  "app.whenReady().then(() => {",
  "  log('Aplicativo pronto');",
  "  ",
  "  // Iniciar o servidor primeiro",
  "  startServer();",
  "  ",
  "  // Criar a janela principal",
  "  createWindow();",
  "  ",
  "  app.on('activate', () => {",
  "    if (BrowserWindow.getAllWindows().length === 0) {",
  "      createWindow();",
  "    }",
  "  });",
  "});",
  "",
  "// Sair quando todas as janelas forem fechadas",
  "app.on('window-all-closed', () => {",
  "  log('Todas as janelas foram fechadas');",
  "  if (process.platform !== 'darwin') {",
  "    log('Saindo do aplicativo');",
  "    app.quit();",
  "  }",
  "});",
].join("\n");

// Escrever o arquivo main.js
fs.writeFileSync(electronConfig.main, mainContentLines);
console.log("Arquivo main.js criado em " + electronConfig.main);

// Criar arquivo preload.js do Electron
console.log("Criando arquivo preload.js do Electron...");
const preloadContent = `
const { contextBridge, ipcRenderer } = require('electron');

// Expor API segura para o renderer
contextBridge.exposeInMainWorld('electronAPI', {
  restartApp: () => ipcRenderer.invoke('restart-app'),
  getLogPath: () => ipcRenderer.invoke('get-log-path')
});
`;

// Escrever o arquivo preload.js
fs.writeFileSync(electronConfig.preload, preloadContent);
console.log("Arquivo preload.js criado em " + electronConfig.preload);

// Copiar arquivos do servidor para o diretório de build
console.log("Copiando arquivos do servidor...");
const serverFiles = [
  "server.js",
  "package.json",
  "package-lock.json",
  "api",
  "public",
  "themes",
];

for (const file of serverFiles) {
  const source = path.join(rootDir, file);
  const dest = path.join(buildDir, file);

  if (fs.existsSync(source)) {
    if (fs.lstatSync(source).isDirectory()) {
      fs.copySync(source, dest);
      console.log(`\nDiretório ${file} copiado para ${dest}`);
    } else {
      fs.copyFileSync(source, dest);
      console.log(`Arquivo ${file} copiado para ${dest}`);
    }
  } else {
    console.warn(`Aviso: Arquivo ou diretório ${file} não encontrado`);
  }
}

// Tentar encontrar o Node.js para incluir no pacote
console.log("Tentando encontrar o Node.js para incluir no pacote...");
let nodeExePath = null;

try {
  // No Windows, tentar encontrar o node.exe
  if (process.platform === "win32") {
    const possibleNodePaths = [
      process.execPath, // O node que está executando este script
      "C:\\Program Files\\nodejs\\node.exe",
      "C:\\Program Files (x86)\\nodejs\\node.exe",
    ];

    for (const nodePath of possibleNodePaths) {
      if (fs.existsSync(nodePath)) {
        nodeExePath = nodePath;
        console.log(`Node.js encontrado em: ${nodeExePath}`);
        break;
      }
    }

    // Se ainda não encontrou, tentar encontrar na PATH
    if (!nodeExePath) {
      try {
        const result = execSync("where node", { encoding: "utf8" });
        const paths = result.split("\n").filter(Boolean);
        if (paths.length > 0) {
          nodeExePath = paths[0].trim();
          console.log(`Node.js encontrado na PATH: ${nodeExePath}`);
        }
      } catch (err) {
        console.warn("Não foi possível encontrar o Node.js na PATH");
      }
    }
  }
} catch (err) {
  console.warn("Erro ao buscar o Node.js:", err.message);
}

// Copiar o Node.js para o diretório de build
if (nodeExePath) {
  const nodeExeDest = path.join(buildDir, "node.exe");
  fs.copyFileSync(nodeExePath, nodeExeDest);
  console.log("Node.js copiado para " + nodeExeDest);
} else {
  console.warn(
    "Aviso: Não foi possível encontrar o Node.js para incluir no pacote"
  );
}

// Criar package.json para o build
console.log("Criando package.json para o build...");
const packageJson = {
  name: "es-theme-engine",
  version: "1.0.0",
  description: "Engine para temas web do EmulationStation",
  main: "main.js",
  author: "",
  license: "MIT",
  dependencies: {
    express: "^4.18.2",
    cors: "^2.8.5",
    "fast-xml-parser": "^4.2.5",
    "fs-extra": "^11.1.1",
    winston: "^3.8.2",
    morgan: "^1.10.0",
    dotenv: "^16.0.3",
    "body-parser": "^1.20.2",
    path: "^0.12.7",
    "node-cache": "^5.1.2",
    glob: "^8.1.0",
    xml2js: "^0.4.23",
    multer: "^1.4.5-lts.1",
    archiver: "^5.3.1",
    "extract-zip": "^2.0.1",
    uuid: "^9.0.0",
    "adm-zip": "^0.5.10",
    "node-fetch": "^2.6.9",
  },
};

fs.writeFileSync(
  path.join(buildDir, "package.json"),
  JSON.stringify(packageJson, null, 2)
);

// Construir o executável com electron-builder
console.log("Construindo o executável com electron-builder...");
electronBuilder
  .build({
    targets: electronBuilder.Platform.WINDOWS.createTarget(),
    config: {
      appId: "com.estheme.app",
      productName: "ES Theme Engine",
      directories: {
        output: distDir,
        app: buildDir,
      },
      win: {
        target: [
          {
            target: "nsis",
            arch: ["x64"],
          },
          {
            target: "portable",
            arch: ["x64"],
          },
        ],
        icon: path.join(rootDir, "public/assets/icon.ico"),
      },
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
      },
      portable: {
        artifactName: "ESThemeManager-Portable.exe",
      },
    },
  })
  .then(() => {
    console.log("Build concluído com sucesso!");
    console.log("Executável criado em: " + distDir);
  })
  .catch((err) => {
    console.error("Erro durante o build:", err);
    process.exit(1);
  });
