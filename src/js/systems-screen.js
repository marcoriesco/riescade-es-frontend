import { ConfigParser } from "./config-parser.js";

export class SystemsScreen {
  constructor(app) {
    this.app = app;
    this.configParser = new ConfigParser();
    this.container = document.querySelector(".systems-container");
    this.systemsLoaded = false;
    this.loadedSystems = [];

    // Verificar se a API está disponível
    if (!window.api) {
      // API não disponível. Verifique se o preload.js está configurado corretamente.
    }
  }

  async loadSystems(forceReload = false) {
    try {
      // Se já temos sistemas carregados e não está forçando recarregamento
      if (this.loadedSystems && this.loadedSystems.length > 0 && !forceReload) {
        console.log("Usando sistemas já carregados");
        await this.renderSystemsWithTheme(this.loadedSystems);
        return this.loadedSystems;
      }

      const themeManager = this.app.themeManager;
      const configParser = this.configParser;

      console.log("Carregando sistemas...");
      await this.showLoading();

      // Atualizar progresso
      this.updateLoadingProgress(20, "Lendo configuração de sistemas...");

      // Obter lista de sistemas
      let systems = await configParser.getSystems();

      this.updateLoadingProgress(40, "Processando sistemas...");

      // Adicionar campos para processamento e renderização
      systems = systems.map((system) => ({
        ...system,
        id: system.name,
        gameCount: -1, // Inicialmente -1, será carregado posteriormente
        logoPath: themeManager.getSystemLogoPath(system.name),
      }));

      console.log(`${systems.length} sistemas carregados`);
      this.loadedSystems = systems;

      this.updateLoadingProgress(60, "Carregando contagem de jogos...");

      // Pré-carregar as contagens de jogos para todos os sistemas em paralelo
      const loadPromises = systems.map((system) =>
        this.loadSystemGameCount(system.name)
      );
      await Promise.all(loadPromises);

      this.updateLoadingProgress(80, "Renderizando interface...");

      // Renderizar os sistemas após carregar as contagens de jogos
      await this.renderSystemsWithTheme(this.loadedSystems);

      this.updateLoadingProgress(100, "Concluído!");

      // Pequeno delay para mostrar o 100% antes de esconder o loading
      setTimeout(() => {
        this.hideLoading();
      }, 500);

      return systems;
    } catch (error) {
      console.error("Erro ao carregar sistemas:", error);
      this.hideLoading();
      this.showEmptyState(`Erro ao carregar sistemas: ${error.message}`);
      throw error;
    }
  }

  // Método para mostrar o indicador de loading
  async showLoading() {
    try {
      // Usar o ThemeManager para renderizar o template de loading
      const loadingHtml = await this.app.themeManager.renderLoadingTemplate({
        title: "Carregando Sistemas",
        message:
          "Por favor, aguarde enquanto carregamos os sistemas disponíveis.",
        systemLogo: null, // Sem logo específico de sistema, usará o logo padrão
        showProgress: true,
        progress: 0,
      });

      // Atualizar o container com o HTML renderizado
      this.container.innerHTML = loadingHtml;

      // Iniciar animação de progresso automático
      this._loadingProgressInterval = setInterval(() => {
        const progressBar = this.container.querySelector(
          ".loading-progress-bar"
        );
        const progressText = this.container.querySelector(
          ".loading-progress-text"
        );

        if (progressBar && progressText) {
          const currentWidth = parseInt(progressBar.style.width) || 0;
          if (currentWidth < 90) {
            const newWidth = currentWidth + 5;
            progressBar.style.width = `${newWidth}%`;
            progressText.textContent = `${newWidth}%`;
          } else {
            clearInterval(this._loadingProgressInterval);
          }
        }
      }, 300);
    } catch (error) {
      // Fallback em caso de erro no template
      this.container.innerHTML = `
        <div class="loading">
          <div class="loading-spinner"></div>
          <p>Carregando sistemas...</p>
        </div>
      `;
    }
  }

  // Método para esconder o indicador de loading
  hideLoading() {
    if (this._loadingProgressInterval) {
      clearInterval(this._loadingProgressInterval);
      this._loadingProgressInterval = null;
    }

    const loadingElement = this.container.querySelector(".loading");
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  // Método para renderizar usando o tema
  async renderSystemsWithTheme(systems) {
    try {
      // Verificar se systems é um array válido
      if (!systems || !Array.isArray(systems) || systems.length === 0) {
        // Lista de sistemas inválida ou vazia para renderização
        this.showEmptyState(
          "Erro ao renderizar sistemas: lista de sistemas inválida."
        );
        return;
      }

      // Calcular estatísticas totais
      let totalGames = 0;
      systems.forEach((system) => {
        if (system.gameCount) totalGames += system.gameCount;
      });

      // Preparar dados para o template
      const data = {
        systems: systems,
        stats: {
          totalGames: totalGames,
          totalSystems: systems.length,
        },
      };

      // Usar o ThemeManager para renderizar o template
      const renderedHtml = await this.app.themeManager.renderSystemsView(data);

      // Limpar o container antes de atualizar o HTML
      // This ensures we don't have duplicate elements
      this.container.innerHTML = "";

      // Atualizar o container com o HTML renderizado
      this.container.innerHTML = renderedHtml;

      // Adicionar event listeners para os cards de sistema
      this.addSystemCardEventListeners(systems);

      // Configurar a funcionalidade de pesquisa
      this.setupSearchFunctionality(systems);
    } catch (error) {
      // Erro ao renderizar sistemas com tema
      console.error("Erro ao renderizar sistemas com tema:", error);
      // Fallback para o método original em caso de erro
      this.renderSystems(systems);
    }
  }

  // Adicionar event listeners após renderizar com o template
  addSystemCardEventListeners(systems) {
    // Verificar se systems é um array válido
    if (!systems || !Array.isArray(systems)) {
      // Lista de sistemas inválida para adicionar eventos
      return;
    }

    // Selecionar todos os cards de sistema no container
    const systemCards = this.container.querySelectorAll(
      "[data-system-id], .system-card"
    );

    // Para cada card, adicionar o event listener
    systemCards.forEach((card) => {
      const systemId =
        card.getAttribute("data-system-id") ||
        card.getAttribute("data-system-name");
      const systemName = card.getAttribute("data-system-name") || systemId;

      if (!systemName) {
        // Card sem nome de sistema
        return;
      }

      const system = systems.find((s) => s.name === systemName);

      if (system) {
        card.addEventListener("click", () => {
          this.app.selectSystem(system);
        });
      } else {
        // Sistema não encontrado para o card
      }
    });
  }

  // Manter o método original como fallback
  renderSystems(systems) {
    this.container.innerHTML = "";
    systems.forEach((system) => {
      const systemCard = this.createSystemCard(system);
      this.container.appendChild(systemCard);
    });
  }

  createSystemCard(system) {
    const card = document.createElement("div");
    card.className = "system-card";
    card.setAttribute("data-system-id", system.name);
    card.setAttribute("data-system-name", system.name);

    // Logo do sistema
    const logo = document.createElement("div");
    logo.className = "system-logo";
    const img = document.createElement("img");
    // Usar o ThemeManager para obter o caminho do logo
    img.src = this.app.themeManager.getSystemLogoPath(system.name);
    img.alt = system.name;
    img.onerror = () => {
      // Fallback para texto se a imagem não carregar
      img.style.display = "none";
      logo.textContent = system.fullname || system.name;
    };
    logo.appendChild(img);

    // Nome do sistema
    const name = document.createElement("div");
    name.className = "system-name";
    name.textContent = system.fullname || system.name;

    // Informações do sistema
    const info = document.createElement("div");
    info.className = "system-info";
    info.textContent = system.platform || system.name;

    // Montar card
    card.appendChild(logo);
    card.appendChild(name);
    card.appendChild(info);

    // Adicionar event listener
    card.addEventListener("click", () => {
      this.app.selectSystem(system);
    });

    return card;
  }

  showEmptyState(message) {
    this.container.innerHTML = `
      <div class="empty-state">
        <p>${message}</p>
        <button id="config-systems">Configurar Sistemas</button>
      </div>
    `;
    document.getElementById("config-systems").addEventListener("click", () => {
      this.app.showScreen("settings");
      this.app.updateNavigation("settings");
    });
  }

  // Configurar a funcionalidade de pesquisa
  setupSearchFunctionality(systems) {
    const searchInput = document.getElementById("system-search");
    const clearButton = document.getElementById("clear-search");

    if (!searchInput || !clearButton) {
      return;
    }

    // Função para filtrar sistemas
    const filterSystems = (query) => {
      const normalizedQuery = query.toLowerCase().trim();
      const systemCards = document.querySelectorAll(
        ".system-card, [data-system-id]"
      );

      let visibleCount = 0;

      systemCards.forEach((card) => {
        // Obter o nome do sistema dos atributos data-
        const systemName =
          card.getAttribute("data-system-name") ||
          card.getAttribute("data-system-id") ||
          "";
        const systemFullName =
          card.querySelector(".system-name")?.textContent || "";
        const systemNameLower = systemName.toLowerCase();
        const systemFullNameLower = systemFullName.toLowerCase();

        // Verificar se o sistema corresponde à consulta
        if (
          normalizedQuery === "" ||
          systemNameLower.includes(normalizedQuery) ||
          systemFullNameLower.includes(normalizedQuery)
        ) {
          card.style.display = "";
          visibleCount++;
        } else {
          card.style.display = "none";
        }
      });

      // Atualizar a contagem de sistemas visíveis
      const totalSystemsElement = document.querySelector(".total-systems");
      if (totalSystemsElement) {
        totalSystemsElement.textContent = `${visibleCount} ${
          visibleCount === 1 ? "Sistema" : "Sistemas"
        }`;
      }

      // Mostrar/esconder o botão de limpar
      clearButton.style.display = normalizedQuery !== "" ? "block" : "none";
      clearButton.classList.toggle("visible", normalizedQuery !== "");
    };

    // Event listeners
    searchInput.addEventListener("input", (e) => {
      filterSystems(e.target.value);
    });

    clearButton.addEventListener("click", () => {
      searchInput.value = "";
      filterSystems("");
      searchInput.focus();
    });

    // Garantir visibilidade do botão de limpeza
    clearButton.style.display = "none";
  }

  // Método para carregar a contagem de jogos para um sistema específico
  async loadSystemGameCount(systemName) {
    try {
      // Encontrar o sistema nos sistemas carregados
      const systemIndex = this.loadedSystems.findIndex(
        (system) => system.name === systemName
      );

      if (systemIndex === -1) {
        return null; // Sistema não encontrado
      }

      // Se a contagem já foi carregada, retornar o sistema
      if (this.loadedSystems[systemIndex].gameCount >= 0) {
        return this.loadedSystems[systemIndex];
      }

      let gameCount = 0;

      // Tentar obter contagem via API direta
      if (window.api && typeof window.api.readGameList === "function") {
        const games = await window.api.readGameList(systemName);

        // Log de retorno de API
        console.log(`Resposta API readGameList (${systemName}):`, games);

        if (games && games.gameList && games.gameList.game) {
          // Fix for game count issue - properly handle empty arrays or non-existent games
          if (Array.isArray(games.gameList.game)) {
            gameCount = games.gameList.game.length;
          } else if (games.gameList.game) {
            // If there's a single game (object, not array), count as 1
            gameCount = 1;
          } else {
            // No games
            gameCount = 0;
          }
        }
      }
      // Se não conseguir, tentar via ConfigParser
      else {
        gameCount = await this.configParser.getSystemGameCount(systemName);
      }

      // Atualizar a contagem no sistema
      this.loadedSystems[systemIndex].gameCount = gameCount;

      return this.loadedSystems[systemIndex];
    } catch (error) {
      console.error(
        `Erro ao carregar contagem de jogos para o sistema ${systemName}:`,
        error
      );
      return null;
    }
  }

  // Atualiza o progresso na tela de carregamento
  updateLoadingProgress(progress, message = null) {
    // Verificar se container existe
    if (!this.container) return;

    // Parar o intervalo automático
    if (this._loadingProgressInterval) {
      clearInterval(this._loadingProgressInterval);
      this._loadingProgressInterval = null;
    }

    // Atualizar barra de progresso
    const progressBar = this.container.querySelector(".loading-progress-bar");
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }

    // Atualizar texto de progresso
    const progressText = this.container.querySelector(".loading-progress-text");
    if (progressText) {
      progressText.textContent = `${Math.round(progress)}%`;
    }

    // Atualizar mensagem, se fornecida
    if (message) {
      const messageElement = this.container.querySelector(".loading-message");
      if (messageElement) {
        messageElement.textContent = message;
      }
    }
  }
}
