/**
 * Utilitário para analisar arquivos XML do EmulationStation
 */
const fs = require("fs-extra");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");
const path = require("path");

// Opções para o parser XML
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  cdataTagName: "__cdata",
  processEntities: true,
  numberParseOptions: {
    hex: true,
    leadingZeros: false,
  },
};

// Opções para o builder XML
const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  format: true,
  indentBy: "  ",
  suppressEmptyNode: true,
};

/**
 * Analisa um arquivo XML
 * @param {string} filePath - Caminho para o arquivo XML
 * @returns {Object} Objeto JavaScript representando o XML
 */
function parseXmlFile(filePath) {
  try {
    const xmlContent = fs.readFileSync(filePath, "utf8");
    return parseXmlString(xmlContent);
  } catch (err) {
    console.error(`Erro ao analisar o arquivo XML ${filePath}:`, err);
    return null;
  }
}

/**
 * Analisa uma string XML
 * @param {string} xmlString - String XML a ser analisada
 * @returns {Object} Objeto JavaScript representando o XML
 */
function parseXmlString(xmlString) {
  try {
    const parser = new XMLParser(parserOptions);
    return parser.parse(xmlString);
  } catch (err) {
    console.error("Erro ao analisar a string XML:", err);
    return null;
  }
}

/**
 * Converte um objeto JavaScript em XML
 * @param {Object} jsObject - Objeto JavaScript para converter
 * @returns {string} String XML
 */
function buildXmlString(jsObject) {
  try {
    const builder = new XMLBuilder(builderOptions);
    return builder.build(jsObject);
  } catch (err) {
    console.error("Erro ao construir a string XML:", err);
    return null;
  }
}

/**
 * Salva um objeto JavaScript como arquivo XML
 * @param {string} filePath - Caminho onde salvar o arquivo XML
 * @param {Object} jsObject - Objeto JavaScript para salvar
 * @returns {boolean} true se salvo com sucesso, false caso contrário
 */
function saveXmlFile(filePath, jsObject) {
  try {
    const xmlString = buildXmlString(jsObject);
    if (xmlString) {
      fs.writeFileSync(filePath, xmlString, "utf8");
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Erro ao salvar o arquivo XML ${filePath}:`, err);
    return false;
  }
}

/**
 * Analisa um arquivo gamelist.xml do EmulationStation
 * @param {string} filePath - Caminho para o arquivo gamelist.xml
 * @returns {Array} Array de objetos de jogo
 */
function parseGamelist(filePath) {
  try {
    console.log(`Iniciando análise do arquivo gamelist: ${filePath}`);

    // Ler o conteúdo do arquivo
    const xmlContent = fs.readFileSync(filePath, "utf8");
    console.log(
      `Conteúdo da gamelist lido, tamanho: ${xmlContent.length} bytes`
    );
    console.log(
      `Primeiros 200 caracteres da gamelist: ${xmlContent.substring(0, 200)}`
    );

    // Definir opções especiais para o parser
    const parserOptionsForGamelist = {
      ...parserOptions,
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    };

    // Analisar o XML com as opções específicas
    const parser = new XMLParser(parserOptionsForGamelist);
    const gamelistData = parser.parse(xmlContent);

    console.log(
      `XML analisado, estrutura de alto nível: ${Object.keys(gamelistData).join(
        ", "
      )}`
    );

    // Verificar se temos a estrutura esperada
    if (
      !gamelistData ||
      !gamelistData.gameList ||
      !gamelistData.gameList.game
    ) {
      console.log("Estrutura esperada não encontrada no XML");
      return [];
    }

    // Garantir que temos um array, mesmo que haja apenas um jogo
    const games = Array.isArray(gamelistData.gameList.game)
      ? gamelistData.gameList.game
      : [gamelistData.gameList.game];

    console.log(`Encontrados ${games.length} jogos no gamelist.xml`);

    if (games.length > 0) {
      console.log(
        `Primeiro jogo no gamelist: ${JSON.stringify(
          games[0],
          null,
          2
        ).substring(0, 300)}...`
      );
    }

    // Converter para um formato mais fácil de usar
    const convertedGames = games.map((game) => {
      // Determinar o diretório base para caminhos relativos
      const baseDir = path.dirname(filePath);

      // Extrair o ID a partir do atributo ou gerar um novo
      const gameId = game["@_id"] || generateId(game.path);

      // Processar caminhos relativos para diferentes tipos de mídia
      const processPath = (mediaPath) => {
        if (!mediaPath) return "";
        if (path.isAbsolute(mediaPath)) return mediaPath;

        // Converter caminhos relativos como "./images/file.png" para absolutos
        const normalizedPath = mediaPath.startsWith("./")
          ? mediaPath.substring(2)
          : mediaPath;
        return path.join(baseDir, normalizedPath);
      };

      // Extrair e converter todos os campos de mídia
      const imagePath = processPath(game.image);
      const thumbnailPath = processPath(game.thumbnail);
      const videoPath = processPath(game.video);
      const marqueePath = processPath(game.marquee);
      const fanartPath = processPath(game.fanart);

      return {
        id: gameId,
        path: game.path || "",
        name: game.name || path.basename(game.path, path.extname(game.path)),
        desc: game.desc || "",
        image: imagePath,
        thumbnail: thumbnailPath,
        video: videoPath,
        marquee: marqueePath,
        fanart: fanartPath,
        rating: parseFloat(game.rating) || 0,
        releaseDate: game.releasedate || "",
        developer: game.developer || "",
        publisher: game.publisher || "",
        genre: game.genre || "",
        players: game.players || "",
        family: game.family || "",
        arcadeSystemName: game.arcadesystemname || "",
        region: game.region || "",
        lang: game.lang || "",
        playCount: parseInt(game.playcount) || 0,
        lastPlayed: game.lastplayed || "",
        favorite: game.favorite === "true" || game.favorite === true,
        hidden: game.hidden === "true" || game.hidden === true,
      };
    });

    console.log(`Dados convertidos para ${convertedGames.length} jogos`);
    if (convertedGames.length > 0) {
      const sample = convertedGames[0];
      console.log(`Exemplo de jogo processado:`);
      console.log(`  ID: ${sample.id}`);
      console.log(`  Nome: ${sample.name}`);
      console.log(`  Caminho: ${sample.path}`);
      console.log(`  Imagem: ${sample.image}`);
      console.log(`  Developer: ${sample.developer}`);
    }

    return convertedGames;
  } catch (err) {
    console.error(`Erro ao analisar o gamelist ${filePath}:`, err);
    console.error(err.stack);
    return [];
  }
}

/**
 * Analisa um arquivo es_systems.cfg
 * @param {string} filePath - Caminho para o arquivo es_systems.cfg
 * @returns {Array} Array de objetos de sistema
 */
function parseSystemsConfig(filePath) {
  try {
    console.log(`Analisando arquivo de configuração de sistemas: ${filePath}`);
    const xmlContent = fs.readFileSync(filePath, "utf8");
    console.log(
      `Conteúdo do arquivo (primeiros 200 caracteres): ${xmlContent.substring(
        0,
        200
      )}...`
    );

    const systemsData = parseXmlFile(filePath);
    console.log(
      `Resultado da análise XML:`,
      JSON.stringify(systemsData, null, 2).substring(0, 300) + "..."
    );

    if (
      !systemsData ||
      !systemsData.systemList ||
      !systemsData.systemList.system
    ) {
      console.log(
        `Arquivo ${filePath} não contém sistemas válidos. Estrutura:`,
        systemsData
      );
      return [];
    }

    // Garantir que temos um array, mesmo que haja apenas um sistema
    const systems = Array.isArray(systemsData.systemList.system)
      ? systemsData.systemList.system
      : [systemsData.systemList.system];

    console.log(
      `Encontrados ${systems.length} sistemas no arquivo ${filePath}`
    );

    return systems.map((system) => {
      // Processar comandos para substituir variáveis
      let command = system.command || "";
      command = command
        .replace(/%ROM%/g, "{rom}")
        .replace(/%BASENAME%/g, "{basename}")
        .replace(/%ROM_RAW%/g, "{rom_raw}");

      return {
        id: system.name || generateId(system.fullname),
        name: system.name || "",
        fullName: system.fullname || system.name || "",
        path: system.path || "",
        extension: system.extension ? system.extension.split(" ") : [],
        command: command,
        platform: system.platform || "",
        theme: system.theme || system.name || "",
        emulators: parseEmulators(system),
      };
    });
  } catch (err) {
    console.error(`Erro ao analisar o arquivo de sistemas ${filePath}:`, err);
    return [];
  }
}

/**
 * Extrai informações de emuladores de um sistema
 */
function parseEmulators(system) {
  if (!system._children || !system._children.emulator) {
    return [];
  }

  const emulators = Array.isArray(system._children.emulator)
    ? system._children.emulator
    : [system._children.emulator];

  return emulators.map((emulator) => {
    const name = emulator["@_name"] || "default";

    let cores = [];
    if (emulator._children && emulator._children.core) {
      cores = Array.isArray(emulator._children.core)
        ? emulator._children.core
        : [emulator._children.core];

      cores = cores.map((core) => ({
        name: core["@_name"] || "default",
        command: core._text || "",
      }));
    }

    return {
      name,
      command: emulator._text || "",
      cores,
    };
  });
}

/**
 * Gera um ID a partir de uma string
 * @param {string} str - String para gerar ID
 * @returns {string} ID gerado
 */
function generateId(str) {
  if (!str) return Math.random().toString(36).substring(2, 10);

  // Converter para string e remover caracteres especiais
  const cleanStr = String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Se a string ficou vazia, gerar ID aleatório
  if (!cleanStr) return Math.random().toString(36).substring(2, 10);

  return cleanStr;
}

module.exports = {
  parseXmlFile,
  parseXmlString,
  buildXmlString,
  saveXmlFile,
  parseGamelist,
  parseSystemsConfig,
};
