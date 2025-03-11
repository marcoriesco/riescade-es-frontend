/**
 * Utilitário para escanear diretórios do EmulationStation
 */
const fs = require("fs-extra");
const path = require("path");
const glob = require("glob");
const os = require("os");
const xmlParser = require("./xmlParser");
const pathFinder = require("./pathFinder");

/**
 * Escaneia os sistemas de jogos disponíveis
 * @param {string} configDir - Diretório de configuração do EmulationStation
 * @returns {Array} Lista de sistemas encontrados
 */
function scanSystems(configDir) {
  console.log(`Escaneando sistemas em ${configDir}`);
  const systems = [];

  try {
    // Lista de possíveis locais para o arquivo es_systems.cfg
    const systemFile = path.join(configDir, "es_systems.cfg");

    // Para cada arquivo de sistemas
    const systemsFromFile = xmlParser.parseSystemsConfig(systemFile);

    if (systemsFromFile && systemsFromFile.length > 0) {
      console.log(
        `Adicionando ${systemsFromFile.length} sistemas de ${systemFile}`
      );
      systems.push(...systemsFromFile);
    }

    // Se não encontrou sistemas, registrar no log e retornar array vazio
    if (systems.length === 0) {
      console.log("Nenhum sistema encontrado nos arquivos de configuração!");

      // Obter e exibir informações sobre os caminhos para ajudar no diagnóstico
      const paths = pathFinder.findEmulationStationPaths();
      console.log("Caminhos encontrados:", JSON.stringify(paths, null, 2));
    }
  } catch (err) {
    console.error("Erro ao escanear sistemas:", err);
  }

  return systems;
}

/**
 * Escaneia ROMs para um sistema específico
 * @param {Object} system - Objeto do sistema
 * @param {string} romsDir - Diretório base de ROMs
 * @returns {Array} Lista de ROMs encontradas
 */
function scanRoms(system, romsDir) {
  const roms = [];

  if (!system || !system.extension) {
    console.log("Sistema inválido ou sem extensões definidas");
    return roms;
  }

  try {
    // Verificar extensões
    if (!Array.isArray(system.extension)) {
      system.extension = system.extension.split(" ");
    }

    // Determinar o diretório específico da plataforma
    let platformDir;

    if (system.path) {
      // Expandir o caminho do sistema (substituir ~ por homedir)
      let systemPath = system.path;
      if (systemPath.includes("~")) {
        systemPath = systemPath.replace(/~/, os.homedir());
      }

      // Verificar se é um caminho relativo ou absoluto
      if (!path.isAbsolute(systemPath) && romsDir) {
        platformDir = path.join(romsDir, system.id);
      } else {
        platformDir = systemPath;
      }
    } else {
      // Se não tem caminho definido, usar ID do sistema
      platformDir = path.join(romsDir, system.id);
    }

    console.log(`Escaneando diretório para ${system.name}: ${platformDir}`);

    // Verificar se o diretório existe
    if (!fs.existsSync(platformDir)) {
      console.log(`Diretório não encontrado: ${platformDir}`);
      return roms;
    }

    // Normalizar extensões (garantir que todas começam com ponto)
    const normalizedExtensions = system.extension.map((ext) =>
      ext.startsWith(".") ? ext.toLowerCase() : "." + ext.toLowerCase()
    );

    console.log(
      `Extensões suportadas para ${system.name}:`,
      normalizedExtensions
    );

    // Listar todos os arquivos no diretório
    const files = fs.readdirSync(platformDir, { withFileTypes: true });

    // Procurar a gamelist.xml
    const gamelistPath = path.join(platformDir, "gamelist.xml");
    let gamelistData = [];

    if (fs.existsSync(gamelistPath)) {
      console.log(`Arquivo gamelist.xml encontrado em: ${gamelistPath}`);
      try {
        gamelistData = xmlParser.parseGamelist(gamelistPath);
        console.log(`Lidos ${gamelistData.length} jogos da gamelist.xml`);

        // Log detalhado para depuração
        if (gamelistData.length > 0) {
          console.log("Exemplo de dados da gamelist para o primeiro jogo:");
          const sampleGame = gamelistData[0];
          console.log(`  Nome: ${sampleGame.name}`);
          console.log(`  Caminho: ${sampleGame.path}`);
          console.log(
            `  Descrição: ${
              sampleGame.desc ? sampleGame.desc.substring(0, 50) + "..." : "N/A"
            }`
          );
          console.log(`  Imagem: ${sampleGame.image || "N/A"}`);
          console.log(`  Desenvolvedor: ${sampleGame.developer || "N/A"}`);
        }
      } catch (err) {
        console.error(`Erro ao parsear gamelist.xml: ${err.message}`);
        console.error(err.stack);
      }
    } else {
      console.log(`gamelist.xml não encontrada em: ${gamelistPath}`);
    }

    // Processar cada arquivo
    for (const file of files) {
      // Ignorar diretórios
      if (file.isDirectory()) continue;

      const filename = file.name;
      const ext = path.extname(filename).toLowerCase();

      // Verificar se a extensão é suportada
      if (normalizedExtensions.includes(ext)) {
        const filePath = path.join(platformDir, filename);
        const gameId = `${system.id}-${roms.length}`;
        const gameName = path.basename(filename, ext);

        // Criar dados básicos do jogo
        const gameData = {
          id: gameId,
          name: gameName,
          path: filePath,
          filename: filename,
          extension: ext.substring(1),
          desc: `${gameName} para ${system.fullName || system.name}`,
        };

        // Procurar na gamelist por metadados adicionais
        if (gamelistData.length > 0) {
          // Tentar encontrar o jogo na gamelist
          const gameInfo = gamelistData.find((game) => {
            // 1. Obter o caminho da gamelist (geralmente "./jojo.zip")
            const gamelistPath = (game.path || "")
              .replace(/\\/g, "/")
              .toLowerCase();

            // 2. Obter o nome do arquivo ROM atual
            const romFilename = filename.toLowerCase();

            // 3. Extrair apenas o nome do arquivo do caminho da gamelist (sem o ./)
            const gamelistFilename = path.basename(gamelistPath).toLowerCase();

            // 4. Comparar os nomes dos arquivos diretamente
            const isMatch = gamelistFilename === romFilename;

            console.log(
              `Comparando: ROM="${romFilename}" com Gamelist="${gamelistFilename}" - Match: ${isMatch}`
            );

            return isMatch;
          });

          // Se encontrou informações na gamelist, adicionar ao jogo
          if (gameInfo) {
            console.log(`Encontrados metadados na gamelist para: ${gameName}`);
            console.log(`  ID na gamelist: ${gameInfo.id}`);
            console.log(`  Nome na gamelist: ${gameInfo.name}`);
            console.log(`  Caminho na gamelist: ${gameInfo.path}`);
            console.log(
              `  Descrição na gamelist: ${
                gameInfo.desc ? gameInfo.desc.substring(0, 50) + "..." : "N/A"
              }`
            );

            // Definir imagens com caminhos absolutos (já processados pelo xmlParser)
            // Adicionar metadados
            Object.assign(gameData, {
              id: `${system.id}-${gameInfo.id}`, // Usar o ID da gamelist com prefixo do sistema
              name: gameInfo.name || gameData.name,
              desc: gameInfo.desc || gameData.desc,
              image: gameInfo.image || "",
              thumbnail: gameInfo.thumbnail || "",
              video: gameInfo.video || "",
              marquee: gameInfo.marquee || "",
              fanart: gameInfo.fanart || "",
              rating: gameInfo.rating || 0,
              releaseDate: gameInfo.releaseDate || "",
              developer: gameInfo.developer || "",
              publisher: gameInfo.publisher || "",
              genre: gameInfo.genre || "",
              players: gameInfo.players || "",
              family: gameInfo.family || "",
              arcadeSystemName: gameInfo.arcadeSystemName || "",
              region: gameInfo.region || "",
              lang: gameInfo.lang || "",
              playCount: gameInfo.playCount || 0,
              lastPlayed: gameInfo.lastPlayed || "",
              favorite: gameInfo.favorite || false,
              hidden: gameInfo.hidden || false,
            });

            console.log(
              `Metadados atualizados para ${gameData.name}, ID: ${gameData.id}`
            );
          }
        }

        roms.push(gameData);
      }
    }

    console.log(`Encontrados ${roms.length} jogos para ${system.name}`);

    return roms;
  } catch (err) {
    console.error(
      `Erro ao escanear ROMs para ${
        system ? system.name : "sistema desconhecido"
      }:`,
      err
    );
    return roms;
  }
}

/**
 * Escaneia temas disponíveis
 * @param {string} themesDir - Diretório de temas
 * @returns {Array} Lista de temas encontrados
 */
function scanThemes(themesDir) {
  const themes = [];

  try {
    // Verificar se o diretório existe
    if (!fs.existsSync(themesDir) || !fs.statSync(themesDir).isDirectory()) {
      return themes;
    }

    // Listar todos os subdiretórios no diretório de temas
    const themeDirs = fs
      .readdirSync(themesDir)
      .filter((item) => fs.statSync(path.join(themesDir, item)).isDirectory());

    // Para cada subdiretório, verificar se é um tema válido
    for (const themeDir of themeDirs) {
      const themePath = path.join(themesDir, themeDir);
      const themeConfigPath = path.join(themePath, "theme.xml");

      // Tema básico (apenas nome e caminho)
      const theme = {
        id: themeDir.toLowerCase(),
        name: themeDir,
        path: themePath,
        isWebTheme: false,
      };

      // Verificar se é um tema web (se tem index.html)
      const indexHtmlPath = path.join(themePath, "index.html");
      if (fs.existsSync(indexHtmlPath)) {
        theme.isWebTheme = true;
      }

      // Se tem arquivo theme.xml, ler informações adicionais
      if (fs.existsSync(themeConfigPath)) {
        try {
          const themeConfig = xmlParser.parseXmlFile(themeConfigPath);

          if (themeConfig && themeConfig.theme) {
            if (themeConfig.theme.name) {
              theme.name = themeConfig.theme.name;
            }

            if (themeConfig.theme.description) {
              theme.description = themeConfig.theme.description;
            }

            if (themeConfig.theme.author) {
              theme.author = themeConfig.theme.author;
            }

            if (themeConfig.theme.version) {
              theme.version = themeConfig.theme.version;
            }
          }
        } catch (err) {
          console.error(`Erro ao parsear theme.xml para ${themeDir}:`, err);
        }
      }

      themes.push(theme);
    }
  } catch (err) {
    console.error("Erro ao escanear temas:", err);
  }

  return themes;
}

/**
 * Escaneia configurações do EmulationStation
 * @param {string} configDir - Diretório de configuração
 * @returns {Object} Configurações encontradas
 */
function scanSettings(configDir) {
  const settings = {
    general: {},
    input: {},
    ui: {},
    audio: {},
    scraper: {},
  };

  try {
    // Arquivos de configuração importantes
    const settingsFile = path.join(configDir, "es_settings.cfg");
    const inputFile = path.join(configDir, "es_input.cfg");

    // Ler arquivo es_settings.cfg
    if (fs.existsSync(settingsFile)) {
      const settingsData = xmlParser.parseXmlFile(settingsFile);

      if (settingsData && settingsData.config && settingsData.config.string) {
        const strings = Array.isArray(settingsData.config.string)
          ? settingsData.config.string
          : [settingsData.config.string];

        // Processar cada configuração
        for (const setting of strings) {
          if (setting["@_name"] && setting["@_value"] !== undefined) {
            const name = setting["@_name"];
            const value = setting["@_value"];

            // Categorizar configurações
            if (name.startsWith("Audio")) {
              settings.audio[name] = value;
            } else if (name.startsWith("Input")) {
              settings.input[name] = value;
            } else if (name.startsWith("UI")) {
              settings.ui[name] = value;
            } else if (name.startsWith("Scraper")) {
              settings.scraper[name] = value;
            } else {
              settings.general[name] = value;
            }
          }
        }
      }
    }

    // Ler arquivo es_input.cfg para configurações de controle
    if (fs.existsSync(inputFile)) {
      const inputData = xmlParser.parseXmlFile(inputFile);

      if (inputData && inputData.inputList && inputData.inputList.inputConfig) {
        // Processar configurações de controle
        const configs = Array.isArray(inputData.inputList.inputConfig)
          ? inputData.inputList.inputConfig
          : [inputData.inputList.inputConfig];

        settings.input.controllers = configs.map((config) => {
          const controller = {
            type: config["@_type"] || "unknown",
            deviceName: config["@_deviceName"] || "",
            deviceGUID: config["@_deviceGUID"] || "",
          };

          // Processar mapeamentos de botões
          if (config.input) {
            const inputs = Array.isArray(config.input)
              ? config.input
              : [config.input];

            controller.buttons = {};
            for (const input of inputs) {
              if (input["@_name"] && input["@_id"] !== undefined) {
                controller.buttons[input["@_name"]] = input["@_id"];
              }
            }
          }

          return controller;
        });
      }
    }
  } catch (err) {
    console.error("Erro ao escanear configurações:", err);
  }

  return settings;
}

/**
 * Escaneia BIOS disponíveis
 * @param {string} biosDir - Diretório de BIOS
 * @returns {Array} Lista de BIOS encontrados
 */
function scanBios(biosDir) {
  const bios = [];

  try {
    // Verificar se o diretório existe
    if (!fs.existsSync(biosDir) || !fs.statSync(biosDir).isDirectory()) {
      return bios;
    }

    // Listar todos os arquivos no diretório BIOS (recursivamente)
    const biosFiles = glob.sync(path.join(biosDir, "**/*"), {
      nodir: true,
    });

    // Processar cada arquivo
    for (const biosFile of biosFiles) {
      // Ignorar arquivos ocultos e temporários
      if (
        path.basename(biosFile).startsWith(".") ||
        path.basename(biosFile).startsWith("~")
      ) {
        continue;
      }

      // Criar objeto de BIOS
      bios.push({
        path: biosFile,
        filename: path.basename(biosFile),
        directory: path.relative(biosDir, path.dirname(biosFile)),
        size: fs.statSync(biosFile).size,
      });
    }
  } catch (err) {
    console.error("Erro ao escanear BIOS:", err);
  }

  return bios;
}

module.exports = {
  scanSystems,
  scanRoms,
  scanThemes,
  scanSettings,
  scanBios,
};
