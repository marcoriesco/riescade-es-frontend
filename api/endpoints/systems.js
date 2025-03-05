/**
 * Endpoints para manipulação de sistemas
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
 * Obtém a lista de todos os sistemas configurados no EmulationStation
 * @returns {Promise<Array>} Lista de sistemas
 */
async function getAllSystems() {
  try {
    const configPath = path.join(
      PATHS.EMULATIONSTATION_CONFIG,
      "es_systems.cfg"
    );

    if (!fs.existsSync(configPath)) {
      return { error: `Arquivo de configuração não encontrado: ${configPath}` };
    }

    const xmlData = fs.readFileSync(configPath, "utf8");
    const parser = new XMLParser({ ignoreAttributes: false });
    const result = parser.parse(xmlData);

    if (!result.systemList || !result.systemList.system) {
      return { error: "Formato de configuração inválido" };
    }

    // Normalizar para sempre retornar um array
    const systems = Array.isArray(result.systemList.system)
      ? result.systemList.system
      : [result.systemList.system];

    // Retornar sistemas com informações adicionais
    const enhancedSystems = systems.map((system) => {
      const romPath = system.path;
      const fullRomPath = path.isAbsolute(romPath)
        ? romPath
        : path.join(PATHS.ROMS, system.name);

      // Contar jogos se o diretório existir
      let gameCount = 0;
      try {
        if (fs.existsSync(fullRomPath)) {
          const files = fs.readdirSync(fullRomPath);
          // Filtrar para contar apenas arquivos, não diretórios
          gameCount = files.filter((file) => {
            const filePath = path.join(fullRomPath, file);
            return fs.statSync(filePath).isFile();
          }).length;
        }
      } catch (error) {
        console.error(`Erro ao contar jogos para ${system.name}:`, error);
      }

      return {
        ...system,
        fullPath: fullRomPath,
        gameCount,
        themePath: path.join(
          PATHS.EMULATIONSTATION_CONFIG,
          "themes",
          "default",
          system.theme
        ),
        isAvailable: fs.existsSync(fullRomPath),
      };
    });

    return { systems: enhancedSystems };
  } catch (error) {
    console.error("Erro ao ler sistemas:", error);
    return { error: error.message };
  }
}

/**
 * Obtém detalhes de um sistema específico pelo nome
 * @param {string} systemName - Nome do sistema a ser obtido
 * @returns {Promise<Object>} Detalhes do sistema
 */
async function getSystemByName(systemName) {
  try {
    const { systems, error } = await getAllSystems();

    if (error) {
      return { error };
    }

    const system = systems.find((s) => s.name === systemName);

    if (!system) {
      return { error: `Sistema não encontrado: ${systemName}` };
    }

    return { system };
  } catch (error) {
    console.error(`Erro ao obter sistema ${systemName}:`, error);
    return { error: error.message };
  }
}

/**
 * Obtém o caminho completo para o diretório de ROMs de um sistema
 * @param {string} systemName - Nome do sistema
 * @returns {Promise<Object>} Objeto com o caminho e status
 */
async function getSystemRomPath(systemName) {
  try {
    const { system, error } = await getSystemByName(systemName);

    if (error) {
      return { error };
    }

    return {
      path: system.fullPath,
      exists: fs.existsSync(system.fullPath),
    };
  } catch (error) {
    console.error(`Erro ao obter caminho de ROMs para ${systemName}:`, error);
    return { error: error.message };
  }
}

/**
 * Obtém a configuração de launch para um sistema
 * @param {string} systemName - Nome do sistema
 * @returns {Promise<Object>} Configuração de launch do sistema
 */
async function getSystemLaunchConfig(systemName) {
  try {
    const { system, error } = await getSystemByName(systemName);

    if (error) {
      return { error };
    }

    // Extrair a configuração de launch
    const launchConfig = {
      command: system.command,
      platform: system.platform,
      theme: system.theme,
      extensions: system.extension ? system.extension.split(" ") : [],
    };

    // Adicionar emuladores se disponíveis
    if (system.emulators && system.emulators.emulator) {
      const emulators = Array.isArray(system.emulators.emulator)
        ? system.emulators.emulator
        : [system.emulators.emulator];

      launchConfig.emulators = emulators;
    }

    return { launchConfig };
  } catch (error) {
    console.error(
      `Erro ao obter configuração de launch para ${systemName}:`,
      error
    );
    return { error: error.message };
  }
}

// Exportar os endpoints
module.exports = {
  initialize,
  getAll: getAllSystems,
  getByName: getSystemByName,
  getRomPath: getSystemRomPath,
  getLaunchConfig: getSystemLaunchConfig,
};
