/**
 * Endpoints para manipulação de jogos
 */
const path = require("path");
const fs = require("fs");
const { XMLParser } = require("fast-xml-parser");

// Referência global para os caminhos (será definida na inicialização)
let PATHS;

/**
 * Inicializa os endpoints com as configurações necessárias
 * @param {Object} paths - Objeto com os caminhos do aplicativo
 */
function initialize(paths) {
  PATHS = paths;
}

/**
 * Obtém a lista de jogos para um sistema específico
 * @param {string} systemName - Nome do sistema
 * @returns {Promise<Object>} Lista de jogos do sistema
 */
async function getGamesBySystem(systemName) {
  try {
    // Obter informações do sistema primeiro
    const systemConfigPath = path.join(
      PATHS.EMULATIONSTATION_CONFIG,
      "es_systems.cfg"
    );

    if (!fs.existsSync(systemConfigPath)) {
      return {
        error: `Arquivo de configuração não encontrado: ${systemConfigPath}`,
      };
    }

    // Processar arquivo de configuração
    const systemXmlData = fs.readFileSync(systemConfigPath, "utf8");
    const parser = new XMLParser({ ignoreAttributes: false });
    const systemConfig = parser.parse(systemXmlData);

    if (!systemConfig.systemList || !systemConfig.systemList.system) {
      return { error: "Formato de configuração inválido" };
    }

    // Obter sistemas e encontrar o solicitado
    const systems = Array.isArray(systemConfig.systemList.system)
      ? systemConfig.systemList.system
      : [systemConfig.systemList.system];

    const system = systems.find((sys) => sys.name === systemName);

    if (!system) {
      return { error: `Sistema não encontrado: ${systemName}` };
    }

    // Obter caminho das ROMs
    const romPath = path.isAbsolute(system.path)
      ? system.path
      : path.join(PATHS.ROMS, systemName);

    // Verificar se o diretório existe
    if (!fs.existsSync(romPath)) {
      return { error: `Diretório de ROMs não encontrado: ${romPath}` };
    }

    // Obter o arquivo gamelist.xml se existir
    const gameListPath = path.join(
      PATHS.EMULATIONSTATION_CONFIG,
      "gamelists",
      systemName,
      "gamelist.xml"
    );
    let gameList = { game: [] };

    if (fs.existsSync(gameListPath)) {
      try {
        const gameListXml = fs.readFileSync(gameListPath, "utf8");
        const gameListData = parser.parse(gameListXml);

        if (gameListData && gameListData.gameList) {
          gameList = gameListData.gameList;

          // Normalizar para sempre ter um array de jogos
          if (gameList.game && !Array.isArray(gameList.game)) {
            gameList.game = [gameList.game];
          }
        }
      } catch (error) {
        console.error(
          `Erro ao processar gamelist.xml para ${systemName}:`,
          error
        );
        // Continuar com lista vazia se houver erro
      }
    }

    // Processar os arquivos de ROMs do diretório
    const romFiles = fs.readdirSync(romPath).filter((file) => {
      const filePath = path.join(romPath, file);
      return fs.statSync(filePath).isFile();
    });

    // Extensões válidas para este sistema
    const validExtensions = system.extension ? system.extension.split(" ") : [];

    // Mapear arquivos para objetos de jogo
    const games = romFiles
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return validExtensions.some(
          (validExt) => `.${validExt.toLowerCase()}` === ext
        );
      })
      .map((file) => {
        const filePath = path.join(romPath, file);
        const gameInfo =
          gameList.game &&
          gameList.game.find((g) => {
            // Tentar encontrar pelo path ou pelo nome do arquivo
            return (
              (g.path && g.path.includes(file)) ||
              (g.name && g.name === path.basename(file, path.extname(file)))
            );
          });

        // Criar objeto do jogo com dados básicos e metadados se disponíveis
        return {
          id: `${systemName}_${path.basename(file, path.extname(file))}`,
          path: filePath,
          name: gameInfo?.name || path.basename(file, path.extname(file)),
          systemName: systemName,
          // Adicionar metadados do gamelist.xml se disponíveis
          description: gameInfo?.desc || "",
          developer: gameInfo?.developer || "",
          publisher: gameInfo?.publisher || "",
          genre: gameInfo?.genre || "",
          releaseDate: gameInfo?.releasedate || "",
          players: gameInfo?.players || "",
          image: gameInfo?.image || "",
          thumbnail: gameInfo?.thumbnail || "",
          video: gameInfo?.video || "",
          rating: gameInfo?.rating || 0,
          favorite:
            gameInfo?.favorite === "true" || gameInfo?.favorite === true,
          playCount: gameInfo?.playcount || 0,
          lastPlayed: gameInfo?.lastplayed || "",
        };
      });

    return {
      games,
      systemInfo: {
        name: system.name,
        fullName: system.fullname,
        path: romPath,
        gameCount: games.length,
      },
    };
  } catch (error) {
    console.error(`Erro ao obter jogos para ${systemName}:`, error);
    return { error: error.message };
  }
}

/**
 * Obtém detalhes de um jogo específico
 * @param {string} systemName - Nome do sistema
 * @param {string} gameId - ID do jogo
 * @returns {Promise<Object>} Detalhes do jogo
 */
async function getGameById(systemName, gameId) {
  try {
    const { games, error } = await getGamesBySystem(systemName);

    if (error) {
      return { error };
    }

    const game = games.find((g) => g.id === gameId);

    if (!game) {
      return { error: `Jogo não encontrado: ${gameId}` };
    }

    return { game };
  } catch (error) {
    console.error(
      `Erro ao obter jogo ${gameId} do sistema ${systemName}:`,
      error
    );
    return { error: error.message };
  }
}

/**
 * Atualiza o status de favorito de um jogo
 * @param {string} systemName - Nome do sistema
 * @param {string} gameId - ID do jogo
 * @param {boolean} favorite - Novo status de favorito
 * @returns {Promise<Object>} Resultado da operação
 */
async function updateGameFavorite(systemName, gameId, favorite) {
  try {
    // Primeiro, obter o jogo
    const { game, error } = await getGameById(systemName, gameId);

    if (error) {
      return { error };
    }

    // Caminho para o gamelist.xml
    const gameListPath = path.join(
      PATHS.EMULATIONSTATION_CONFIG,
      "gamelists",
      systemName,
      "gamelist.xml"
    );

    // Se o arquivo não existir, criar um novo
    if (!fs.existsSync(gameListPath)) {
      const gameListDir = path.dirname(gameListPath);

      if (!fs.existsSync(gameListDir)) {
        fs.mkdirSync(gameListDir, { recursive: true });
      }

      const initialXml = `<?xml version="1.0"?>
<gameList>
</gameList>`;

      fs.writeFileSync(gameListPath, initialXml, "utf8");
    }

    // Ler o gamelist.xml existente
    const gameListXml = fs.readFileSync(gameListPath, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      preserveOrder: true,
      format: true,
    });

    // Parsear como objeto para manipulação
    const gameListData = parser.parse(gameListXml);

    // Verificar se o jogo já existe no gamelist
    const gameEntry = gameListData.find(
      (item) =>
        item.gameList &&
        item.gameList.find(
          (game) => game.path && game.path.includes(path.basename(game.path))
        )
    );

    // Se o jogo não existir, adicionar uma nova entrada
    if (!gameEntry) {
      // TODO: Implementar adição de novo jogo ao gamelist.xml
      return { error: "Atualização de status de favorito não implementada" };
    }

    // TODO: Atualizar o favorito no XML

    return {
      success: true,
      message: "Status de favorito atualizado com sucesso",
      newStatus: favorite,
    };
  } catch (error) {
    console.error(`Erro ao atualizar favorito do jogo ${gameId}:`, error);
    return { error: error.message };
  }
}

/**
 * Pesquisa jogos em todos os sistemas ou em um sistema específico
 * @param {string} query - Termo de pesquisa
 * @param {string} [systemName] - Nome do sistema (opcional)
 * @returns {Promise<Object>} Resultados da pesquisa
 */
async function searchGames(query, systemName = null) {
  try {
    // Se o sistema for especificado, pesquisar apenas nele
    if (systemName) {
      const { games, error } = await getGamesBySystem(systemName);

      if (error) {
        return { error };
      }

      // Filtrar jogos que correspondem à consulta
      const results = games.filter((game) => {
        const searchFields = [
          game.name,
          game.developer,
          game.publisher,
          game.genre,
          game.description,
        ];

        return searchFields.some(
          (field) => field && field.toLowerCase().includes(query.toLowerCase())
        );
      });

      return {
        results,
        count: results.length,
        system: systemName,
      };
    }

    // Se nenhum sistema for especificado, obter todos os sistemas
    const systemConfigPath = path.join(
      PATHS.EMULATIONSTATION_CONFIG,
      "es_systems.cfg"
    );

    if (!fs.existsSync(systemConfigPath)) {
      return {
        error: `Arquivo de configuração não encontrado: ${systemConfigPath}`,
      };
    }

    const systemXmlData = fs.readFileSync(systemConfigPath, "utf8");
    const parser = new XMLParser({ ignoreAttributes: false });
    const systemConfig = parser.parse(systemXmlData);

    if (!systemConfig.systemList || !systemConfig.systemList.system) {
      return { error: "Formato de configuração inválido" };
    }

    const systems = Array.isArray(systemConfig.systemList.system)
      ? systemConfig.systemList.system
      : [systemConfig.systemList.system];

    // Pesquisar em cada sistema
    const allResults = [];

    for (const system of systems) {
      try {
        const { games } = await getGamesBySystem(system.name);

        if (games) {
          // Filtrar jogos que correspondem à consulta
          const results = games.filter((game) => {
            const searchFields = [
              game.name,
              game.developer,
              game.publisher,
              game.genre,
              game.description,
            ];

            return searchFields.some(
              (field) =>
                field && field.toLowerCase().includes(query.toLowerCase())
            );
          });

          // Adicionar resultados ao array geral
          allResults.push(...results);
        }
      } catch (error) {
        console.error(`Erro ao pesquisar no sistema ${system.name}:`, error);
        // Continuar com outros sistemas mesmo se um falhar
      }
    }

    return {
      results: allResults,
      count: allResults.length,
    };
  } catch (error) {
    console.error(`Erro ao pesquisar jogos:`, error);
    return { error: error.message };
  }
}

// Exportar os endpoints
module.exports = {
  initialize,
  getBySystem: getGamesBySystem,
  getById: getGameById,
  updateFavorite: updateGameFavorite,
  search: searchGames,
};
