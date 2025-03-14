/**
 * Cliente JavaScript para a API do RIESCADE Theme Engine
 * Esta biblioteca deve ser incluída nos temas web para acessar as funcionalidades do sistema
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
   * @param {Function} callback - Função a ser chamada quando as configurações forem alteradas
   */
  function onSettingsChange(callback) {
    if (typeof callback === "function") {
      callbacks.onSettingsChange.push(callback);
    }
  }

  /**
   * Notifica os callbacks de alteração de configurações
   */
  function notifySettingsChange() {
    callbacks.onSettingsChange.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error(
          "Erro ao executar callback de alteração de configurações:",
          error
        );
      }
    });
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
      const data = await response.json();
      console.log("Dados recebidos:", data);

      if (data.success) {
        cache.platforms = data.platforms;
        console.log("Plataformas armazenadas em cache:", cache.platforms);
        return data.platforms;
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
        `${API_BASE}/frontend/settings/theme?refresh=${forceRefresh}`
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
   * @param {*} value - Novo valor
   * @returns {Promise<boolean>} Promessa que resolve com o resultado da operação
   */
  async function updateSetting(key, value) {
    try {
      const response = await fetch(`${API_BASE}/frontend/settings/theme`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await response.json();

      if (data.success) {
        // Atualizar cache
        if (!cache.settings) {
          cache.settings = {};
        }
        cache.settings[key] = value;

        // Notificar alteração
        notifySettingsChange();

        return true;
      }

      throw new Error(data.message || "Erro ao atualizar configuração");
    } catch (error) {
      console.error(`Erro ao atualizar configuração ${key}:`, error);
      return false;
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
        `${API_BASE}/frontend/themes?refresh=${forceRefresh}`
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
        `${API_BASE}/frontend/themes/current?refresh=${forceRefresh}`
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
   * @returns {Promise<boolean>} Promessa que resolve com o resultado da operação
   */
  async function setCurrentTheme(themeId) {
    try {
      const response = await fetch(`${API_BASE}/frontend/themes/current`, {
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

        // Notificar alteração
        notifyCallbacks("onThemeChange", data.data);

        return true;
      }

      throw new Error(data.message || "Erro ao definir tema atual");
    } catch (error) {
      console.error("Erro ao definir tema atual:", error);
      return false;
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
      // Verificar se o ID do jogo é válido
      if (!gameId) {
        throw new Error("ID do jogo é obrigatório");
      }

      // Se nenhuma opção for fornecida, tentar extrair emulador e core da plataforma atual
      if (!options.emulator && !options.core) {
        // Extrair o ID da plataforma do ID do jogo (formato: sistema-índice)
        const platformId = gameId.split("-")[0];

        if (!platformId) {
          throw new Error(
            "Não foi possível determinar a plataforma a partir do ID do jogo"
          );
        }

        const platform = getPlatform(platformId);
        console.log(`Detectada plataforma ${platformId} para o jogo ${gameId}`);

        if (platform && platform.emulators && platform.emulators.length > 0) {
          // Usar o primeiro emulador disponível
          options.emulator = platform.emulators[0].name;
          console.log(`Usando emulador ${options.emulator} da plataforma`);

          // Verificar se há cores disponíveis
          if (
            platform.emulators[0].cores &&
            platform.emulators[0].cores.length > 0
          ) {
            // Procurar por um core padrão
            const defaultCore = platform.emulators[0].cores.find(
              (core) => core.default === true
            );

            if (defaultCore) {
              options.core = defaultCore.name;
              console.log(`Usando core padrão ${options.core}`);
            } else {
              // Se não houver core padrão, usar o primeiro
              options.core = platform.emulators[0].cores[0].name;
              console.log(`Usando primeiro core disponível ${options.core}`);
            }
          }
        }
      }

      console.log(`Lançando jogo ${gameId} com opções:`, options);

      // Notificar sobre lançamento
      for (const callback of callbacks.onGameLaunch) {
        callback(gameId);
      }

      // Iniciar um mecanismo para verificar o status do jogo periodicamente
      let checkStatusInterval;

      // Função para verificar se o jogo ainda está em execução
      const checkGameStatus = async () => {
        try {
          const statusResponse = await fetch(
            `${API_BASE}/games/${gameId}/status`
          );
          const statusData = await statusResponse.json();

          console.log(`Status do jogo ${gameId}:`, statusData);

          if (statusData.success && statusData.data) {
            // Se o jogo não está mais em execução
            if (!statusData.data.running) {
              console.log(`Jogo ${gameId} encerrado, clearInterval`);
              clearInterval(checkStatusInterval);

              // Aqui poderíamos disparar um evento de jogo encerrado
              // Isso permitiria que a UI responda apropriadamente
            }
          }
        } catch (error) {
          console.error(`Erro ao verificar status do jogo ${gameId}:`, error);
        }
      };

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
        console.log(`Jogo ${gameId} lançado com sucesso:`, data);

        // Iniciar verificação periódica do status do jogo
        checkStatusInterval = setInterval(checkGameStatus, 2000);

        // Verificar o status inicial após 500ms
        setTimeout(checkGameStatus, 500);

        return true;
      }

      throw new Error(data.message || "Erro ao lançar jogo");
    } catch (error) {
      console.error(`Erro ao lançar jogo ${gameId}:`, error);

      // Notificar sobre erro de lançamento
      // Você pode adicionar um callback de erro aqui se necessário

      throw error;
    }
  }

  /**
   * Limpa o cache local
   * @param {string} [cacheKey] - Chave específica do cache para limpar (opcional)
   */
  function clearCache(cacheKey) {
    console.log(
      `Limpando cache${cacheKey ? ` para ${cacheKey}` : " completo"}`
    );

    if (cacheKey) {
      // Limpar apenas a chave específica
      switch (cacheKey) {
        case "platforms":
          cache.platforms = null;
          break;
        case "currentPlatform":
          cache.currentPlatform = null;
          break;
        case "games":
          cache.games = {};
          break;
        case "gameDetails":
          cache.gameDetails = {};
          break;
        case "settings":
          cache.settings = null;
          break;
        case "themes":
          cache.themes = null;
          break;
        case "currentTheme":
          cache.currentTheme = null;
          break;
        default:
          console.warn(`Chave de cache desconhecida: ${cacheKey}`);
      }
    } else {
      // Limpar todo o cache
      cache.platforms = null;
      cache.currentPlatform = null;
      cache.games = {};
      cache.gameDetails = {};
      cache.settings = null;
      cache.themes = null;
      cache.currentTheme = null;
    }
  }

  /**
   * Obtém as configurações do tema atual
   * @param {boolean} [forceRefresh=false] - Força a atualização do cache
   * @returns {Promise<Object>} Promessa que resolve com as configurações do tema
   */
  async function getThemeSettings(forceRefresh = false) {
    try {
      // Se já temos o tema atual em cache e não estamos forçando a atualização, usar suas configurações
      if (cache.currentTheme && cache.currentTheme.settings && !forceRefresh) {
        console.log(
          "Usando configurações do tema em cache:",
          cache.currentTheme.settings
        );

        // Extrair as configurações do tema
        const themeSettings = {};

        // Se o tema tem configurações definidas
        if (
          cache.currentTheme.settings &&
          Array.isArray(cache.currentTheme.settings)
        ) {
          // Para cada configuração, obter o valor atual ou o valor padrão
          cache.currentTheme.settings.forEach((setting) => {
            themeSettings[setting.id] =
              setting.value !== undefined ? setting.value : setting.default;
          });
        }

        return themeSettings;
      }

      // Caso contrário, buscar o tema atual
      console.log("Buscando configurações atualizadas do tema do servidor...");
      const currentTheme = await fetchCurrentTheme(true); // Forçar atualização

      // Extrair as configurações do tema
      const themeSettings = {};

      // Se o tema tem configurações definidas
      if (currentTheme.settings && Array.isArray(currentTheme.settings)) {
        // Para cada configuração, obter o valor atual ou o valor padrão
        currentTheme.settings.forEach((setting) => {
          themeSettings[setting.id] =
            setting.value !== undefined ? setting.value : setting.default;
        });
      }

      console.log("Configurações do tema obtidas do servidor:", themeSettings);
      return themeSettings;
    } catch (error) {
      console.error("Erro ao obter configurações do tema:", error);
      return {};
    }
  }

  // API pública
  return {
    init,
    onReady,
    getPlatforms,
    getPlatform,
    getCurrentPlatform,
    getGames,
    getGameDetails,
    getSettings,
    getThemes,
    getCurrentTheme,
    onPlatformSelect,
    onGameSelect,
    onGameLaunch,
    onSettingsChange,
    onThemeChange,
    selectPlatform,
    selectGame,
    launchGame,
    updateSetting,
    setCurrentTheme,
    clearCache,
    getThemeSettings,
    notifySettingsChange,
  };
})();

// Exportar para CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = ESAPI;
}
