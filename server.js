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
} else {
  logger.info(`Usando diretório de temas existente: ${themesDir}`);
}

const defaultThemeDir = path.join(themesDir, "default");
if (!fs.existsSync(defaultThemeDir)) {
  logger.warn(`Tema padrão não encontrado em: ${defaultThemeDir}`);
} else {
  logger.info(`Tema padrão encontrado em: ${defaultThemeDir}`);

  // Verificar se o arquivo index.html existe
  const indexPath = path.join(defaultThemeDir, "index.html");
  if (fs.existsSync(indexPath)) {
    logger.info(`Arquivo index.html do tema padrão encontrado: ${indexPath}`);
  } else {
    logger.warn(
      `Arquivo index.html do tema padrão NÃO encontrado: ${indexPath}`
    );
  }
}

// Descobrir caminhos do EmulationStation
const esPaths = pathFinder.findEmulationStationPaths();
if (!esPaths.configDir) {
  logger.warn(
    "Diretório de configuração do EmulationStation não encontrado. Alguns recursos podem não funcionar."
  );
} else {
  logger.info(
    `Diretório de configuração do EmulationStation encontrado em: ${esPaths.configDir}`
  );
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

// Configuração do Express para lidar com diferentes tipos de mídia
express.static.mime.define({
  "image/webp": ["webp"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/gif": ["gif"],
  "video/mp4": ["mp4"],
  "video/webm": ["webm"],
  "application/javascript": ["js"],
  "text/css": ["css"],
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

/**
 * Função para enviar um arquivo como stream, com o tipo de conteúdo apropriado
 */
function sendFileAsStream(res, filePath) {
  if (!fs.existsSync(filePath)) {
    logger.error(`Arquivo não encontrado: ${filePath}`);
    return false;
  }

  // Verificar o tipo de arquivo para definir o content-type
  const extname = path.extname(filePath).toLowerCase();
  const contentType =
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".css": "text/css",
      ".js": "application/javascript",
      ".html": "text/html",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    }[extname] || "application/octet-stream";

  logger.info(`Enviando arquivo ${filePath} com content-type ${contentType}`);

  try {
    // Enviar o arquivo como uma stream
    const stream = fs.createReadStream(filePath);
    res.setHeader("Content-Type", contentType);

    stream.on("error", (error) => {
      logger.error(`Erro na stream: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `Erro ao ler arquivo: ${error.message}`,
        });
      }
    });

    stream.pipe(res);
    return true;
  } catch (error) {
    logger.error(`Erro ao enviar arquivo: ${error.stack}`);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: `Erro ao enviar arquivo: ${error.message}`,
      });
    }
    return false;
  }
}

// Rota para o tema atual
app.get("/", (req, res) => {
  const themePath = path.join(
    __dirname,
    "themes",
    req.currentTheme,
    "index.html"
  );

  if (fs.existsSync(themePath)) {
    logger.info(`Enviando tema atual: ${themePath}`);
    if (!sendFileAsStream(res, themePath)) {
      logger.error(`Falha ao enviar tema atual: ${themePath}`);
      res.status(500).send("Erro ao carregar tema");
    }
  } else {
    // Fallback para o tema padrão se o tema atual não for encontrado
    const defaultThemePath = path.join(__dirname, "themes/default/index.html");
    logger.info(`Usando tema padrão: ${defaultThemePath}`);

    if (fs.existsSync(defaultThemePath)) {
      if (!sendFileAsStream(res, defaultThemePath)) {
        logger.error(`Falha ao enviar tema padrão: ${defaultThemePath}`);
        res.status(500).send("Erro ao carregar tema padrão");
      }
    } else {
      logger.error(`Erro: Tema padrão não encontrado em ${defaultThemePath}`);
      res.status(404).send("Tema não encontrado");
    }
  }
});

// Rota para servir as imagens e mídias dos jogos
app.use("/roms-media", (req, res) => {
  const configService = require("./api/services/configService");
  const paths = configService.getPaths();

  if (!paths.romsDir) {
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não configurado",
    });
  }

  // Pegar o caminho relativo da URL (remover a barra inicial)
  const relativePath = req.url.replace(/^\//, "");

  // Construir o caminho absoluto para o arquivo
  const filePath = path.resolve(paths.romsDir, relativePath);

  // Verificar se o arquivo existe
  if (fs.existsSync(filePath)) {
    try {
      // Verificar o tipo de arquivo para definir o content-type
      const extname = path.extname(filePath).toLowerCase();
      const contentType =
        {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
        }[extname] || "application/octet-stream";

      logger.info(
        `Enviando arquivo ${filePath} com content-type ${contentType}`
      );

      // Enviar o arquivo como uma stream em vez de usar sendFile
      const stream = fs.createReadStream(filePath);
      res.setHeader("Content-Type", contentType);

      stream.on("error", (error) => {
        logger.error(`Erro na stream: ${error.message}`);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: `Erro ao ler arquivo: ${error.message}`,
          });
        }
      });

      stream.pipe(res);
    } catch (error) {
      logger.error(`Erro ao enviar arquivo: ${error.stack}`);
      return res.status(500).json({
        success: false,
        message: `Erro ao enviar arquivo: ${error.message}`,
      });
    }
  } else {
    logger.warn(`Arquivo não encontrado: ${filePath}`);
    return res.status(404).json({
      success: false,
      message: "Arquivo de mídia não encontrado",
    });
  }
});

// Rota para compatibilidade com URLs antigas (/roms/...)
app.use("/roms", (req, res) => {
  console.log(`Redirecionando de /roms${req.url} para /roms-media${req.url}`);
  return res.redirect(301, `/roms-media${req.url}`);
});

// Rota para compatibilidade com formato /sistema/images/...
app.use("/:system/images/*", (req, res) => {
  const system = req.params.system;
  const imagePath = req.path.replace(`/${system}/images/`, "");

  // Redirecionar para o formato padrão
  const newUrl = `/roms-media/${system}/images/${imagePath}`;
  console.log(`Redirecionando de ${req.path} para ${newUrl}`);
  return res.redirect(301, newUrl);
});

// Rota específica para arquivos WebP
app.get("*.webp", (req, res, next) => {
  // Continuar com o próximo middleware, mas garantir que o Content-Type esteja definido
  res.type("image/webp");
  next();
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
