/**
 * Serviço para gerenciar configurações do EmulationStation
 */
const fs = require("fs-extra");
const path = require("path");
const NodeCache = require("node-cache");
const xmlParser = require("../utils/xmlParser");
const pathFinder = require("../utils/pathFinder");
const fileScanner = require("../utils/fileScanner");

// Cache para armazenar configurações em memória (evitar leituras frequentes do disco)
const configCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Chaves de cache
const CACHE_PATHS = "es_paths";
const CACHE_SETTINGS = "es_settings";
const CACHE_SYSTEMS = "es_systems";
const CACHE_THEMES = "es_themes";
const CACHE_BIOS = "es_bios";

/**
 * Obtém os caminhos do EmulationStation
 * @param {boolean} forceRefresh - Forçar atualização do cache
 * @returns {Object} Objeto com os caminhos
 */
function getPaths(forceRefresh = false) {
  // Verificar cache
  if (!forceRefresh) {
    const cachedPaths = configCache.get(CACHE_PATHS);
    if (cachedPaths) {
      return cachedPaths;
    }
  }

  // Encontrar caminhos
  const paths = pathFinder.findEmulationStationPaths();

  // Armazenar no cache
  configCache.set(CACHE_PATHS, paths);

  return paths;
}

/**
 * Obtém as configurações do EmulationStation
 * @param {boolean} forceRefresh - Forçar atualização do cache
 * @returns {Object} Objeto com as configurações
 */
function getSettings(forceRefresh = false) {
  // Verificar cache
  if (!forceRefresh) {
    const cachedSettings = configCache.get(CACHE_SETTINGS);
    if (cachedSettings) {
      return cachedSettings;
    }
  }

  // Obter caminhos
  const paths = getPaths();

  // Verificar se temos o diretório de configuração
  if (!paths.configDir) {
    return null;
  }

  // Escanear configurações
  const settings = fileScanner.scanSettings(paths.configDir);

  // Armazenar no cache
  configCache.set(CACHE_SETTINGS, settings);

  return settings;
}

/**
 * Atualiza uma configuração específica
 * @param {string} key - Chave da configuração
 * @param {string} value - Novo valor
 * @returns {boolean} true se atualizado com sucesso
 */
function updateSetting(key, value) {
  // Obter caminhos
  const paths = getPaths();

  // Verificar se temos o diretório de configuração
  if (!paths.configDir) {
    return false;
  }

  // Caminho do arquivo de configurações
  const settingsFile = path.join(paths.configDir, "es_settings.cfg");

  try {
    // Ler arquivo de configurações existente
    let settings;
    if (fs.existsSync(settingsFile)) {
      settings = xmlParser.parseXmlFile(settingsFile);
    } else {
      // Criar novo arquivo de configurações
      settings = {
        config: {
          string: [],
        },
      };
    }

    // Garantir que a estrutura está correta
    if (!settings.config) {
      settings.config = {};
    }

    if (!settings.config.string) {
      settings.config.string = [];
    }

    // Converter para array se for um único item
    if (!Array.isArray(settings.config.string)) {
      settings.config.string = [settings.config.string];
    }

    // Procurar a configuração existente
    const existingIndex = settings.config.string.findIndex(
      (s) => s["@_name"] === key
    );

    if (existingIndex >= 0) {
      // Atualizar configuração existente
      settings.config.string[existingIndex]["@_value"] = value;
    } else {
      // Adicionar nova configuração
      settings.config.string.push({
        "@_name": key,
        "@_value": value,
      });
    }

    // Salvar arquivo atualizado
    const success = xmlParser.saveXmlFile(settingsFile, settings);

    if (success) {
      // Limpar cache
      configCache.del(CACHE_SETTINGS);

      // Reconstruir cache
      getSettings(true);

      return true;
    }

    return false;
  } catch (err) {
    console.error(`Erro ao atualizar configuração ${key}:`, err);
    return false;
  }
}

/**
 * Obtém os sistemas configurados
 * @param {boolean} forceRefresh - Forçar atualização do cache
 * @returns {Array} Lista de sistemas
 */
function getSystems(forceRefresh = false) {
  // Verificar cache
  if (!forceRefresh) {
    const cachedSystems = configCache.get(CACHE_SYSTEMS);
    if (cachedSystems) {
      return cachedSystems;
    }
  }

  // Obter caminhos
  const paths = getPaths();

  // Verificar se temos o diretório de configuração
  if (!paths.configDir) {
    return [];
  }

  // Escanear sistemas
  const systems = fileScanner.scanSystems(paths.configDir);

  // Armazenar no cache
  configCache.set(CACHE_SYSTEMS, systems);

  return systems;
}

/**
 * Obtém os temas disponíveis
 * @param {boolean} forceRefresh - Forçar atualização do cache
 * @returns {Array} Lista de temas
 */
function getThemes(forceRefresh = false) {
  // Verificar cache
  if (!forceRefresh) {
    const cachedThemes = configCache.get(CACHE_THEMES);
    if (cachedThemes) {
      return cachedThemes;
    }
  }

  // Obter caminhos
  const paths = getPaths();

  // Verificar se temos o diretório de temas
  if (!paths.themesDir) {
    return [];
  }

  // Escanear temas
  const themes = fileScanner.scanThemes(paths.themesDir);

  // Armazenar no cache
  configCache.set(CACHE_THEMES, themes);

  return themes;
}

/**
 * Obtém os arquivos BIOS disponíveis
 * @param {boolean} forceRefresh - Forçar atualização do cache
 * @returns {Array} Lista de arquivos BIOS
 */
function getBios(forceRefresh = false) {
  // Verificar cache
  if (!forceRefresh) {
    const cachedBios = configCache.get(CACHE_BIOS);
    if (cachedBios) {
      return cachedBios;
    }
  }

  // Obter caminhos
  const paths = getPaths();

  // Verificar se temos o diretório de BIOS
  if (!paths.biosDir) {
    return [];
  }

  // Escanear BIOS
  const bios = fileScanner.scanBios(paths.biosDir);

  // Armazenar no cache
  configCache.set(CACHE_BIOS, bios);

  return bios;
}

/**
 * Obtém tema atual
 * @returns {Object} Tema atual
 */
function getCurrentTheme() {
  const settings = getSettings();

  if (!settings || !settings.general || !settings.general.ThemeSet) {
    return getDefaultTheme();
  }

  const themeName = settings.general.ThemeSet;
  const themes = getThemes();

  // Procurar o tema pelo nome
  const theme = themes.find((t) => t.id === themeName.toLowerCase());

  // Se não encontrar, retornar o tema padrão
  if (!theme) {
    return getDefaultTheme();
  }

  return theme;
}

/**
 * Obtém tema padrão
 * @returns {Object} Tema padrão
 */
function getDefaultTheme() {
  const themes = getThemes();

  // Procurar primeiro por um tema "default"
  const defaultTheme = themes.find((t) => t.id === "default");
  if (defaultTheme) {
    return defaultTheme;
  }

  // Ou retornar o primeiro tema disponível
  if (themes.length > 0) {
    return themes[0];
  }

  // Se não houver temas, retornar um objeto vazio
  return {
    id: "default",
    name: "Default",
    path: "",
    isWebTheme: false,
  };
}

/**
 * Verifica se um tema web está disponível
 * @param {string} themeId - ID do tema
 * @returns {boolean} true se o tema estiver disponível
 */
function isWebThemeAvailable(themeId) {
  const themes = getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  return theme && theme.isWebTheme;
}

/**
 * Obtém o caminho para um tema específico
 * @param {string} themeId - ID do tema
 * @returns {string} Caminho completo para o tema
 */
function getThemePath(themeId) {
  const paths = getPaths();

  if (!paths.themesDir) {
    return null;
  }

  return path.join(paths.themesDir, themeId);
}

/**
 * Adiciona um novo tema
 * @param {string} themeName - Nome do tema
 * @param {Object} themeFiles - Arquivos do tema
 * @returns {boolean} true se adicionado com sucesso
 */
function addTheme(themeName, themeFiles) {
  const paths = getPaths();

  if (!paths.themesDir) {
    return false;
  }

  // Criar pasta do tema
  const themeDir = path.join(paths.themesDir, themeName);

  try {
    // Criar diretório se não existir
    if (!fs.existsSync(themeDir)) {
      fs.mkdirSync(themeDir, { recursive: true });
    }

    // Copiar arquivos do tema
    for (const [fileName, fileContent] of Object.entries(themeFiles)) {
      const filePath = path.join(themeDir, fileName);

      // Garantir que o diretório pai exista
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Escrever arquivo
      fs.writeFileSync(filePath, fileContent);
    }

    // Limpar cache
    configCache.del(CACHE_THEMES);

    // Reconstruir cache
    getThemes(true);

    return true;
  } catch (err) {
    console.error(`Erro ao adicionar tema ${themeName}:`, err);
    return false;
  }
}

/**
 * Remove um tema
 * @param {string} themeId - ID do tema
 * @returns {boolean} true se removido com sucesso
 */
function removeTheme(themeId) {
  const themePath = getThemePath(themeId);

  if (!themePath || !fs.existsSync(themePath)) {
    return false;
  }

  try {
    // Remover diretório do tema
    fs.removeSync(themePath);

    // Limpar cache
    configCache.del(CACHE_THEMES);

    // Reconstruir cache
    getThemes(true);

    return true;
  } catch (err) {
    console.error(`Erro ao remover tema ${themeId}:`, err);
    return false;
  }
}

/**
 * Define o tema atual
 * @param {string} themeId - ID do tema
 * @returns {boolean} true se definido com sucesso
 */
function setCurrentTheme(themeId) {
  return updateSetting("ThemeSet", themeId);
}

/**
 * Limpa o cache
 */
function clearCache() {
  configCache.flushAll();
}

module.exports = {
  getPaths,
  getSettings,
  updateSetting,
  getSystems,
  getThemes,
  getBios,
  getCurrentTheme,
  getDefaultTheme,
  isWebThemeAvailable,
  getThemePath,
  addTheme,
  removeTheme,
  setCurrentTheme,
  clearCache,
};
