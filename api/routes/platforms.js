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
  console.log("Requisição recebida para /api/platforms");

  const systems = configService.getSystems(req.query.refresh === "true");
  console.log(`Sistemas encontrados: ${systems ? systems.length : 0}`);

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
    }));
  } else {
    // Se não encontrou sistemas, criar plataformas de exemplo
    console.log("Nenhum sistema encontrado, criando plataformas de exemplo");
    platforms = [
      {
        id: "snes",
        name: "Super Nintendo Entertainment System",
        shortName: "SNES",
        theme: "snes",
        platform: "snes",
        extensions: [".smc", ".sfc", ".zip"],
        path: "./roms/snes",
        command: "emulatorcommand",
      },
      {
        id: "nes",
        name: "Nintendo Entertainment System",
        shortName: "NES",
        theme: "nes",
        platform: "nes",
        extensions: [".nes", ".zip"],
        path: "./roms/nes",
        command: "emulatorcommand",
      },
      {
        id: "megadrive",
        name: "Sega Mega Drive",
        shortName: "Genesis",
        theme: "megadrive",
        platform: "megadrive",
        extensions: [".md", ".gen", ".zip"],
        path: "./roms/megadrive",
        command: "emulatorcommand",
      },
    ];
  }

  console.log(`Enviando ${platforms.length} plataformas na resposta`);

  res.json({
    success: true,
    data: platforms,
  });
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
    emulators: system.emulators,
  };

  res.json({
    success: true,
    data: platform,
  });
});

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
      return res.sendFile(imagePath);
    }
  }

  // Se não encontrou, retornar erro 404
  // Verificar se temos uma imagem placeholder
  const placeholderPath = path.join(
    __dirname,
    "../../themes/default/img/placeholder.png"
  );
  if (fs.existsSync(placeholderPath)) {
    console.log(
      `Retornando imagem placeholder para plataforma ${req.params.id}`
    );
    return res.sendFile(placeholderPath);
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

module.exports = router;
