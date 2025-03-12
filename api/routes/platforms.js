/**
 * Rotas da API para plataformas/sistemas do EmulationStation
 */
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const configService = require("../services/configService");
const fileScanner = require("../utils/fileScanner");

const router = express.Router();

/**
 * GET /api/platforms
 * Retorna todas as plataformas
 */
router.get("/", (req, res) => {
  const systems = configService.getSystems(req.query.refresh === "true");

  // Obter os caminhos para diagnóstico
  const paths = configService.getPaths(true);

  // Converter para formato de resposta
  let platforms = [];

  if (systems && systems.length > 0) {
    platforms = systems.map((system) => ({
      id: system.id,
      name: system.fullName || system.name,
      shortName: system.name,
      theme: system.theme,
      platform: system.platform,
      extensions: system.extension,
      path: system.path,
      command: system.command,
      emulators: system.emulators || [],
    }));

    // Verificar se as plataformas têm emuladores e cores
    const platformsWithEmulators = platforms.filter(
      (p) => p.emulators && p.emulators.length > 0
    );

    // Retornar as plataformas encontradas
    return res.json({
      success: true,
      count: platforms.length,
      platforms: platforms,
    });
  } else {
    // Se não encontrou sistemas, retornar mensagem de diagnóstico
    return res.status(404).json({
      success: false,
      message: "Nenhuma plataforma encontrada!",
      diagnosis: {
        paths: paths,
        currentDir: process.cwd(),
        execPath: process.execPath,
        portableMode: process.env.ES_PORTABLE_MODE === "true",
        rootPath: process.env.ES_ROOT_PATH,
        envVars: {
          ES_PORTABLE_MODE: process.env.ES_PORTABLE_MODE,
          ES_ROOT_PATH: process.env.ES_ROOT_PATH,
        },
        dirExists: {
          rootDir: paths.rootDir ? fs.existsSync(paths.rootDir) : false,
          configDir: paths.configDir ? fs.existsSync(paths.configDir) : false,
          romsDir: paths.romsDir ? fs.existsSync(paths.romsDir) : false,
          emulationStationDir: paths.emulationStationDir
            ? fs.existsSync(paths.emulationStationDir)
            : false,
          biosDir: paths.biosDir ? fs.existsSync(paths.biosDir) : false,
          themesDir: paths.themesDir ? fs.existsSync(paths.themesDir) : false,
        },
      },
    });
  }
});

/**
 * GET /api/platforms/:id
 * Retorna uma plataforma específica
 */
router.get("/:id", (req, res) => {
  const systems = configService.getSystems();
  const system = systems.find((s) => s.id === req.params.id);

  if (!system) {
    return res.status(404).json({
      success: false,
      message: "Plataforma não encontrada",
    });
  }

  if (system.emulators && system.emulators.length > 0) {
    // Verificar cada emulador
    system.emulators.forEach((emulator, index) => {
      if (emulator.cores && emulator.cores.length > 0) {
        emulator.cores.forEach((core, coreIndex) => {
          console.log(`  Core ${coreIndex + 1}: ${core.name}`);
        });
      }
    });
  }

  // Converter para formato de resposta
  const platform = {
    id: system.id,
    name: system.fullName || system.name,
    shortName: system.name,
    theme: system.theme,
    platform: system.platform,
    extensions: system.extension,
    path: system.path,
    command: system.command,
    emulators: system.emulators || [],
  };

  res.json({
    success: true,
    data: platform,
  });
});

/**
 * Função para enviar um arquivo como stream, com o tipo de conteúdo apropriado
 */
function sendFileAsStream(res, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Arquivo não encontrado: ${filePath}`);
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
    }[extname] || "application/octet-stream";

  console.log(`Enviando arquivo ${filePath} com content-type ${contentType}`);

  try {
    // Enviar o arquivo como uma stream
    const stream = fs.createReadStream(filePath);
    res.setHeader("Content-Type", contentType);

    stream.on("error", (error) => {
      console.error(`Erro na stream: ${error.message}`);
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
    console.error(`Erro ao enviar arquivo: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: `Erro ao enviar arquivo: ${error.message}`,
      });
    }
    return false;
  }
}

/**
 * GET /api/platforms/:id/image
 * Retorna a imagem da plataforma
 */
router.get("/:id/image", (req, res) => {
  const systems = configService.getSystems();
  const system = systems.find((s) => s.id === req.params.id);

  if (!system) {
    return res.status(404).json({
      success: false,
      message: "Plataforma não encontrada",
    });
  }

  // Obter caminhos
  const paths = configService.getPaths();

  if (!paths.configDir) {
    return res.status(404).json({
      success: false,
      message: "Diretório de configuração não encontrado",
    });
  }

  // Procurar imagem
  const theme = system.theme || system.id;
  const currentTheme = configService.getCurrentTheme();

  // Possíveis locais para imagens da plataforma
  const possibleImages = [
    // No tema atual
    path.join(paths.themesDir, currentTheme.id, "art", "logos", `${theme}.png`),
    path.join(paths.themesDir, currentTheme.id, "art", "logos", `${theme}.jpg`),
    path.join(
      paths.themesDir,
      currentTheme.id,
      "art",
      "systems",
      `${theme}.png`
    ),
    path.join(
      paths.themesDir,
      currentTheme.id,
      "art",
      "systems",
      `${theme}.jpg`
    ),

    // No tema padrão
    path.join(paths.themesDir, "default", "art", "logos", `${theme}.png`),
    path.join(paths.themesDir, "default", "art", "logos", `${theme}.jpg`),
    path.join(paths.themesDir, "default", "art", "systems", `${theme}.png`),
    path.join(paths.themesDir, "default", "art", "systems", `${theme}.jpg`),

    // Recursos padrão
    path.join(paths.configDir, "resources", "logos", `${theme}.png`),
    path.join(paths.configDir, "resources", "logos", `${theme}.jpg`),
  ];

  // Procurar a primeira imagem que existe
  for (const imagePath of possibleImages) {
    if (fs.existsSync(imagePath)) {
      console.log(`Enviando imagem de logo: ${imagePath}`);
      return sendFileAsStream(res, imagePath);
    } else {
      console.log(
        `Logo não encontrado para ${system.id}, enviando placeholder`
      );
      const placeholderPath = path.join(
        __dirname,
        "../../themes/default/img/logo-placeholder.png"
      );
      return sendFileAsStream(res, placeholderPath);
    }
  }

  // Se não encontrou, retornar erro 404
  // Verificar se temos uma imagem placeholder
  const placeholderPath = path.join(
    __dirname,
    "../../themes/default/img/logo-placeholder.png"
  );
  if (fs.existsSync(placeholderPath)) {
    console.log(
      `Retornando imagem placeholder para plataforma ${req.params.id}`
    );
    return sendFileAsStream(res, placeholderPath);
  }

  // Se nem o placeholder existir, aí sim retornamos erro 404
  res.status(404).json({
    success: false,
    message: "Imagem não encontrada",
  });
});

/**
 * GET /api/platforms/:id/games
 * Retorna os jogos de uma plataforma
 */
router.get("/:id/games", (req, res) => {
  console.log(`Requisição recebida para jogos da plataforma ${req.params.id}`);

  const systems = configService.getSystems();
  const system = systems.find((s) => s.id === req.params.id);

  if (!system) {
    console.log(`Plataforma ${req.params.id} não encontrada`);
    return res.status(404).json({
      success: false,
      message: "Plataforma não encontrada",
    });
  }

  // Obter caminhos
  const paths = configService.getPaths();

  if (!paths.romsDir) {
    console.log("Diretório de ROMs não encontrado");
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  // Criar o diretório de ROMs para essa plataforma se não existir
  const platformRomsDir = path.join(paths.romsDir, system.id);
  if (!fs.existsSync(platformRomsDir)) {
    try {
      console.log(
        `Criando diretório de ROMs para ${system.name}: ${platformRomsDir}`
      );
      fs.mkdirSync(platformRomsDir, { recursive: true });
    } catch (err) {
      console.error(
        `Erro ao criar diretório de ROMs para ${system.name}:`,
        err
      );
    }
  }

  // Primeiramente, vamos tentar ler a gamelist.xml diretamente
  const gamelistPath = path.join(platformRomsDir, "gamelist.xml");
  console.log(`Tentando ler gamelist.xml de: ${gamelistPath}`);

  let gamelistGames = [];

  if (fs.existsSync(gamelistPath)) {
    try {
      // Ler e parsear o arquivo XML
      console.log("gamelist.xml encontrada, lendo conteúdo...");
      const xmlContent = fs.readFileSync(gamelistPath, "utf8");

      // Usar o XMLParser diretamente
      const { XMLParser } = require("fast-xml-parser");
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
      });

      const parsedXml = parser.parse(xmlContent);
      console.log("XML parseado com sucesso");

      if (parsedXml.gameList && parsedXml.gameList.game) {
        // Converter para array, caso seja um único jogo
        const games = Array.isArray(parsedXml.gameList.game)
          ? parsedXml.gameList.game
          : [parsedXml.gameList.game];

        console.log(`${games.length} jogos encontrados na gamelist.xml`);

        // Processar os jogos
        gamelistGames = games.map((game, index) => {
          // Extrair o ID ou usar o índice
          const gameId = game["@_id"] || index;

          // Processar caminhos de mídia (transformar caminhos relativos para absolutos)
          const processPath = (mediaPath) => {
            if (!mediaPath) return "";
            if (path.isAbsolute(mediaPath)) return mediaPath;

            // Remover o ./ do início se existir
            const normalizedPath = mediaPath.startsWith("./")
              ? mediaPath.substring(2)
              : mediaPath;
            return path.join(platformRomsDir, normalizedPath);
          };

          // Extrair o nome do arquivo da ROM do caminho
          const gamePath = game.path || "";
          const romFilename = path.basename(gamePath);

          // Criar o objeto do jogo com todos os dados da gamelist
          return {
            id: `${system.id}-${gameId}`,
            name:
              game.name ||
              path.basename(romFilename, path.extname(romFilename)),
            path: path.join(platformRomsDir, romFilename),
            desc: game.desc || `Jogo para ${system.fullName || system.name}`,
            image: processPath(game.image),
            thumbnail: processPath(game.thumbnail),
            video: processPath(game.video),
            marquee: processPath(game.marquee),
            fanart: processPath(game.fanart),
            rating: parseFloat(game.rating) || 0,
            releaseDate: game.releasedate,
            developer: game.developer || "",
            publisher: game.publisher || "",
            genre: game.genre || "",
            players: game.players || "",
            family: game.family || "",
            arcadeSystemName: game.arcadesystemname || "",
            region: game.region || "",
            lang: game.lang || "",
            extension: path.extname(romFilename).substring(1),
            favorite: game.favorite === "true" || game.favorite === true,
            // Adicionar todos os outros campos que existem no jogo
            raw_xml_game: game,
          };
        });

        // Verificar quais arquivos correspondem a jogos na gamelist
        console.log("Verificando arquivos de ROM no diretório...");

        // Listar todos os arquivos no diretório
        const files = fs
          .readdirSync(platformRomsDir)
          .filter(
            (f) =>
              !f.includes("gamelist.xml") &&
              !fs.statSync(path.join(platformRomsDir, f)).isDirectory()
          );

        console.log(`${files.length} arquivos encontrados no diretório`);

        // Adicionar jogos que estão no diretório mas não na gamelist
        for (const file of files) {
          const romPath = path.join(platformRomsDir, file);
          const ext = path.extname(file).toLowerCase();
          const supportedExts = system.extension || [".zip", ".7z"];

          // Normalizar extensões
          const normalizedExtensions = supportedExts.map((e) =>
            e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
          );

          // Verificar se é uma extensão suportada
          if (!normalizedExtensions.includes(ext)) {
            continue;
          }

          // Verificar se o jogo já existe na gamelist
          const existsInGamelist = gamelistGames.some(
            (g) => path.basename(g.path) === file
          );

          // Se não existir, adicionar como novo jogo
          if (!existsInGamelist) {
            const gameName = path.basename(file, ext);
            gamelistGames.push({
              id: `${system.id}-file-${gamelistGames.length}`,
              name: gameName,
              path: romPath,
              desc: `${gameName} para ${system.fullName || system.name}`,
              extension: ext.substring(1),
            });
          }
        }
      }
    } catch (err) {
      console.error("Erro ao processar gamelist.xml:", err);
    }
  }

  // Se temos jogos da gamelist, usá-los
  if (gamelistGames.length > 0) {
    console.log(`Usando ${gamelistGames.length} jogos da gamelist.xml`);
    res.json({
      success: true,
      data: gamelistGames,
      source: "gamelist.xml",
    });
    return;
  }

  // Fallback: usar o método de escaneamento de arquivos
  console.log(
    "Fallback: escaneando ROMs para ${system.name} em ${paths.romsDir}"
  );

  // Escanear os arquivos no diretório baseado nas extensões suportadas
  console.log(`Escaneando ROMs para ${system.name} em ${paths.romsDir}`);

  // Se o diretório não existir, criar uma lista vazia
  let games = [];

  try {
    // Verificar se o sistema tem extensões definidas
    if (!system.extension || system.extension.length === 0) {
      console.log(`Sistema ${system.name} não tem extensões definidas`);
      system.extension = [".zip", ".7z", ".rom"]; // Extensões padrão
    }

    // Usar a função scanRoms existente ou criar nossa própria função
    games = fileScanner.scanRoms(system, paths.romsDir);

    // Se não encontrou jogos, escanear diretamente os arquivos
    if (games.length === 0) {
      console.log(
        `Nenhum jogo encontrado pelo scanner, escaneando diretamente o diretório ${platformRomsDir}`
      );

      if (fs.existsSync(platformRomsDir)) {
        // Listar todos os arquivos no diretório
        const files = fs.readdirSync(platformRomsDir);

        // Filtrar apenas os arquivos com extensões suportadas
        const supportedExtensions = system.extension.map((ext) =>
          ext.startsWith(".") ? ext.toLowerCase() : "." + ext.toLowerCase()
        );

        console.log(
          `Extensões suportadas para ${system.name}:`,
          supportedExtensions
        );
        console.log(`Arquivos encontrados em ${platformRomsDir}:`, files);

        games = files
          .filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return supportedExtensions.includes(ext);
          })
          .map((file, index) => {
            const filePath = path.join(platformRomsDir, file);
            const fileName = path.basename(file, path.extname(file));

            return {
              id: `${system.id}-${index}`,
              name: fileName,
              path: filePath,
              desc: `${fileName} para ${system.fullName || system.name}`,
              extension: path.extname(file).substring(1),
            };
          });

        console.log(
          `${games.length} jogos encontrados após escaneamento direto`
        );
      }
    }
  } catch (err) {
    console.error(`Erro ao escanear jogos para ${system.name}:`, err);
  }

  console.log(`Enviando ${games.length} jogos na resposta`);

  res.json({
    success: true,
    data: games,
    source: "arquivo",
  });
});

/**
 * GET /api/platforms/:id/validate-gamelist
 * Valida e corrige IDs ausentes na gamelist.xml de uma plataforma
 */
router.get("/:id/validate-gamelist", async (req, res) => {
  try {
    const platformId = req.params.id;
    console.log(
      `Recebida solicitação para validar gamelist.xml de ${platformId}`
    );

    // Obter caminhos do configService
    const paths = configService.getPaths();

    if (!paths.romsDir) {
      return res.status(404).json({
        success: false,
        message: "Diretório de ROMs não encontrado",
      });
    }

    // Determinar o diretório de ROMs para a plataforma
    const platformRomsDir = path.join(paths.romsDir, platformId);

    // Verificar se o diretório existe
    if (!fs.existsSync(platformRomsDir)) {
      return res.status(404).json({
        success: false,
        message: `Diretório de ROMs para ${platformId} não encontrado`,
      });
    }

    // Caminho para a gamelist.xml
    const gamelistPath = path.join(platformRomsDir, "gamelist.xml");

    // Verificar se a gamelist.xml existe
    if (!fs.existsSync(gamelistPath)) {
      console.log(
        `gamelist.xml não encontrada para ${platformId}, nada a corrigir`
      );
      return res.json({
        success: true,
        message: "gamelist.xml não encontrada, nada a corrigir",
        changes: false,
      });
    }

    // Ler o conteúdo da gamelist.xml
    const xmlContent = fs.readFileSync(gamelistPath, "utf8");

    // Usar o XMLParser para analisar o arquivo
    const { XMLParser, XMLBuilder } = require("fast-xml-parser");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseAttributeValue: true,
      isArray: (name) => name === "game",
    });

    // Parsear o XML
    const parsedXml = parser.parse(xmlContent);

    // Verificar se a estrutura é válida
    if (!parsedXml.gameList || !parsedXml.gameList.game) {
      return res.status(400).json({
        success: false,
        message: "Estrutura inválida de gamelist.xml",
      });
    }

    // Garantir que game seja um array mesmo que tenha apenas um item
    const games = Array.isArray(parsedXml.gameList.game)
      ? parsedXml.gameList.game
      : [parsedXml.gameList.game];

    console.log(
      `Encontrados ${games.length} jogos na gamelist.xml de ${platformId}`
    );

    // Verificar se há algum jogo sem ID
    let needsCorrection = false;
    let highestId = 0;

    // Primeira passagem: verificar IDs existentes e encontrar o maior ID
    for (const game of games) {
      if (game["@_id"] !== undefined) {
        const id = Number(game["@_id"]);
        if (!isNaN(id) && id > highestId) {
          highestId = id;
        }
      } else {
        needsCorrection = true;
      }
    }

    // Se não precisa de correção, retornar
    if (!needsCorrection) {
      console.log(
        `Todos os jogos já possuem IDs na gamelist.xml de ${platformId}`
      );
      return res.json({
        success: true,
        message: "Todos os jogos já possuem IDs",
        changes: false,
      });
    }

    console.log(
      `Corrigindo gamelist.xml para ${platformId}. Último ID: ${highestId}`
    );

    // Segunda passagem: atribuir IDs para jogos que não têm
    let correctedCount = 0;
    for (const game of games) {
      if (game["@_id"] === undefined) {
        highestId++;
        game["@_id"] = highestId;
        correctedCount++;
        console.log(
          `Atribuído ID ${highestId} para o jogo: ${game.name || "sem nome"}`
        );
      }
    }

    // Reconstruir o XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      format: true,
    });

    // Criar o XML atualizado
    const updatedXml =
      '<?xml version="1.0"?>\n' + builder.build({ gameList: { game: games } });

    // Fazer backup da gamelist original
    const backupPath = `${gamelistPath}.backup`;
    fs.copyFileSync(gamelistPath, backupPath);
    console.log(`Backup criado em: ${backupPath}`);

    // Salvar o XML atualizado
    fs.writeFileSync(gamelistPath, updatedXml, "utf8");
    console.log(`gamelist.xml atualizada com sucesso para ${platformId}`);

    return res.json({
      success: true,
      message: `Corrigidos ${correctedCount} jogos sem ID`,
      correctedCount,
      changes: true,
    });
  } catch (error) {
    console.error(`Erro ao validar gamelist.xml:`, error);
    return res.status(500).json({
      success: false,
      message: `Erro ao validar gamelist.xml: ${error.message}`,
    });
  }
});

module.exports = router;
