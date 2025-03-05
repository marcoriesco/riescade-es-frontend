import { ConfigParser } from "./config-parser.js";

export class SystemsScreen {
  constructor(app) {
    this.app = app;
    this.configParser = new ConfigParser();
    this.container = document.querySelector(".systems-container");
    this.systemsLoaded = false;
    this.loadedSystems = [];

    // Verificar se a API está disponível
    if (!window.api || !window.api.localApi) {
      console.error(
        "API local não está disponível. Verifique se o preload.js está configurado corretamente."
      );
    } else {
      console.log("API local detectada:", Object.keys(window.api.localApi));
    }
  }

  async loadSystems(forceReload = false) {
    // Se os sistemas já foram carregados e não estamos forçando um recarregamento, use os dados em cache
    if (this.systemsLoaded && !forceReload) {
      console.log("Usando sistemas em cache.");
      await this.renderSystemsWithTheme(this.loadedSystems);
      return;
    }

    // Mostrar indicador de loading
    this.showLoading();

    try {
      // Usar a nova API local para obter os sistemas
      console.log("Obtendo sistemas via API local...");
      const systems = await window.api.localApi.systems.getAll();

      // Debug logging
      console.log("Tipo de systems:", typeof systems);
      console.log("Valor de systems:", systems);

      if (systems.error) {
        console.error("Erro ao obter sistemas:", systems.error);
        this.showEmptyState(`Erro ao carregar sistemas: ${systems.error}`);
        return;
      }

      // Ensure systems is an array
      const systemsArray = Array.isArray(systems)
        ? systems
        : systems.systems
        ? systems.systems
        : systems.systemList && systems.systemList.system
        ? Array.isArray(systems.systemList.system)
          ? systems.systemList.system
          : [systems.systemList.system]
        : [];

      console.log("Array de sistemas processado:", systemsArray);

      if (systemsArray.length === 0) {
        this.showEmptyState(
          "Nenhum sistema encontrado. Verifique suas configurações."
        );
        return;
      }

      console.log("Sistemas obtidos via API local:", systemsArray);

      // Obter a contagem de jogos para cada sistema usando a API local
      const systemsWithCounts = await Promise.all(
        systemsArray.map(async (system) => {
          try {
            // Obter jogos do sistema usando a API local
            const games = await window.api.localApi.games.getBySystem(
              system.name
            );
            const gameCount =
              games && games.gameList && games.gameList.game
                ? Array.isArray(games.gameList.game)
                  ? games.gameList.game.length
                  : 1
                : 0;

            return {
              ...system,
              gameCount: gameCount,
              // Adicionar outros campos necessários
              extensions: system.extension ? system.extension.split(" ") : [],
              logoPath:
                system.logo || `themes/default/system_logos/${system.name}.png`,
              color: system.color || "#1a88ff",
            };
          } catch (error) {
            console.error(`Erro ao obter jogos para ${system.name}:`, error);
            return {
              ...system,
              gameCount: 0,
              extensions: system.extension ? system.extension.split(" ") : [],
              logoPath:
                system.logo || `themes/default/system_logos/${system.name}.png`,
              color: system.color || "#1a88ff",
            };
          }
        })
      );

      console.log("Sistemas com contagem de jogos:", systemsWithCounts);

      // Armazenar os sistemas carregados para uso posterior
      this.loadedSystems = systemsWithCounts;
      this.systemsLoaded = true;

      // Renderizar os sistemas
      await this.renderSystemsWithTheme(systemsWithCounts);

      return systemsWithCounts;
    } catch (error) {
      console.error("Erro ao carregar sistemas via API local:", error);

      // Tentar o método antigo como fallback
      try {
        console.log("Tentando fallback para o método antigo...");
        const systems = await this.configParser.getSystems();
        if (systems.length === 0) {
          this.showEmptyState(
            "Nenhum sistema encontrado. Verifique suas configurações."
          );
          return;
        }

        // Obter a contagem de jogos para cada sistema
        const systemsWithCounts = await Promise.all(
          systems.map(async (system) => {
            const gameCount = await this.configParser.getSystemGameCount(
              system.name
            );
            return {
              ...system,
              gameCount: gameCount,
            };
          })
        );

        this.loadedSystems = systemsWithCounts;
        this.systemsLoaded = true;
        await this.renderSystemsWithTheme(systemsWithCounts);
      } catch (fallbackError) {
        console.error("Erro no fallback:", fallbackError);
        this.showEmptyState(`Erro ao carregar sistemas: ${error.message}`);
      }
    }
  }

  // Método para mostrar o indicador de loading
  showLoading() {
    this.container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>Carregando sistemas teste...</p>
      </div>
    `;
  }

  // Novo método para renderizar usando o tema
  async renderSystemsWithTheme(systems) {
    try {
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

      console.log("Dados para renderização:", data);

      // Usar o ThemeManager para renderizar o template
      const renderedHtml = await this.app.themeManager.renderSystemsView(data);

      // Atualizar o container com o HTML renderizado
      this.container.innerHTML = renderedHtml;

      // Adicionar event listeners para os cards de sistema
      this.addSystemCardEventListeners(systems);

      // Configurar a funcionalidade de pesquisa
      this.setupSearchFunctionality(systems);
    } catch (error) {
      console.error("Erro ao renderizar sistemas com tema:", error);
      // Fallback para o método original em caso de erro
      this.renderSystems(systems);
    }
  }

  // Adicionar event listeners após renderizar com o template
  addSystemCardEventListeners(systems) {
    // Selecionar todos os cards de sistema no container
    const systemCards = this.container.querySelectorAll("[data-system-id]");

    // Para cada card, adicionar o event listener
    systemCards.forEach((card) => {
      const systemId = card.getAttribute("data-system-id");
      const systemName = card.getAttribute("data-system-name");
      const system = systems.find((s) => s.name === systemName);

      if (system) {
        card.addEventListener("click", () => {
          console.log("Sistema clicado:", system);
          this.app.selectSystem(system);
        });
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
      console.log("Elementos de pesquisa não encontrados");
      return;
    }

    console.log(
      "Configurando funcionalidade de pesquisa para",
      systems.length,
      "sistemas"
    );

    // Função para filtrar sistemas
    const filterSystems = (query) => {
      const normalizedQuery = query.toLowerCase().trim();
      const systemCards = document.querySelectorAll(
        ".system-card, [data-system-id]"
      );

      console.log("Filtrando sistemas com query:", normalizedQuery);
      console.log("Encontrados", systemCards.length, "cards de sistema");

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

    console.log("Funcionalidade de pesquisa configurada com sucesso");
  }
}
