import { ConfigParser } from "./config-parser.js";

export class GameListScreen {
  constructor(app) {
    this.app = app;
    this.configParser = new ConfigParser();
    this.container = document.querySelector(".gamelist-container");
    this.currentSystem = null;

    // Verificar se a API está disponível
    if (!window.api || !window.api.localApi) {
      console.error(
        "GameListScreen: API local não está disponível. Verifique se o preload.js está configurado corretamente."
      );
    } else {
      console.log(
        "GameListScreen: API local detectada:",
        Object.keys(window.api.localApi)
      );
    }
  }

  async loadGames(systemName) {
    console.log(
      `GameListScreen: Iniciando carregamento de jogos para o sistema ${systemName}`
    );

    if (!this.container) {
      console.log("GameListScreen: Procurando container da lista de jogos");
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        console.error(
          "GameListScreen: Container da lista de jogos não encontrado"
        );
        return false;
      }
    }

    this.showLoading();
    this.currentSystem = systemName;
    this.games = []; // Initialize games array

    try {
      console.log("GameListScreen: Verificando disponibilidade da API IPC");
      if (window.api && typeof window.api.invoke === "function") {
        console.log("GameListScreen: Usando API IPC para carregar jogos");
        const response = await window.api.invoke(
          "api:games:getGamesBySystem",
          systemName
        );
        console.log("GameListScreen: Resposta da API:", response);

        if (response && !response.error) {
          this.games = response.games || [];
          console.log(
            `GameListScreen: ${this.games.length} jogos carregados via API`
          );
        } else {
          console.error(
            "GameListScreen: Erro na resposta da API:",
            response.error
          );
          this.games = [];
        }
      } else {
        console.log(
          "GameListScreen: API IPC não disponível, usando método legado"
        );
        await this.loadGamesWithLegacyMethod(systemName);
      }

      console.log(
        `GameListScreen: ${this.games.length} jogos carregados do sistema ${systemName}`
      );

      // Adicionar tratamento de erro para imagens na lista de jogos
      this.games.forEach((game) => {
        if (!game.image) {
          console.log(
            `GameListScreen: Jogo ${
              game.id || game.path
            } sem imagem, usando padrão`
          );
        }
      });

      // Renderizar a visualização da lista de jogos usando o gerenciador de temas
      try {
        console.log("GameListScreen: Renderizando a lista de jogos com o tema");
        const renderedGameList = await this.app.themeManager.renderGameListView(
          this.currentSystem,
          this.games
        );

        if (renderedGameList) {
          console.log("GameListScreen: Lista de jogos renderizada com sucesso");
          this.container.innerHTML = renderedGameList;

          // Esconder mensagem de carregamento
          this.hideLoading();

          // Aplicar tema da lista de jogos para o sistema atual
          this.app.themeManager.applyGameListTheme(systemName);

          // Adicionar eventos aos elementos da lista de jogos
          this.addGameListEvents();

          return true;
        } else {
          console.error(
            "GameListScreen: Falha ao renderizar a lista de jogos - sem HTML retornado"
          );
          this.showEmptyState(
            `Não foi possível renderizar a lista de jogos do sistema ${systemName}.`
          );
          return false;
        }
      } catch (renderError) {
        console.error(
          "GameListScreen: Erro ao renderizar lista de jogos:",
          renderError
        );
        this.showEmptyState(
          `Erro ao renderizar lista de jogos: ${renderError.message}`
        );
        return false;
      }
    } catch (error) {
      console.error("GameListScreen: Erro ao carregar jogos:", error);
      this.hideLoading();
      this.showEmptyState(
        `Erro ao carregar jogos do sistema ${systemName}. ${error.message}`
      );
      return false;
    }
  }

  // Método de fallback para carregar jogos com o método antigo
  async loadGamesWithLegacyMethod(systemName) {
    try {
      console.log(
        `GameListScreen: loadGamesWithLegacyMethod iniciado para sistema "${systemName}"`
      );

      // Verificar se o container existe
      if (!this.container) {
        this.container = document.querySelector(".gamelist-container");
        if (!this.container) {
          console.error(
            "GameListScreen: Container de lista de jogos não encontrado no DOM"
          );
          // Tentar criar o container se não existir
          const gameListScreen = document.getElementById("gamelist-screen");
          if (gameListScreen) {
            this.container = document.createElement("div");
            this.container.className = "gamelist-container";
            this.container.id = "gamelist-container";
            gameListScreen.appendChild(this.container);
            console.log(
              "GameListScreen: Container de lista de jogos criado dinamicamente"
            );
          } else {
            console.error(
              "GameListScreen: Elemento gamelist-screen não encontrado, impossível criar container"
            );
            return false;
          }
        }
      }

      // Obter dados do sistema
      const systems = await this.configParser.getSystems();
      const systemData = systems.find((sys) => sys.name === systemName);
      console.log("GameListScreen: Dados do sistema obtidos:", systemData);

      if (!systemData) {
        console.error(
          `GameListScreen: Sistema "${systemName}" não encontrado no configParser`
        );
        this.showEmptyState(`Sistema "${systemName}" não encontrado.`);
        return false;
      }

      // Obter jogos do sistema
      console.log(
        `GameListScreen: Obtendo jogos do sistema "${systemName}" via configParser`
      );
      this.games = (await this.configParser.getGames(systemName)) || [];

      if (!this.games || this.games.length === 0) {
        console.log(
          `GameListScreen: Nenhum jogo encontrado para o sistema "${systemName}"`
        );
        this.showEmptyState(`Nenhum jogo encontrado para ${systemName}.`);
        return false;
      }

      console.log(
        `GameListScreen: ${this.games.length} jogos obtidos via configParser`
      );
      if (this.games.length > 0) {
        console.log("GameListScreen: Exemplo do primeiro jogo:", this.games[0]);
      }

      // Criar objeto de sistema com informações completas
      const system = {
        name: systemName,
        ...systemData,
        logoPath:
          systemData.logoPath ||
          this.app.themeManager.getSystemLogoPath(systemName),
      };

      console.log("GameListScreen: Objeto de sistema preparado:", system);
      this.currentSystem = system;

      // Renderizar a visualização da lista de jogos usando o gerenciador de temas
      try {
        console.log(
          "GameListScreen: Renderizando a lista de jogos com o tema (método legado)"
        );
        const renderedGameList = await this.app.themeManager.renderGameListView(
          system,
          this.games
        );

        if (renderedGameList) {
          console.log(
            "GameListScreen: Lista de jogos renderizada com sucesso (método legado)"
          );
          this.container.innerHTML = renderedGameList;

          // Esconder mensagem de carregamento
          this.hideLoading();

          // Aplicar tema da lista de jogos para o sistema atual
          this.app.themeManager.applyGameListTheme(systemName);

          // Adicionar eventos aos elementos da lista de jogos
          this.addGameListEvents();

          return true;
        } else {
          console.error(
            "GameListScreen: Falha ao renderizar a lista de jogos - sem HTML retornado (método legado)"
          );
          this.showEmptyState(
            `Não foi possível renderizar a lista de jogos do sistema ${systemName}.`
          );
          return false;
        }
      } catch (renderError) {
        console.error(
          "GameListScreen: Erro ao renderizar lista de jogos (método legado):",
          renderError
        );
        this.showEmptyState(
          `Erro ao renderizar lista de jogos: ${renderError.message}`
        );
        return false;
      }
    } catch (error) {
      console.error(
        "GameListScreen: Erro no método legado de carregamento de jogos:",
        error
      );
      this.showEmptyState(
        `Erro ao carregar jogos do sistema ${systemName}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Mostra uma mensagem de carregamento na tela
   * @param {string} message - Mensagem a ser exibida
   */
  showLoading(message = "Carregando...") {
    console.log(
      `GameListScreen: Mostrando mensagem de carregamento: "${message}"`
    );

    // Verificar se o container existe
    if (!this.container) {
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        console.error(
          "GameListScreen: Container de lista de jogos não encontrado"
        );
        return;
      }
    }

    // Remover qualquer loading existente
    const existingLoading = this.container.querySelector(".loading-message");
    if (existingLoading) {
      existingLoading.remove();
    }

    // Criar e adicionar novo elemento de loading
    const loadingElement = document.createElement("div");
    loadingElement.className = "loading-message";
    loadingElement.innerHTML = `
      <div class="loading-spinner"></div>
      <p>${message}</p>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(loadingElement);
  }

  /**
   * Esconde a mensagem de carregamento
   */
  hideLoading() {
    console.log("GameListScreen: Escondendo mensagem de carregamento");

    // Verificar se o container existe
    if (!this.container) {
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        console.error(
          "GameListScreen: Container de lista de jogos não encontrado"
        );
        return;
      }
    }

    const loadingElement = this.container.querySelector(".loading-message");
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  /**
   * Mostra uma mensagem de estado vazio quando não há jogos
   * @param {string} message - Mensagem a ser exibida
   */
  showEmptyState(message = "Nenhum jogo encontrado.") {
    console.log(`GameListScreen: Mostrando estado vazio: "${message}"`);

    // Verificar se o container existe
    if (!this.container) {
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        console.error(
          "GameListScreen: Container de lista de jogos não encontrado"
        );
        return;
      }
    }

    // Esconder qualquer loading que possa estar visível
    this.hideLoading();

    // Criar e adicionar elemento de estado vazio
    const emptyElement = document.createElement("div");
    emptyElement.className = "empty-state";
    emptyElement.innerHTML = `
      <div class="empty-icon">
        <i class="fas fa-ghost"></i>
      </div>
      <p>${message}</p>
      <button id="back-to-systems" class="btn-primary">Voltar para Sistemas</button>
    `;

    this.container.innerHTML = "";
    this.container.appendChild(emptyElement);

    // Adicionar evento ao botão de voltar
    const backButton = emptyElement.querySelector("#back-to-systems");
    if (backButton) {
      backButton.addEventListener("click", () => {
        console.log("GameListScreen: Botão de voltar para sistemas clicado");
        this.app.showSystemsScreen();
      });
    }
  }

  /**
   * Adiciona eventos aos elementos da lista de jogos
   */
  addGameListEvents() {
    console.log("GameListScreen: Adicionando eventos à lista de jogos");

    // Verificar se o container existe
    if (!this.container) {
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        console.error(
          "GameListScreen: Container de lista de jogos não encontrado"
        );
        return;
      }
    }

    // Adicionar eventos aos cards de jogos
    const gameCards = this.container.querySelectorAll(".game-card");
    console.log(
      `GameListScreen: Encontrados ${gameCards.length} cards de jogos para adicionar eventos`
    );

    gameCards.forEach((card, index) => {
      // Evento de clique para mostrar detalhes do jogo
      card.addEventListener("click", (event) => {
        // Evitar propagação se o clique foi em um botão específico
        if (
          event.target.closest(".favorite-button") ||
          event.target.closest(".play-button")
        ) {
          return;
        }

        const gameId = card.dataset.gameId;
        const gamePath = card.dataset.gamePath;
        console.log(
          `GameListScreen: Card de jogo clicado - ID: ${gameId}, Path: ${gamePath}`
        );

        // Encontrar o jogo correspondente
        const game =
          this.games[index] ||
          this.games.find((g) => g.id === gameId || g.path === gamePath);

        if (game) {
          console.log("GameListScreen: Mostrando detalhes do jogo:", game);
          this.showGameDetails(game);
        } else {
          console.error(
            `GameListScreen: Jogo não encontrado para ID: ${gameId}, Path: ${gamePath}`
          );
        }
      });

      // Adicionar evento para botão de jogar, se existir
      const playButton = card.querySelector(".play-button");
      if (playButton) {
        playButton.addEventListener("click", (event) => {
          event.stopPropagation(); // Evitar que o evento de clique do card seja acionado

          const gameId = card.dataset.gameId;
          const gamePath = card.dataset.gamePath;
          console.log(
            `GameListScreen: Botão de jogar clicado - ID: ${gameId}, Path: ${gamePath}`
          );

          // Encontrar o jogo correspondente
          const game =
            this.games[index] ||
            this.games.find((g) => g.id === gameId || g.path === gamePath);

          if (game) {
            console.log("GameListScreen: Iniciando jogo:", game);
            this.launchGame(game);
          } else {
            console.error(
              `GameListScreen: Jogo não encontrado para ID: ${gameId}, Path: ${gamePath}`
            );
          }
        });
      }

      // Adicionar evento para botão de favorito, se existir
      const favoriteButton = card.querySelector(".favorite-button");
      if (favoriteButton) {
        favoriteButton.addEventListener("click", async (event) => {
          event.stopPropagation(); // Evitar que o evento de clique do card seja acionado

          const gameId = card.dataset.gameId;
          const gamePath = card.dataset.gamePath;
          console.log(
            `GameListScreen: Botão de favorito clicado - ID: ${gameId}, Path: ${gamePath}`
          );

          // Encontrar o jogo correspondente
          const game =
            this.games[index] ||
            this.games.find((g) => g.id === gameId || g.path === gamePath);

          if (game) {
            console.log(
              "GameListScreen: Atualizando status de favorito para o jogo:",
              game
            );
            const newStatus = !game.favorite;

            // Atualizar status de favorito
            const result = await this.updateFavorite(
              game,
              this.currentSystem.name,
              newStatus
            );

            if (result && result.success) {
              console.log(
                `GameListScreen: Status de favorito atualizado com sucesso para: ${newStatus}`
              );

              // Atualizar UI
              favoriteButton.classList.toggle("active", newStatus);
              game.favorite = newStatus;
            } else {
              console.error(
                "GameListScreen: Falha ao atualizar status de favorito:",
                result?.error || "Erro desconhecido"
              );
            }
          } else {
            console.error(
              `GameListScreen: Jogo não encontrado para ID: ${gameId}, Path: ${gamePath}`
            );
          }
        });
      }
    });

    // Configurar funcionalidade de pesquisa
    this.setupSearchFunctionality();

    console.log(
      "GameListScreen: Eventos adicionados com sucesso à lista de jogos"
    );
  }

  /**
   * Configura a funcionalidade de pesquisa na lista de jogos
   */
  setupSearchFunctionality() {
    console.log("GameListScreen: Configurando funcionalidade de pesquisa");

    // Verificar se o container existe
    if (!this.container) {
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        console.error(
          "GameListScreen: Container de lista de jogos não encontrado"
        );
        return;
      }
    }

    const searchInput = this.container.querySelector("#game-search");
    const clearButton = this.container.querySelector("#clear-search");

    if (!searchInput) {
      console.warn("GameListScreen: Input de pesquisa não encontrado");
      return;
    }

    // Função para realizar a pesquisa
    const performSearch = () => {
      const searchTerm = searchInput.value.toLowerCase().trim();
      console.log(`GameListScreen: Realizando pesquisa por "${searchTerm}"`);

      const gameCards = this.container.querySelectorAll(".game-card");
      let matchCount = 0;

      gameCards.forEach((card) => {
        const gameTitle =
          card.querySelector(".game-title")?.textContent?.toLowerCase() || "";
        const gameDeveloper =
          card.querySelector(".developer")?.textContent?.toLowerCase() || "";
        const gameGenre =
          card.querySelector(".genre")?.textContent?.toLowerCase() || "";
        const gameDescription =
          card.querySelector(".game-description")?.textContent?.toLowerCase() ||
          "";

        // Verificar se algum dos campos contém o termo de pesquisa
        const isMatch =
          gameTitle.includes(searchTerm) ||
          gameDeveloper.includes(searchTerm) ||
          gameGenre.includes(searchTerm) ||
          gameDescription.includes(searchTerm);

        // Mostrar ou esconder o card com base no resultado da pesquisa
        if (isMatch || searchTerm === "") {
          card.style.display = "";
          matchCount++;
        } else {
          card.style.display = "none";
        }
      });

      console.log(
        `GameListScreen: Pesquisa encontrou ${matchCount} jogos correspondentes`
      );

      // Mostrar mensagem se nenhum jogo for encontrado
      const noResultsElement =
        this.container.querySelector(".no-search-results");

      if (matchCount === 0 && searchTerm !== "") {
        if (!noResultsElement) {
          const noResults = document.createElement("div");
          noResults.className = "no-search-results";
          noResults.innerHTML = `
            <p>Nenhum jogo encontrado para "${searchTerm}"</p>
          `;
          this.container.appendChild(noResults);
        }
      } else if (noResultsElement) {
        noResultsElement.remove();
      }

      // Atualizar visibilidade do botão de limpar
      if (clearButton) {
        clearButton.style.display = searchTerm ? "block" : "none";
      }
    };

    // Adicionar evento de input para pesquisa em tempo real
    searchInput.addEventListener("input", performSearch);

    // Adicionar evento para o botão de limpar pesquisa
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        console.log("GameListScreen: Botão de limpar pesquisa clicado");
        searchInput.value = "";
        performSearch();
        searchInput.focus();
      });

      // Inicialmente esconder o botão de limpar
      clearButton.style.display = "none";
    }

    console.log(
      "GameListScreen: Funcionalidade de pesquisa configurada com sucesso"
    );
  }

  async launchGame(game) {
    console.log(`=== INICIANDO LANÇAMENTO DO JOGO ===`);
    console.log(`Dados do jogo recebidos:`, game);

    try {
      // Verificar se temos um sistema atual
      if (!this.currentSystem) {
        const errorMsg = "Sistema atual não definido";
        console.error(errorMsg);
        alert(errorMsg);
        return;
      }

      const systemName = this.currentSystem.name || this.currentSystem;
      console.log(`Sistema atual:`, systemName);

      // Mostrar tela de carregamento
      this.showGameLaunchingScreen(game, systemName);

      // Verificar se a API local está disponível
      if (window.api && window.api.localApi && window.api.localApi.games) {
        try {
          console.log("Usando API local para obter configuração de lançamento");

          // Obter configuração de lançamento do sistema
          const launchConfigResponse =
            await window.api.localApi.systems.getLaunchConfig(systemName);

          if (launchConfigResponse.error) {
            console.error(
              "Erro ao obter configuração de lançamento:",
              launchConfigResponse.error
            );
          } else {
            console.log(
              "Configuração de lançamento obtida:",
              launchConfigResponse.launchConfig
            );
          }

          // Preparar dados do jogo para lançamento
          const gameData = {
            systemName: systemName,
            gamePath: game.path,
            gameId: game.id,
            // Adicionar configuração de lançamento se disponível
            launchConfig: launchConfigResponse?.launchConfig || null,
          };

          console.log(`Dados preparados para API:`, gameData);

          // Chamar a API para lançar o jogo
          const result = await window.api.launchGame(gameData);

          console.log(`Resposta da API launchGame:`, result);

          // Verificar resultado
          if (result && result.success) {
            console.log(`Jogo lançado com sucesso:`, result);
            // Manter a tela de carregamento por um tempo antes de escondê-la
            setTimeout(() => {
              this.hideGameLaunchingScreen();
            }, 2000);
          } else {
            const errorMsg =
              result?.error || "Erro desconhecido ao lançar o jogo";
            console.error(errorMsg);
            alert(errorMsg);
            this.hideGameLaunchingScreen();
          }

          return result;
        } catch (error) {
          console.error("Erro ao usar API local para lançar jogo:", error);
          // Fallback para API antiga
          return this.launchGameWithLegacyApi(game, systemName);
        }
      } else {
        console.log("API local não disponível, usando API antiga");
        return this.launchGameWithLegacyApi(game, systemName);
      }
    } catch (error) {
      console.error("Erro ao lançar jogo:", error);
      alert(`Erro ao lançar jogo: ${error.message}`);
      this.hideGameLaunchingScreen();
      return { success: false, error: error.message };
    }
  }

  // Método de fallback para lançar jogos com a API antiga
  async launchGameWithLegacyApi(game, systemName) {
    try {
      // Preparar dados do jogo para lançamento
      const gameData = {
        systemName: systemName,
        gamePath: game.path,
        gameId: game.id,
      };

      console.log(`Dados preparados para API antiga:`, gameData);

      // Chamar a API para lançar o jogo
      const result = await window.api.launchGame(gameData);

      console.log(`Resposta da API launchGame:`, result);

      // Verificar resultado
      if (result && result.success) {
        console.log(`Jogo lançado com sucesso:`, result);
        // Manter a tela de carregamento por um tempo antes de escondê-la
        setTimeout(() => {
          this.hideGameLaunchingScreen();
        }, 2000);
      } else {
        const errorMsg = result?.error || "Erro desconhecido ao lançar o jogo";
        console.error(errorMsg);
        alert(errorMsg);
        this.hideGameLaunchingScreen();
      }

      return result;
    } catch (error) {
      console.error("Erro ao lançar jogo com API antiga:", error);
      this.hideGameLaunchingScreen();
      return { success: false, error: error.message };
    }
  }

  // Método para mostrar a tela de loading de lançamento do jogo
  showGameLaunchingScreen(game, systemName) {
    console.log(
      "Mostrando tela de lançamento para jogo:",
      game.name || game.path
    );

    // Criar o overlay de loading
    const overlay = document.createElement("div");
    overlay.id = "game-launch-overlay";
    overlay.className = "game-launch-overlay";

    // Obter o caminho da capa do jogo se disponível
    const gameImagePath =
      game.image || this.app.themeManager.getGameImagePath(systemName, game.id);
    const systemTheme = this.app.themeManager.getSystemThemeData(systemName);
    const systemLogo =
      systemTheme?.logo || this.app.themeManager.getSystemLogoPath(systemName);

    console.log("Imagem do jogo:", gameImagePath);
    console.log("Logo do sistema:", systemLogo);

    // Verificar se o tema atual tem um template de loading personalizado
    let launchTemplate = null;
    try {
      launchTemplate = this.app.themeManager.getTemplate("launch");
      console.log("Template de lançamento encontrado");
    } catch (e) {
      console.log(
        "Template de loading personalizado não encontrado, usando padrão"
      );
    }

    if (launchTemplate) {
      // Renderizar o template personalizado
      const templateData = {
        game: {
          name: game.name || game.path || "Jogo sem título",
          id: game.id,
          path: game.path,
        },
        system: {
          name: systemName,
          logo: systemLogo,
        },
        gameImage: gameImagePath,
      };

      console.log("Dados para template de lançamento:", templateData);
      overlay.innerHTML = this.app.themeManager.renderTemplate(
        launchTemplate,
        templateData
      );
    } else {
      // Template de loading padrão
      overlay.innerHTML = `
        <div class="launch-content">
          <div class="system-logo">
            <img src="${systemLogo}" alt="${systemName}" onerror="this.style.display='none'">
          </div>
          <h2>${game.name || game.path || "Jogo sem título"}</h2>
          <div class="game-image">
            ${
              gameImagePath
                ? `<img src="${gameImagePath}" alt="${
                    game.name || "Jogo"
                  }" onerror="this.style.display='none'">`
                : ""
            }
          </div>
          <div class="loading-spinner"></div>
          <p>Iniciando jogo...</p>
        </div>
      `;
    }

    // Adicionar o overlay ao DOM
    document.body.appendChild(overlay);

    // Adicionar classe para mostrar com animação
    setTimeout(() => {
      overlay.classList.add("visible");
    }, 10);
  }

  hideGameLaunchingScreen() {
    const overlay = document.getElementById("game-launch-overlay");
    if (overlay) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 300);
    }
  }

  async showGameDetails(game) {
    try {
      console.log(`=== MOSTRANDO DETALHES DO JOGO ===`);
      console.log(`Jogo:`, game);

      // Verificar se o jogo é válido
      if (!game || !game.id) {
        console.error("Objeto de jogo inválido:", game);
        return;
      }

      // Tentar obter detalhes completos do jogo via API local
      let gameDetails = game;

      if (window.api && window.api.localApi && window.api.localApi.games) {
        try {
          console.log("Obtendo detalhes completos do jogo via API local");
          const systemName = this.currentSystem?.name;

          if (systemName) {
            const response = await window.api.localApi.games.getById(
              systemName,
              game.id
            );

            if (!response.error && response.game) {
              console.log(
                "Detalhes do jogo obtidos via API local:",
                response.game
              );
              gameDetails = response.game;
            } else if (response.error) {
              console.error(
                "Erro ao obter detalhes do jogo via API:",
                response.error
              );
            }
          }
        } catch (error) {
          console.error("Erro ao chamar API para detalhes do jogo:", error);
        }
      }

      // Obter o modal e configurar
      const modal = document.getElementById("gameDetailsModal");
      if (!modal) {
        console.error("Modal de detalhes do jogo não encontrado no DOM");
        return;
      }

      // Preencher os detalhes do jogo no modal
      const title = modal.querySelector(".game-title");
      const image = modal.querySelector(".game-detail-image");
      const developer = modal.querySelector(".game-developer");
      const releaseDate = modal.querySelector(".game-release-date");
      const genre = modal.querySelector(".game-genre");
      const description = modal.querySelector(".game-description");
      const playButton = modal.querySelector(".play-button");
      const favoriteButton = modal.querySelector(".favorite-button");

      // Verificar se todos os elementos necessários existem
      const elements = {
        title,
        image,
        developer,
        releaseDate,
        genre,
        description,
        playButton,
        favoriteButton: !!favoriteButton,
      };

      console.log("Elementos do modal:", elements);

      // Preencher os elementos com os dados do jogo
      if (title)
        title.textContent =
          gameDetails.name || gameDetails.title || "Jogo sem título";

      if (image) {
        const imagePath =
          gameDetails.image ||
          this.app.themeManager.getGameImagePath(
            this.currentSystem.name,
            gameDetails.id
          );
        image.src = imagePath;
        image.onerror = () => {
          image.src = "assets/icons/default-game.png";
        };
      }

      if (developer)
        developer.textContent = gameDetails.developer || "Desconhecido";
      if (releaseDate)
        releaseDate.textContent = gameDetails.releaseDate || "N/A";
      if (genre) genre.textContent = gameDetails.genre || "N/A";
      if (description)
        description.textContent =
          gameDetails.description ||
          gameDetails.desc ||
          "Sem descrição disponível";

      // Configurar botão de jogar
      if (playButton) {
        playButton.onclick = async () => {
          modal.classList.remove("active");
          console.log(`Chamando método launchGame com:`, gameDetails);
          await this.launchGame(gameDetails);
        };
      }

      // Configurar botão de favorito se existir
      if (favoriteButton) {
        const isFavorite = gameDetails.favorite === true;
        favoriteButton.classList.toggle("active", isFavorite);
        favoriteButton.innerHTML = isFavorite
          ? '<i class="fas fa-heart"></i>'
          : '<i class="far fa-heart"></i>';

        favoriteButton.onclick = async () => {
          const systemName = this.currentSystem.name;
          const newFavoriteStatus = !isFavorite;

          console.log(
            `Atualizando status de favorito: Jogo=${gameDetails.id}, Sistema=${systemName}, Novo status=${newFavoriteStatus}`
          );

          const result = await this.updateFavorite(
            gameDetails.id,
            systemName,
            newFavoriteStatus
          );

          if (result.success) {
            console.log("Favorito atualizado com sucesso");
            // Atualizar o estado do botão
            gameDetails.favorite = newFavoriteStatus;
            favoriteButton.classList.toggle("active", newFavoriteStatus);
            favoriteButton.innerHTML = newFavoriteStatus
              ? '<i class="fas fa-heart"></i>'
              : '<i class="far fa-heart"></i>';

            // Atualizar o ícone de favorito no card do jogo
            const gameCard = document.querySelector(
              `.game-card[data-id="${gameDetails.id}"]`
            );
            const favoriteIcon = gameCard?.querySelector(".favorite-icon");
            if (favoriteIcon) {
              favoriteIcon.classList.toggle("active", newFavoriteStatus);
            }
          } else {
            console.error("Erro ao atualizar favorito:", result.error);
          }
        };
      }

      // Mostrar o modal
      modal.classList.add("active");

      // Adicionar evento para fechar o modal ao clicar fora
      const modalContent = modal.querySelector(".modal-content");
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.classList.remove("active");
        }
      };

      // Adicionar evento para fechar o modal com ESC
      const escHandler = (e) => {
        if (e.key === "Escape") {
          modal.classList.remove("active");
          document.removeEventListener("keydown", escHandler);
        }
      };
      document.addEventListener("keydown", escHandler);
    } catch (error) {
      console.error("Erro ao mostrar detalhes do jogo:", error);
    }
  }

  // Método para atualizar o status de favorito de um jogo
  async updateFavorite(gameId, systemName, newStatus) {
    try {
      console.log(
        `Atualizando status de favorito: Jogo=${gameId}, Sistema=${systemName}, Novo status=${newStatus}`
      );

      // Verificar se a API local está disponível
      if (window.api && window.api.localApi && window.api.localApi.games) {
        try {
          console.log("Usando API local para atualizar favorito");

          const result = await window.api.localApi.games.updateFavorite(
            systemName,
            gameId,
            newStatus
          );

          if (result.error) {
            console.error(
              "Erro na atualização de favorito via API:",
              result.error
            );
            // Fallback para API antiga
            return this.updateFavoriteWithLegacyApi(
              gameId,
              systemName,
              newStatus
            );
          }

          console.log(`Resultado da atualização de favorito:`, result);
          return result;
        } catch (error) {
          console.error(
            "Erro ao usar API local para atualizar favorito:",
            error
          );
          // Fallback para API antiga
          return this.updateFavoriteWithLegacyApi(
            gameId,
            systemName,
            newStatus
          );
        }
      } else {
        console.log("API local não disponível, usando API antiga");
        return this.updateFavoriteWithLegacyApi(gameId, systemName, newStatus);
      }
    } catch (error) {
      console.error("Erro ao atualizar favorito:", error);
      return { success: false, error: error.message };
    }
  }

  // Método de fallback para atualizar favoritos com a API antiga
  async updateFavoriteWithLegacyApi(gameId, systemName, newStatus) {
    try {
      if (!window.api || !window.api.updateGameFavorite) {
        return {
          success: false,
          error: "API de atualização de favoritos não disponível",
        };
      }

      const result = await window.api.updateGameFavorite(
        systemName,
        gameId,
        newStatus
      );

      return result;
    } catch (error) {
      console.error("Erro ao atualizar favorito com API antiga:", error);
      return { success: false, error: error.message };
    }
  }
}
