/**
 * Cliente JavaScript para a API do EmulationStation
 * Esta biblioteca deve ser incluída nos temas web para acessar as funcionalidades do EmulationStation
 */
const ESAPI = (function () {
  // URL base da API
  const API_BASE = "/api";

  // Cache local
  const cache = {
    platforms: null,
    currentPlatform: null,
    games: {},
    gameDetails: {},
    settings: null,
    themes: null,
    currentTheme: null,
  };

  // Callbacks
  const callbacks = {
    onReady: [],
    onPlatformSelect: [],
    onGameSelect: [],
    onGameLaunch: [],
    onSettingsChange: [],
    onThemeChange: [],
  };

  /**
   * Inicializa a API
   * @returns {Promise} Promessa que resolve quando a API estiver pronta
   */
  async function init() {
    console.log("Inicializando ESAPI...");

    try {
      // Carregar configurações e plataformas em paralelo
      const [settings, platforms, currentTheme] = await Promise.all([
        fetchSettings(),
        fetchPlatforms(),
        fetchCurrentTheme(),
      ]);

      // Armazenar no cache
      cache.settings = settings;
      cache.platforms = platforms;
      cache.currentTheme = currentTheme;

      // Notificar que está pronto
      for (const callback of callbacks.onReady) {
        callback();
      }

      return true;
    } catch (error) {
      console.error("Erro ao inicializar ESAPI:", error);
      return false;
    }
  }

  /**
   * Registra um callback para quando a API estiver pronta
   * @param {Function} callback - Função a ser chamada
   */
  function onReady(callback) {
    if (typeof callback === "function") {
      callbacks.onReady.push(callback);
    }
  }

  /**
   * Registra um callback para quando uma plataforma for selecionada
   * @param {Function} callback - Função a ser chamada com o ID da plataforma
   */
  function onPlatformSelect(callback) {
    if (typeof callback === "function") {
      callbacks.onPlatformSelect.push(callback);
    }
  }

  /**
   * Registra um callback para quando um jogo for selecionado
   * @param {Function} callback - Função a ser chamada com o ID do jogo
   */
  function onGameSelect(callback) {
    if (typeof callback === "function") {
      callbacks.onGameSelect.push(callback);
    }
  }

  /**
   * Registra um callback para quando um jogo for lançado
   * @param {Function} callback - Função a ser chamada com o ID do jogo
   */
  function onGameLaunch(callback) {
    if (typeof callback === "function") {
      callbacks.onGameLaunch.push(callback);
    }
  }

  /**
   * Registra um callback para quando as configurações forem alteradas
   * @param {Function} callback - Função a ser chamada com as novas configurações
   */
  function onSettingsChange(callback) {
    if (typeof callback === "function") {
      callbacks.onSettingsChange.push(callback);
    }
  }

  /**
   * Registra um callback para quando o tema for alterado
   * @param {Function} callback - Função a ser chamada com o novo tema
   */
  function onThemeChange(callback) {
    if (typeof callback === "function") {
      callbacks.onThemeChange.push(callback);
    }
  }

  /**
   * Busca as plataformas disponíveis
   * @param {boolean} forceRefresh - Força atualização do cache
   * @returns {Promise<Array>} Promessa que resolve com a lista de plataformas
   */
  async function fetchPlatforms(forceRefresh = false) {
    console.log("fetchPlatforms chamado, forceRefresh:", forceRefresh);

    if (cache.platforms && !forceRefresh) {
      console.log("Usando plataformas em cache:", cache.platforms);
      return cache.platforms;
    }

    try {
      console.log(
        "Fazendo requisição para",
        `${API_BASE}/platforms?refresh=${forceRefresh}`
      );
      const response = await fetch(
        `${API_BASE}/platforms?refresh=${forceRefresh}`
      );
      console.log("Status da resposta:", response.status);
      const data = await response.json();
      console.log("Dados recebidos:", data);

      if (data.success) {
        cache.platforms = data.data;
        console.log("Plataformas armazenadas em cache:", cache.platforms);
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter plataformas");
    } catch (error) {
      console.error("Erro ao buscar plataformas:", error);
      throw error;
    }
  }

  /**
   * Obtém as plataformas disponíveis
   * @returns {Array} Lista de plataformas
   */
  function getPlatforms() {
    return cache.platforms || [];
  }

  /**
   * Busca os jogos de uma plataforma
   * @param {string} platformId - ID da plataforma
   * @param {boolean} forceRefresh - Força atualização do cache
   * @returns {Promise<Array>} Promessa que resolve com a lista de jogos
   */
  async function fetchGames(platformId, forceRefresh = false) {
    console.log(
      "fetchGames chamado para plataforma:",
      platformId,
      "forceRefresh:",
      forceRefresh
    );

    if (cache.games[platformId] && !forceRefresh) {
      console.log("Usando jogos em cache para plataforma:", platformId);
      return cache.games[platformId];
    }

    try {
      const url = `${API_BASE}/platforms/${platformId}/games?refresh=${forceRefresh}`;
      console.log("Fazendo requisição para:", url);

      const response = await fetch(url);
      console.log("Status da resposta:", response.status);

      const data = await response.json();
      console.log("Dados recebidos:", data);

      if (data.success) {
        cache.games[platformId] = data.data;
        console.log(
          `${data.data.length} jogos armazenados em cache para plataforma ${platformId}`
        );
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter jogos");
    } catch (error) {
      console.error(
        `Erro ao buscar jogos para plataforma ${platformId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtém os jogos de uma plataforma
   * @param {string} platformId - ID da plataforma
   * @returns {Array} Lista de jogos
   */
  function getGames(platformId) {
    return cache.games[platformId] || [];
  }

  /**
   * Busca os detalhes de um jogo
   * @param {string} gameId - ID do jogo
   * @param {boolean} forceRefresh - Força atualização do cache
   * @returns {Promise<Object>} Promessa que resolve com os detalhes do jogo
   */
  async function fetchGameDetails(gameId, forceRefresh = false) {
    if (cache.gameDetails[gameId] && !forceRefresh) {
      return cache.gameDetails[gameId];
    }

    try {
      const response = await fetch(
        `${API_BASE}/games/${gameId}?refresh=${forceRefresh}`
      );
      const data = await response.json();

      if (data.success) {
        cache.gameDetails[gameId] = data.data;
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter detalhes do jogo");
    } catch (error) {
      console.error(`Erro ao buscar detalhes do jogo ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém os detalhes de um jogo
   * @param {string} gameId - ID do jogo
   * @returns {Object} Detalhes do jogo
   */
  function getGameDetails(gameId) {
    return cache.gameDetails[gameId] || null;
  }

  /**
   * Busca as configurações
   * @param {boolean} forceRefresh - Força atualização do cache
   * @returns {Promise<Object>} Promessa que resolve com as configurações
   */
  async function fetchSettings(forceRefresh = false) {
    if (cache.settings && !forceRefresh) {
      return cache.settings;
    }

    try {
      const response = await fetch(
        `${API_BASE}/config/settings?refresh=${forceRefresh}`
      );
      const data = await response.json();

      if (data.success) {
        cache.settings = data.data;
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter configurações");
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      throw error;
    }
  }

  /**
   * Obtém as configurações
   * @returns {Object} Configurações
   */
  function getSettings() {
    return cache.settings || {};
  }

  /**
   * Atualiza uma configuração
   * @param {string} key - Chave da configuração
   * @param {string} value - Novo valor
   * @returns {Promise<boolean>} Promessa que resolve com true se atualizado com sucesso
   */
  async function updateSetting(key, value) {
    try {
      const response = await fetch(`${API_BASE}/config/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value }),
      });

      const data = await response.json();

      if (data.success) {
        // Atualizar cache
        if (cache.settings) {
          if (!cache.settings.general) {
            cache.settings.general = {};
          }

          cache.settings.general[key] = value;
        }

        // Notificar sobre alteração
        for (const callback of callbacks.onSettingsChange) {
          callback(cache.settings);
        }

        return true;
      }

      throw new Error(data.message || "Erro ao atualizar configuração");
    } catch (error) {
      console.error(`Erro ao atualizar configuração ${key}:`, error);
      throw error;
    }
  }

  /**
   * Busca os temas disponíveis
   * @param {boolean} forceRefresh - Força atualização do cache
   * @returns {Promise<Array>} Promessa que resolve com a lista de temas
   */
  async function fetchThemes(forceRefresh = false) {
    if (cache.themes && !forceRefresh) {
      return cache.themes;
    }

    try {
      const response = await fetch(
        `${API_BASE}/config/themes?refresh=${forceRefresh}`
      );
      const data = await response.json();

      if (data.success) {
        cache.themes = data.data;
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter temas");
    } catch (error) {
      console.error("Erro ao buscar temas:", error);
      throw error;
    }
  }

  /**
   * Obtém os temas disponíveis
   * @returns {Array} Lista de temas
   */
  function getThemes() {
    return cache.themes || [];
  }

  /**
   * Busca o tema atual
   * @param {boolean} forceRefresh - Força atualização do cache
   * @returns {Promise<Object>} Promessa que resolve com o tema atual
   */
  async function fetchCurrentTheme(forceRefresh = false) {
    if (cache.currentTheme && !forceRefresh) {
      return cache.currentTheme;
    }

    try {
      const response = await fetch(
        `${API_BASE}/config/themes/current?refresh=${forceRefresh}`
      );
      const data = await response.json();

      if (data.success) {
        cache.currentTheme = data.data;
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter tema atual");
    } catch (error) {
      console.error("Erro ao buscar tema atual:", error);
      throw error;
    }
  }

  /**
   * Obtém o tema atual
   * @returns {Object} Tema atual
   */
  function getCurrentTheme() {
    return cache.currentTheme || null;
  }

  /**
   * Define o tema atual
   * @param {string} themeId - ID do tema
   * @returns {Promise<boolean>} Promessa que resolve com true se definido com sucesso
   */
  async function setCurrentTheme(themeId) {
    try {
      const response = await fetch(`${API_BASE}/config/themes/current`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themeId }),
      });

      const data = await response.json();

      if (data.success) {
        // Atualizar cache
        cache.currentTheme = data.data;

        // Notificar sobre alteração
        for (const callback of callbacks.onThemeChange) {
          callback(cache.currentTheme);
        }

        return true;
      }

      throw new Error(data.message || "Erro ao definir tema atual");
    } catch (error) {
      console.error(`Erro ao definir tema atual ${themeId}:`, error);
      throw error;
    }
  }

  /**
   * Seleciona uma plataforma
   * @param {string} platformId - ID da plataforma
   * @returns {Promise<Array>} Promessa que resolve com a lista de jogos da plataforma
   */
  async function selectPlatform(platformId) {
    console.log("selectPlatform chamado para plataforma:", platformId);

    try {
      // Buscar jogos da plataforma
      console.log("Buscando jogos para plataforma:", platformId);
      const games = await fetchGames(platformId);
      console.log(
        `${games.length} jogos encontrados para plataforma ${platformId}`
      );

      // Atualizar plataforma atual
      cache.currentPlatform = platformId;
      console.log("Plataforma atual atualizada para:", platformId);

      // Notificar sobre seleção
      console.log("Chamando callbacks de seleção de plataforma");
      for (const callback of callbacks.onPlatformSelect) {
        console.log("Executando callback de seleção de plataforma");
        callback(platformId);
      }

      return games;
    } catch (error) {
      console.error(`Erro ao selecionar plataforma ${platformId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém a plataforma atual
   * @returns {string} ID da plataforma atual
   */
  function getCurrentPlatform() {
    return cache.currentPlatform;
  }

  /**
   * Obtém a plataforma por ID
   * @param {string} platformId - ID da plataforma
   * @returns {Object} Plataforma ou null se não encontrada
   */
  function getPlatform(platformId) {
    if (!cache.platforms) {
      return null;
    }

    return cache.platforms.find((p) => p.id === platformId) || null;
  }

  /**
   * Seleciona um jogo
   * @param {string} gameId - ID do jogo
   * @returns {Promise<Object>} Promessa que resolve com os detalhes do jogo
   */
  async function selectGame(gameId) {
    try {
      // Buscar detalhes do jogo
      const gameDetails = await fetchGameDetails(gameId);

      // Notificar sobre seleção
      for (const callback of callbacks.onGameSelect) {
        callback(gameId);
      }

      return gameDetails;
    } catch (error) {
      console.error(`Erro ao selecionar jogo ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Lança um jogo
   * @param {string} gameId - ID do jogo
   * @param {Object} options - Opções de lançamento
   * @param {string} options.emulator - Emulador a ser usado
   * @param {string} options.core - Core a ser usado
   * @returns {Promise<boolean>} Promessa que resolve com true se lançado com sucesso
   */
  async function launchGame(gameId, options = {}) {
    console.log("launchGame chamado para jogo:", gameId);
    try {
      // Notificar sobre lançamento
      for (const callback of callbacks.onGameLaunch) {
        callback(gameId);
      }

      // Lançar o jogo
      const response = await fetch(`${API_BASE}/games/${gameId}/launch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(options),
      });

      const data = await response.json();

      if (data.success) {
        return true;
      }

      throw new Error(data.message || "Erro ao lançar jogo");
    } catch (error) {
      console.error(`Erro ao lançar jogo ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Limpa o cache local
   */
  function clearCache() {
    cache.platforms = null;
    cache.currentPlatform = null;
    cache.games = {};
    cache.gameDetails = {};
    cache.settings = null;
    cache.themes = null;
    cache.currentTheme = null;
  }

  // API pública
  return {
    init,
    onReady,
    onPlatformSelect,
    onGameSelect,
    onGameLaunch,
    onSettingsChange,
    onThemeChange,
    getPlatforms,
    getGames,
    getGameDetails,
    getSettings,
    getThemes,
    getCurrentTheme,
    getCurrentPlatform,
    getPlatform,
    selectPlatform,
    selectGame,
    launchGame,
    updateSetting,
    setCurrentTheme,
    clearCache,
  };
})();

// Exportar para CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = ESAPI;
}
