// Servidor principal da RIESCADE Theme Engine
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
const settingsRouter = require("./api/routes/settings");

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
  defaultMeta: { service: "riescade-theme-engine" },
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

// Verificar e criar diretório de configuração
const configDir = path.join(__dirname, "config");
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
  logger.info(`Diretório de configuração criado: ${configDir}`);
} else {
  logger.info(`Usando diretório de configuração existente: ${configDir}`);
}

// Definir o tema atual como um middleware
app.use((req, res, next) => {
  // Definir tema padrão ou ler das configurações
  req.currentTheme = "default";

  try {
    const configFile = path.join(configDir, "current_theme.json");
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
      if (config.currentTheme) {
        req.currentTheme = config.currentTheme;
        logger.info(`Usando tema atual: ${req.currentTheme}`);
      } else {
        logger.info(
          `Arquivo de configuração de tema não encontrado, usando tema padrão`
        );
      }
    } else {
      logger.info(
        `Arquivo de configuração de tema não encontrado, usando tema padrão`
      );
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
app.use("/api/frontend", settingsRouter);

/**
 * Função para injetar os arquivos CSS e JS do sistema de configurações
 * nos temas antes de enviá-los ao cliente
 */
function injectSettingsFiles(htmlContent) {
  // Injetar o CSS do modal de configurações antes do </head>
  htmlContent = htmlContent.replace(
    "</head>",
    '  <link rel="stylesheet" href="/css/settings-modal.css">\n</head>'
  );

  // Injetar o JS do gerenciador de configurações antes do </body>
  htmlContent = htmlContent.replace(
    "</body>",
    '  <script src="/js/settings-manager.js"></script>\n</body>'
  );

  return htmlContent;
}

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
    // Para arquivos HTML, injetar os arquivos CSS e JS do sistema de configurações
    if (extname === ".html") {
      const htmlContent = fs.readFileSync(filePath, "utf8");
      const modifiedContent = injectSettingsFiles(htmlContent);

      res.setHeader("Content-Type", contentType);
      res.send(modifiedContent);
      return true;
    }

    // Para outros tipos de arquivo, enviar como stream
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
  logger.info(
    `Requisição para a página inicial, tema atual: ${req.currentTheme}`
  );

  const themePath = path.join(
    __dirname,
    "themes",
    req.currentTheme,
    "index.html"
  );

  logger.info(`Verificando existência do tema em: ${themePath}`);

  if (fs.existsSync(themePath)) {
    logger.info(`Enviando tema atual: ${themePath}`);
    if (!sendFileAsStream(res, themePath)) {
      logger.error(`Falha ao enviar tema atual: ${themePath}`);
      res.status(500).send("Erro ao carregar tema");
    }
  } else {
    logger.warn(`Tema ${req.currentTheme} não encontrado em ${themePath}`);

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
  // Importar o configService para obter o caminho das ROMs
  const configService = require("./api/services/configService");
  const paths = configService.getPaths();

  // Usar o diretório de ROMs do configService ou um diretório padrão
  const romsDir =
    paths.romsDir || process.env.MEDIA_DIR || path.join(__dirname, "media");

  if (!romsDir) {
    logger.error("Diretório de ROMs não configurado");
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não configurado",
    });
  }

  // Pegar o caminho relativo da URL (remover a barra inicial)
  const relativePath = req.url.replace(/^\//, "");

  // Decodificar o caminho para lidar com caracteres especiais
  const decodedPath = decodeURIComponent(relativePath);

  logger.info(`Requisição de mídia para: ${decodedPath}`);

  // Construir o caminho completo para o arquivo
  const filePath = path.join(romsDir, decodedPath);

  // Verificar se o arquivo existe
  if (!fs.existsSync(filePath)) {
    logger.warn(`Arquivo não encontrado: ${filePath}`);

    // Tentar caminhos alternativos
    const systemId = decodedPath.split("/")[0]; // Ex: "naomi2"
    const fileName = path.basename(decodedPath); // Ex: "vstrik3c.jpg"
    const baseFileName = path.basename(fileName, path.extname(fileName)); // Ex: "vstrik3c"

    // Possíveis localizações alternativas
    const alternativePaths = [
      // Caminho com estrutura diferente
      path.join(
        romsDir,
        systemId,
        "images",
        baseFileName + path.extname(fileName)
      ),
      path.join(
        romsDir,
        systemId,
        "boxart",
        baseFileName + path.extname(fileName)
      ),
      path.join(
        romsDir,
        systemId,
        "screenshots",
        baseFileName + path.extname(fileName)
      ),
      path.join(
        romsDir,
        systemId,
        "fanart",
        baseFileName + path.extname(fileName)
      ),
      // Caminho direto na raiz do sistema
      path.join(romsDir, systemId, baseFileName + path.extname(fileName)),
    ];

    // Verificar cada caminho alternativo
    for (const altPath of alternativePaths) {
      if (fs.existsSync(altPath)) {
        logger.info(`Arquivo alternativo encontrado: ${altPath}`);
        return sendFileAsStream(res, altPath);
      }
    }

    // Se não encontrou nenhuma alternativa, enviar uma imagem placeholder
    const placeholderPath = path.join(
      __dirname,
      "themes/default/img/placeholder.png"
    );
    if (fs.existsSync(placeholderPath)) {
      logger.info(`Enviando placeholder para ${fileName}`);
      return sendFileAsStream(res, placeholderPath);
    }

    // Se não tiver placeholder, retornar 404
    return res.status(404).json({
      success: false,
      message: "Arquivo não encontrado",
    });
  }

  // Verificar se é um diretório
  if (fs.statSync(filePath).isDirectory()) {
    logger.error(`O caminho é um diretório, não um arquivo: ${filePath}`);
    return res.status(400).json({
      success: false,
      message: "O caminho é um diretório, não um arquivo",
    });
  }

  // Enviar o arquivo
  sendFileAsStream(res, filePath);
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
