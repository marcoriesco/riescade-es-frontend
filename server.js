// Servidor principal da ES Theme Engine
const express = require("express");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs-extra");
const { createLogger, format, transports } = require("winston");
require("dotenv").config();

// Rotas da API
const platformsRouter = require("./api/routes/platforms");
const gamesRouter = require("./api/routes/games");
const configRouter = require("./api/routes/config");
const themesRouter = require("./api/routes/themes");

// Utils
const pathFinder = require("./api/utils/pathFinder");

// Inicialização
const app = express();
const PORT = process.env.PORT || 3000;

// Logger
const logger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "es-theme-engine" },
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log" }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Add request logging middleware for API routes
app.use("/api", (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.url}`);
  const originalSend = res.send;
  res.send = function (body) {
    console.log(`API Response: ${res.statusCode}`);
    console.log(
      `Response body: ${body.slice(0, 200)}${body.length > 200 ? "..." : ""}`
    );
    return originalSend.call(this, body);
  };
  next();
});

// Verificar e criar diretórios necessários
const themesDir = path.join(__dirname, "themes");
if (!fs.existsSync(themesDir)) {
  fs.mkdirSync(themesDir, { recursive: true });
  logger.info(`Diretório de temas criado: ${themesDir}`);
}

// Descobrir caminhos do EmulationStation
const esPaths = pathFinder.findEmulationStationPaths();
if (!esPaths.configDir) {
  logger.warn(
    "Diretório de configuração do EmulationStation não encontrado. Alguns recursos podem não funcionar."
  );
} else {
  logger.info(`EmulationStation encontrado em: ${esPaths.configDir}`);
}

// Definir o tema atual como um middleware
app.use((req, res, next) => {
  // Definir tema padrão ou ler das configurações
  req.currentTheme = "default";

  try {
    const configFile = path.join(esPaths.configDir || "", "es_settings.cfg");
    if (fs.existsSync(configFile)) {
      // Se encontrarmos um arquivo de configuração, podemos ler o tema
      // Implementação real será no configService
      // req.currentTheme = ... (lido do arquivo)
    }
  } catch (err) {
    logger.error("Erro ao ler tema atual:", err);
  }

  next();
});

// Rotas estáticas
app.use(express.static(path.join(__dirname, "public")));

// Servir arquivos de temas
app.use("/themes", express.static(path.join(__dirname, "themes")));

// Rotas da API
app.use("/api/platforms", platformsRouter);
app.use("/api/games", gamesRouter);
app.use("/api/config", configRouter);
app.use("/api/themes", themesRouter);

// Rota para o tema atual
app.get("/", (req, res) => {
  const themePath = path.join(
    __dirname,
    "themes",
    req.currentTheme,
    "index.html"
  );

  if (fs.existsSync(themePath)) {
    res.sendFile(themePath);
  } else {
    // Fallback para o tema padrão se o tema atual não for encontrado
    res.sendFile(path.join(__dirname, "themes/default/index.html"));
  }
});

// Rota para servir as imagens e mídias dos jogos
app.use("/roms-media", (req, res) => {
  const configService = require("./api/services/configService");
  const paths = configService.getPaths();

  if (!paths.romsDir) {
    return res.status(404).send("Diretório de ROMs não configurado");
  }

  // Pegar o caminho relativo da URL
  const relativePath = req.url;
  // Construir o caminho absoluto para o arquivo
  const filePath = path.join(paths.romsDir, relativePath);

  console.log(`Solicitação de mídia: ${relativePath}`);
  console.log(`Tentando servir arquivo: ${filePath}`);

  // Verificar se o arquivo existe
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  res.status(404).send("Arquivo não encontrado");
});

// Tratamento de erros
app.use((req, res, next) => {
  const error = new Error("Não encontrado");
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.json({
    error: {
      message: error.message,
    },
  });
  logger.error(
    `${error.status || 500} - ${error.message} - ${req.originalUrl} - ${
      req.method
    } - ${req.ip}`
  );
});

// Inicie o servidor
app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  console.log(`Servidor rodando em http://localhost:${PORT}`);

  // Enviar mensagem ao processo pai (Electron) se estiver sendo executado como filho
  if (process.send) {
    process.send({ ready: true, port: PORT });
    logger.info("Mensagem de inicialização enviada ao processo pai");
  }

  // Emitir evento 'ready' para que o Electron possa detectá-lo
  app.emit("ready", PORT);
});

// Exportar para uso com Electron
module.exports = app;
