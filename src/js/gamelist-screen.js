import { ConfigParser } from "./config-parser.js";

export class GameListScreen {
  constructor(app) {
    this.app = app;
    this.configParser = new ConfigParser();
    this.container = document.querySelector(".gamelist-container");
    this.currentSystem = null;
    this.games = [];

    // Verificar se a API está disponível
    if (!window.api) {
      console.error("GameListScreen: API do Electron não disponível");
    } else {
      console.log("GameListScreen: API detectada:", Object.keys(window.api));
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
      // Verificar qual API está disponível
      const hasIpcApi = window.api && typeof window.api.invoke === "function";
      const hasLocalApi =
        window.api && window.api.localApi && window.api.localApi.games;
      const hasReadGameList =
        window.api && typeof window.api.readGameList === "function";

      console.log("GameListScreen: APIs disponíveis:", {
        hasIpcApi,
        hasLocalApi,
        hasReadGameList,
      });

      let response = null;

      // Tentar carregar usando a API IPC
      if (hasIpcApi) {
        try {
          console.log("GameListScreen: Tentando API IPC (invoke)");
          response = await window.api.invoke(
            "api:games:getGamesBySystem",
            systemName
          );
          console.log(
            "GameListScreen: Resposta da API IPC:",
            JSON.stringify(response, null, 2)
          );
        } catch (ipcError) {
          console.error("GameListScreen: Erro na API IPC:", ipcError);
        }
      }

      // Se não conseguiu via IPC, tentar API Local
      if (!response && hasLocalApi) {
        try {
          console.log("GameListScreen: Tentando API Local");
          response = await window.api.localApi.games.getBySystem(systemName);
          console.log(
            "GameListScreen: Resposta da API Local:",
            JSON.stringify(response, null, 2)
          );
        } catch (localApiError) {
          console.error("GameListScreen: Erro na API Local:", localApiError);
        }
      }

      // Se não conseguiu via API Local, tentar readGameList
      if (!response && hasReadGameList) {
        try {
          console.log("GameListScreen: Tentando readGameList");
          response = await window.api.readGameList(systemName);
          console.log(
            "GameListScreen: Resposta do readGameList:",
            JSON.stringify(response, null, 2)
          );
        } catch (readError) {
          console.error("GameListScreen: Erro no readGameList:", readError);
        }
      }

      // Processar a resposta se houver
      console.log("GameListScreen: Processando resposta:", {
        hasResponse: !!response,
        responseType: response ? typeof response : "undefined",
        hasError: response?.error,
        hasGameList: response?.gameList,
        isArray: Array.isArray(response),
      });

      if (response && !response.error) {
        if (response.gameList && response.gameList.game) {
          console.log("GameListScreen: Encontrado gameList.game na resposta");
          this.games = Array.isArray(response.gameList.game)
            ? response.gameList.game
            : [response.gameList.game];
        } else if (Array.isArray(response)) {
          console.log("GameListScreen: Resposta é um array");
          this.games = response;
        } else if (typeof response === "object") {
          console.log(
            "GameListScreen: Resposta é um objeto, procurando por jogos"
          );
          // Tentar encontrar os jogos em diferentes formatos possíveis
          if (response.games) {
            this.games = Array.isArray(response.games)
              ? response.games
              : [response.games];
          } else if (response.game) {
            this.games = Array.isArray(response.game)
              ? response.game
              : [response.game];
          }
        }
      }

      console.log("GameListScreen: Jogos encontrados:", {
        quantidade: this.games.length,
        primeiro: this.games[0]
          ? {
              id: this.games[0].id,
              name: this.games[0].name,
              path: this.games[0].path,
            }
          : null,
      });

      // Se nenhum método funcionou, tentar o método legado
      if (this.games.length === 0) {
        console.log(
          "GameListScreen: Nenhum jogo encontrado via APIs, tentando método legado"
        );
        const legacyGames = await this.loadGamesWithLegacyMethod(systemName);
        if (legacyGames && legacyGames.length > 0) {
          this.games = legacyGames;
        }
      }

      // Processar os jogos carregados
      if (this.games.length > 0) {
        console.log("GameListScreen: Processando jogos carregados");
        this.games = this.games.map((game) => {
          const processedGame = {
            ...game,
            id: game.id || game.path,
            name: game.name || game.path,
            path: game.path,
            image: game.image || "",
            desc: game.desc || "",
            developer: game.developer || "",
            publisher: game.publisher || "",
            genre: game.genre || "",
            players: game.players || "",
            rating: game.rating || "",
            releasedate: game.releasedate || "",
            video: game.video || "",
          };
          return processedGame;
        });

        console.log("GameListScreen: Primeiro jogo processado:", this.games[0]);
      } else {
        console.log("GameListScreen: Nenhum jogo encontrado para processar");
        this.showEmptyState(
          `Nenhum jogo encontrado para o sistema ${systemName}`
        );
        return false;
      }

      // Renderizar a lista de jogos
      try {
        console.log("GameListScreen: Renderizando a lista de jogos com o tema");
        const renderedGameList = await this.app.themeManager.renderGameListView(
          this.currentSystem,
          this.games
        );

        if (renderedGameList) {
          console.log("GameListScreen: Lista de jogos renderizada com sucesso");
          this.container.innerHTML = renderedGameList;
          this.hideLoading();
          this.app.themeManager.applyGameListTheme(systemName);
          this.addGameListEvents();
          return true;
        } else {
          throw new Error("HTML não retornado pelo renderizador");
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

  async loadGamesWithLegacyMethod(systemName) {
    console.log("GameListScreen: Usando método legado para carregar jogos");
    try {
      // Tentar obter jogos via ConfigParser
      console.log("GameListScreen: Tentando obter jogos via ConfigParser");
      const games = await this.configParser.getGames(systemName);

      if (!games || games.length === 0) {
        console.log("GameListScreen: Nenhum jogo encontrado via ConfigParser");
        return [];
      }

      console.log(
        `GameListScreen: ${games.length} jogos obtidos via ConfigParser`
      );
      this.games = games;
      return games;
    } catch (error) {
      console.error(
        "GameListScreen: Erro ao carregar jogos via método legado:",
        error
      );
      return [];
    }
  }

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
        this.app.showScreen("systems");
      });
    }
  }

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

  async renderGameListView(system, games) {
    console.log("ThemeManager: Iniciando renderização da lista de jogos");
    console.log("ThemeManager: Sistema:", system);
    console.log("ThemeManager: Número de jogos:", games ? games.length : 0);

    try {
      // Garantir que games é sempre um array
      const gamesList = games || [];

      // Carregar o template da lista de jogos
      console.log("ThemeManager: Tentando carregar template 'gamelist'");
      const template = await this.loadTemplate("gamelist");

      if (!template) {
        console.error("ThemeManager: Template 'gamelist' não encontrado");

        // Renderizar uma versão básica sem template
        let html = `
          <div class="gamelist-container">
            <div class="gamelist-header">
              <div class="system-info">
                <div class="system-logo">
                  <img src="${this.getSystemLogoPath(system.name)}" alt="${
          system.name
        }">
                </div>
                <h2>${system.fullname || system.name}</h2>
              </div>
              <div class="game-search-container">
                <input type="text" id="game-search" placeholder="Pesquisar jogos...">
                <button id="clear-search" class="clear-search-btn"><i class="fas fa-times"></i></button>
              </div>
              <button id="back-to-systems" class="btn-back">Voltar</button>
            </div>
            
            <div class="games-grid">`;

        // Verificar se temos jogos para exibir
        if (gamesList.length > 0) {
          // Adicionar cada jogo ao HTML
          gamesList.forEach((game) => {
            const imagePath =
              game.image || "themes/default/assets/icons/default-game.png";
            const favoriteClass = game.favorite ? "active" : "";

            html += `
              <div class="game-card" data-game-id="${
                game.id || ""
              }" data-game-path="${game.path || ""}">
                <div class="game-image">
                  <img src="${imagePath}" alt="${
              game.name || "Jogo"
            }" onerror="this.src='assets/icons/default-game.png'">
                </div>
                <div class="game-info">
                  <h3 class="game-title">${game.name || "Sem Nome"}</h3>
                  <div class="game-metadata">
                    <span class="developer">${
                      game.developer || "Desconhecido"
                    }</span>
                    <span class="release-date">${
                      game.releaseDate || "N/A"
                    }</span>
                  </div>
                </div>
                <div class="game-actions">
                  <button class="play-button" title="Jogar"><i class="fas fa-play"></i></button>
                  <button class="favorite-button ${favoriteClass}" title="Favorito"><i class="fas fa-heart"></i></button>
                </div>
              </div>
            `;
          });
        } else {
          // Exibir mensagem de lista vazia
          html += `
            <div class="empty-state">
              <div class="empty-icon">
                <i class="fas fa-ghost"></i>
              </div>
              <p>Nenhum jogo encontrado para o sistema ${
                system.name || system.fullname
              }.</p>
            </div>
          `;
        }

        html += `
            </div>
          </div>
        `;

        return html;
      }

      console.log("ThemeManager: Template 'gamelist' carregado com sucesso");

      // Preparar dados para o template
      const templateData = {
        system: system,
        games: gamesList,
        theme: this.currentTheme,
      };

      // Renderizar usando o template
      let html = template;

      // Substituir variáveis relacionadas ao sistema
      html = html.replace(/\{\{system\.name\}\}/g, system.name || "");
      html = html.replace(
        /\{\{system\.fullname\}\}/g,
        system.fullname || system.name || ""
      );
      html = html.replace(
        /\{\{system\.logoPath\}\}/g,
        this.getSystemLogoPath(system.name || "")
      );

      // Processar o bloco de jogos
      const gamesBlockMatch = html.match(
        /<!-- BEGIN games -->([\s\S]*?)<!-- END games -->/
      );

      if (gamesBlockMatch && gamesBlockMatch[1]) {
        const gameTemplate = gamesBlockMatch[1];
        let gamesHtml = "";

        // Se não houver jogos, mostrar mensagem apropriada
        if (gamesList.length === 0) {
          gamesHtml = `
            <div class="empty-state">
              <div class="empty-icon">
                <i class="fas fa-ghost"></i>
              </div>
              <p>Nenhum jogo encontrado para o sistema ${
                system.name || system.fullname
              }.</p>
            </div>
          `;
        } else {
          // Renderizar cada jogo usando o template
          gamesList.forEach((game) => {
            let gameHtml = gameTemplate;

            // Substituir todas as variáveis do jogo
            gameHtml = gameHtml.replace(/\{\{id\}\}/g, game.id || "");
            gameHtml = gameHtml.replace(
              /\{\{name\}\}/g,
              game.name || "Sem Nome"
            );
            gameHtml = gameHtml.replace(/\{\{path\}\}/g, game.path || "");

            // Imagem - usar a imagem definida ou padrão
            const imagePath =
              game.image || game.imagePath || "assets/icons/default-game.png";
            gameHtml = gameHtml.replace(/\{\{imagePath\}\}/g, imagePath);

            // Outras propriedades
            gameHtml = gameHtml.replace(
              /\{\{developer\}\}/g,
              game.developer || "Desconhecido"
            );
            gameHtml = gameHtml.replace(
              /\{\{publisher\}\}/g,
              game.publisher || "Desconhecido"
            );
            gameHtml = gameHtml.replace(/\{\{genre\}\}/g, game.genre || "N/A");
            gameHtml = gameHtml.replace(
              /\{\{releaseDate\}\}/g,
              game.releaseDate || "N/A"
            );
            gameHtml = gameHtml.replace(
              /\{\{description\}\}/g,
              game.desc || game.description || "Sem descrição disponível"
            );

            // Status de favorito
            const favoriteClass = game.favorite ? "active" : "";
            gameHtml = gameHtml.replace(
              /\{\{favoriteClass\}\}/g,
              favoriteClass
            );

            gamesHtml += gameHtml;
          });
        }

        // Substituir o bloco de jogos completo
        html = html.replace(gamesBlockMatch[0], gamesHtml);
      }

      return html;
    } catch (error) {
      console.error("ThemeManager: Erro ao renderizar lista de jogos:", error);

      // Em caso de erro, mostrar uma mensagem de erro básica
      return `
        <div class="gamelist-container">
          <div class="gamelist-header">
            <div class="system-info">
              <h2>${system.fullname || system.name || "Sistema"}</h2>
            </div>
            <button id="back-to-systems" class="btn-back">Voltar</button>
          </div>
          
          <div class="error-message">
            <p>Ocorreu um erro ao carregar a lista de jogos.</p>
            <p>Detalhes: ${error.message}</p>
          </div>
        </div>
      `;
    }
  }

  generateGameListHTML(system, games) {
    console.log("ThemeManager: Gerando HTML da lista de jogos diretamente");

    let html = `
      <div class="gamelist-header">
        <div class="system-info">
          <div class="system-logo">
            <img src="${this.getSystemLogoPath(system.name)}" alt="${
      system.name
    }">
          </div>
          <h2>${system.fullname || system.name}</h2>
        </div>
        <div class="game-search-container">
          <input type="text" id="game-search" placeholder="Pesquisar jogos...">
          <button id="clear-search" class="clear-search-btn"><i class="fas fa-times"></i></button>
        </div>
        <button id="back-to-systems" class="btn-back">Voltar</button>
      </div>
      
      <div class="games-grid">
    `;

    // Gerar HTML para cada jogo
    if (games && games.length > 0) {
      games.forEach((game) => {
        const imagePath =
          game.imagePath ||
          game.image ||
          this.getGameImagePath(system.name, game.id);
        const favoriteClass = game.favorite ? "active" : "";

        html += `
          <div class="game-card" data-game-id="${
            game.id || ""
          }" data-game-path="${game.path || ""}">
            <div class="game-image">
              <img src="${imagePath}" alt="${
          game.name || "Jogo"
        }" onerror="this.src='assets/icons/default-game.png'">
            </div>
            <div class="game-info">
              <h3 class="game-title">${game.name || "Sem Nome"}</h3>
              <div class="game-metadata">
                <span class="developer">${
                  game.developer || "Desconhecido"
                }</span>
                <span class="release-date">${game.releaseDate || "N/A"}</span>
              </div>
            </div>
            <div class="game-actions">
              <button class="play-button" title="Jogar"><i class="fas fa-play"></i></button>
              <button class="favorite-button ${favoriteClass}" title="Favorito"><i class="fas fa-heart"></i></button>
            </div>
          </div>
        `;
      });
    } else {
      html += `
        <div class="empty-state">
          <p>Nenhum jogo encontrado para este sistema.</p>
        </div>
      `;
    }

    html += `</div>`;

    return html;
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

      const systemName =
        typeof this.currentSystem === "string"
          ? this.currentSystem
          : this.currentSystem.name;

      console.log(`Sistema atual:`, systemName);

      // Mostrar tela de carregamento
      this.showGameLaunchingScreen(game, systemName);

      // Método primário: usar a API direta para lançar o jogo
      console.log("Tentando lançar jogo via API direta...");
      if (window.api && typeof window.api.launchGame === "function") {
        // Preparar dados do jogo para lançamento
        const gameData = {
          systemName: systemName,
          gamePath: game.path,
          gameId: game.id,
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
          return result;
        } else {
          const errorMsg =
            result?.error || "Erro desconhecido ao lançar o jogo";
          console.error(errorMsg);
          alert(errorMsg);
          this.hideGameLaunchingScreen();
          return { success: false, error: errorMsg };
        }
      }

      // Se a API direta não estiver disponível, mostrar erro
      console.error("API launchGame não disponível");
      alert(
        "Função para lançar jogos não está disponível. Verifique a configuração do aplicativo."
      );
      this.hideGameLaunchingScreen();
      return { success: false, error: "API launchGame não disponível" };
    } catch (error) {
      console.error("Erro ao lançar jogo:", error);
      alert(`Erro ao lançar jogo: ${error.message}`);
      this.hideGameLaunchingScreen();
      return { success: false, error: error.message };
    }
  }

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
      game.image ||
      game.imagePath ||
      this.app.themeManager.getGameImagePath(systemName, game.id);
    const systemLogo = this.app.themeManager.getSystemLogoPath(systemName);

    console.log("Imagem do jogo:", gameImagePath);
    console.log("Logo do sistema:", systemLogo);

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
        title.textContent = game.name || game.title || "Jogo sem título";

      if (image) {
        const imagePath =
          game.image ||
          game.imagePath ||
          this.app.themeManager.getGameImagePath(
            this.currentSystem.name,
            game.id
          );
        image.src = imagePath;
        image.onerror = () => {
          image.src = "assets/icons/default-game.png";
        };
      }

      if (developer) developer.textContent = game.developer || "Desconhecido";
      if (releaseDate) releaseDate.textContent = game.releaseDate || "N/A";
      if (genre) genre.textContent = game.genre || "N/A";
      if (description)
        description.textContent =
          game.description || game.desc || "Sem descrição disponível";

      // Configurar botão de jogar
      if (playButton) {
        playButton.onclick = async () => {
          modal.classList.remove("active");
          console.log(`Chamando método launchGame com:`, game);
          await this.launchGame(game);
        };
      }

      // Configurar botão de favorito se existir
      if (favoriteButton) {
        const isFavorite = game.favorite === true;
        favoriteButton.classList.toggle("active", isFavorite);
        favoriteButton.innerHTML = isFavorite
          ? '<i class="fas fa-heart"></i>'
          : '<i class="far fa-heart"></i>';

        favoriteButton.onclick = async () => {
          const systemName =
            typeof this.currentSystem === "string"
              ? this.currentSystem
              : this.currentSystem.name;
          const newFavoriteStatus = !isFavorite;

          console.log(
            `Atualizando status de favorito: Jogo=${game.id}, Sistema=${systemName}, Novo status=${newFavoriteStatus}`
          );

          const result = await this.updateFavorite(
            game,
            systemName,
            newFavoriteStatus
          );

          if (result && result.success) {
            console.log("Favorito atualizado com sucesso");
            // Atualizar o estado do botão
            game.favorite = newFavoriteStatus;
            favoriteButton.classList.toggle("active", newFavoriteStatus);
            favoriteButton.innerHTML = newFavoriteStatus
              ? '<i class="fas fa-heart"></i>'
              : '<i class="far fa-heart"></i>';

            // Atualizar o ícone de favorito no card do jogo
            const gameCard = document.querySelector(
              `.game-card[data-id="${game.id}"]`
            );
            const favoriteIcon = gameCard?.querySelector(".favorite-icon");
            if (favoriteIcon) {
              favoriteIcon.classList.toggle("active", newFavoriteStatus);
            }
          } else {
            console.error(
              "Erro ao atualizar favorito:",
              result?.error || "Erro desconhecido"
            );
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

  async updateFavorite(game, systemName, newStatus) {
    try {
      console.log(
        `Atualizando status de favorito: Jogo=${
          typeof game === "string" ? game : game.id
        }, Sistema=${systemName}, Novo status=${newStatus}`
      );

      // Verificar se temos a função updateGameFavorite na API
      if (window.api && typeof window.api.updateGameFavorite === "function") {
        const gameId = typeof game === "string" ? game : game.id;
        const result = await window.api.updateGameFavorite(
          systemName,
          gameId,
          newStatus
        );
        return result;
      }

      // Se não tiver função na API, apenas atualizar localmente
      console.warn(
        "API updateGameFavorite não disponível, atualizando apenas localmente"
      );

      if (typeof game !== "string") {
        game.favorite = newStatus;
      }

      return { success: true, message: "Favorito atualizado localmente" };
    } catch (error) {
      console.error("Erro ao atualizar favorito:", error);
      return { success: false, error: error.message };
    }
  }

  // Método para obter o caminho real da imagem do jogo
  getGameImagePath(systemName, gameId) {
    // Retornar caminho padrão que realmente existe
    return "themes/default/assets/icons/default-game.png";
  }
}
