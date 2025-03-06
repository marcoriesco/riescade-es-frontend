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
      // API do Electron não disponível
    }
  }

  async loadGames(systemName) {
    if (!this.container) {
      this.container = document.querySelector(".gamelist-container");
      if (!this.container) {
        // Container da lista de jogos não encontrado
        return false;
      }
    }

    await this.showLoading("Carregando jogos...");
    this.currentSystem = systemName;
    this.games = []; // Initialize games array

    try {
      // Verificar qual API está disponível
      const hasIpcApi = window.api && typeof window.api.invoke === "function";
      const hasLocalApi =
        window.api && window.api.localApi && window.api.localApi.games;
      const hasReadGameList =
        window.api && typeof window.api.readGameList === "function";

      let response = null;

      // Tentar carregar usando a API IPC
      if (hasIpcApi) {
        try {
          response = await window.api.invoke(
            "api:games:getGamesBySystem",
            systemName
          );
        } catch (ipcError) {
          // Erro na API IPC
        }
      }

      // Se não conseguiu via IPC, tentar API Local
      if (!response && hasLocalApi) {
        try {
          response = await window.api.localApi.games.getBySystem(systemName);
        } catch (localApiError) {
          // Erro na API Local
        }
      }

      // Se não conseguiu via API Local, tentar readGameList
      if (!response && hasReadGameList) {
        try {
          response = await window.api.readGameList(systemName);
        } catch (readError) {
          // Erro no readGameList
        }
      }

      // Processar a resposta se houver
      if (response && !response.error) {
        if (response.gameList && response.gameList.game) {
          this.games = Array.isArray(response.gameList.game)
            ? response.gameList.game
            : [response.gameList.game];
        } else if (Array.isArray(response)) {
          this.games = response;
        } else if (typeof response === "object") {
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

      // Se nenhum método funcionou, tentar o método legado
      if (this.games.length === 0) {
        const legacyGames = await this.loadGamesWithLegacyMethod(systemName);
        if (legacyGames && legacyGames.length > 0) {
          this.games = legacyGames;
        }
      }

      // Processar os jogos carregados
      if (this.games.length > 0) {
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
      } else {
        this.showEmptyState(
          `Nenhum jogo encontrado para o sistema ${systemName}`
        );
        return false;
      }

      // Renderizar a lista de jogos
      try {
        const renderedGameList = await this.app.themeManager.renderGameListView(
          this.currentSystem,
          this.games
        );

        if (renderedGameList) {
          this.container.innerHTML = renderedGameList;
          this.hideLoading();
          this.app.themeManager.applyGameListTheme(systemName);
          this.addGameListEvents();
          return true;
        } else {
          throw new Error("HTML não retornado pelo renderizador");
        }
      } catch (renderError) {
        // Erro ao renderizar lista de jogos
        this.showEmptyState(
          `Erro ao renderizar lista de jogos: ${renderError.message}`
        );
        return false;
      }
    } catch (error) {
      // Erro ao carregar jogos
      this.hideLoading();
      this.showEmptyState(
        `Erro ao carregar jogos do sistema ${systemName}. ${error.message}`
      );
      return false;
    }
  }

  async loadGamesWithLegacyMethod(systemName) {
    try {
      // Tentar obter jogos via ConfigParser
      const games = await this.configParser.getGames(systemName);

      if (!games || games.length === 0) {
        return [];
      }

      this.games = games;
      return games;
    } catch (error) {
      // Erro ao carregar jogos via método legado
      return [];
    }
  }

  async showLoading(message = "Carregando...") {
    try {
      // Verificar se já existe um botão de volta
      if (!document.getElementById("back-to-systems")) {
        // Criar botão de volta para sistemas
        const backButton = document.createElement("button");
        backButton.id = "back-to-systems";
        backButton.className = "back-button";
        backButton.textContent = "Voltar";
        backButton.style.position = "absolute";
        backButton.style.top = "10px";
        backButton.style.left = "10px";
        backButton.style.zIndex = "100";
        backButton.style.padding = "8px 16px";
        backButton.style.backgroundColor = "#333";
        backButton.style.color = "#fff";
        backButton.style.border = "none";
        backButton.style.borderRadius = "4px";
        backButton.style.cursor = "pointer";

        backButton.addEventListener("click", () => {
          this.backToSystems();
        });

        this.container.parentNode.appendChild(backButton);
      }

      // Remover qualquer loading existente
      const existingLoading = this.container.querySelector(".loading-message");
      if (existingLoading) {
        existingLoading.remove();
      }

      // Usar o ThemeManager para renderizar o template de loading
      const loadingHtml = await this.app.themeManager.renderLoadingTemplate({
        title: "Carregando Jogos",
        message: message,
        systemLogo: this.currentSystem
          ? `themes/default/assets/logos/${this.currentSystem}.png`
          : null,
      });

      // Atualizar o container com o HTML renderizado
      this.container.innerHTML = loadingHtml;
    } catch (error) {
      // Fallback em caso de erro no template
      const loadingElement = document.createElement("div");
      loadingElement.className = "loading-message";
      loadingElement.innerHTML = `
        <div class="loading-spinner"></div>
        <p>${message}</p>
      `;

      this.container.innerHTML = "";
      this.container.appendChild(loadingElement);
    }
  }

  hideLoading() {
    const loadingElement = this.container.querySelector(".loading-message");
    if (loadingElement) {
      loadingElement.remove();
    }
  }

  showEmptyState(message = "Nenhum jogo encontrado.") {
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
        this.backToSystems();
      });
    }
  }

  addGameListEvents() {
    // Back button
    const backButton = document.getElementById("back-to-systems");
    if (backButton) {
      backButton.addEventListener("click", () => {
        this.backToSystems();
      });
    }

    // Adicionar eventos aos cards de jogos
    const gameCards = this.container.querySelectorAll(".game-card");

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

        // Encontrar o jogo correspondente
        const game =
          this.games[index] ||
          this.games.find((g) => g.id === gameId || g.path === gamePath);

        if (game) {
          this.launchGame(game);
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

          // Encontrar o jogo correspondente
          const game =
            this.games[index] ||
            this.games.find((g) => g.id === gameId || g.path === gamePath);

          if (game) {
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

          // Encontrar o jogo correspondente
          const game =
            this.games[index] ||
            this.games.find((g) => g.id === gameId || g.path === gamePath);

          if (game) {
            const newStatus = !game.favorite;

            // Atualizar status de favorito
            const result = await this.updateFavorite(
              game,
              this.currentSystem.name,
              newStatus
            );

            if (result && result.success) {
              game.favorite = newStatus;
              favoriteButton.classList.toggle("active", newStatus);
            } else {
              console.error(
                "Erro ao atualizar status de favorito:",
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
  }

  setupSearchFunctionality() {
    const searchInput = this.container.querySelector("#game-search");
    const clearButton = this.container.querySelector("#clear-search");

    if (!searchInput) {
      return;
    }

    // Função para realizar a pesquisa
    const performSearch = () => {
      const searchTerm = searchInput.value.toLowerCase().trim();

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
        searchInput.value = "";
        performSearch();
        searchInput.focus();
      });

      // Inicialmente esconder o botão de limpar
      clearButton.style.display = "none";
    }
  }

  async renderGameListView(system, games) {
    try {
      // Garantir que games é sempre um array
      const gamesList = games || [];

      // Carregar o template da lista de jogos
      const template = await this.loadTemplate("gamelist");

      if (!template) {
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
              game.image || "src/themes/default/assets/icons/default-game.png";
            const favoriteClass = game.favorite ? "active" : "";

            html += `
              <div class="game-card" data-game-id="${
                game.id || ""
              }" data-game-path="${game.path || ""}">
                <div class="game-image">
                  <img src="${imagePath}" alt="${
              game.name || "Jogo"
            }" onerror="this.src='src/themes/default/assets/icons/default-game.png'">
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
              game.image ||
              game.imagePath ||
              "src/themes/default/assets/icons/default-game.png";
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
        }" onerror="this.src='src/themes/default/assets/icons/default-game.png'">
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
    try {
      // Verificar se temos um sistema atual
      if (!this.currentSystem) {
        throw new Error("Nenhum sistema selecionado.");
      }

      // Mostrar tela de carregamento
      await this.showGameLaunchingScreen(game, this.currentSystem);

      // Preparar dados para a API
      const gameData = {
        path: game.path,
        name: game.name,
        systemName: this.currentSystem,
        gameId: game.id,
      };

      // Log de API (mantido conforme solicitação)
      console.log(`Dados de API para lançamento do jogo:`, gameData);

      // Chamar a API para lançar o jogo
      const result = await window.api.launchGame(gameData);

      // Log de retorno da API (mantido conforme solicitação)
      console.log(`Retorno da API de lançamento:`, result);

      // Esconder a tela de carregamento após o lançamento do jogo
      setTimeout(() => {
        this.hideGameLaunchingScreen();
      }, 2000); // Esconde após 2 segundos para dar tempo do jogo iniciar

      // Verificar resultado
      if (result && result.error) {
        throw new Error(`Erro ao lançar jogo: ${result.error}`);
      }

      return true;
    } catch (error) {
      console.error(`Erro ao lançar jogo: ${error.message}`);
      // Esconder a tela de carregamento em caso de erro
      this.hideGameLaunchingScreen();
      return false;
    }
  }

  async showGameLaunchingScreen(game, systemName) {
    try {
      console.log("Iniciando lançamento de jogo:", game.name);

      // Remover overlay existente, se houver
      this.hideGameLaunchingScreen();

      // Adicionar animação de spinner ao head se não existir
      if (!document.getElementById("spinnerAnimation")) {
        const styleTag = document.createElement("style");
        styleTag.id = "spinnerAnimation";
        styleTag.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(styleTag);
      }

      // Obter caminhos de imagens com fallback para imagens padrão
      const gameImagePath =
        game.image ||
        (this.app.themeManager.getDefaultGameImage
          ? this.app.themeManager.getDefaultGameImage()
          : "themes/default/assets/icons/default-game.png");

      // Usar caminho com prefixo completo e fornecer fallback
      const systemLogo = `themes/${
        this.app.themeManager.currentTheme || "default"
      }/assets/logos/${systemName}.png`;

      console.log("Paths de imagem:", { gameImagePath, systemLogo });

      // Usar uma abordagem simplificada com estilos inline para garantir que a tela apareça
      const overlay = document.createElement("div");
      overlay.id = "gameLaunchOverlay";

      // Aplicar estilos inline para garantir que funcione independente do CSS
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
      overlay.style.display = "flex";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.zIndex = "2000";
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s ease-in-out";

      const content = document.createElement("div");
      content.style.textAlign = "center";
      content.style.padding = "30px";
      content.style.maxWidth = "80%";

      content.innerHTML = `
        <div style="margin-bottom: 20px; height: 80px; display: flex; justify-content: center; align-items: center;">
          <img src="${systemLogo}" alt="${systemName}" style="max-height: 100%; max-width: 100%;" onerror="this.onerror=null;this.src='themes/default/assets/icons/default-system.png';" />
        </div>
        <h2 style="margin-bottom: 15px; font-size: 2em; color: #1a88ff;">Iniciando Jogo</h2>
        <p style="margin-bottom: 20px; font-size: 1.2em; color: #ccc;">${game.name}</p>
        <div style="margin: 0 auto 20px; max-width: 400px; height: 300px; display: flex; justify-content: center; align-items: center;">
          <img src="${gameImagePath}" alt="${game.name}" style="max-height: 100%; max-width: 100%; border-radius: 5px;" onerror="this.onerror=null;this.src='themes/default/assets/icons/default-game.png';" />
        </div>
        <div style="width: 60px; height: 60px; border: 5px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: #1a88ff; animation: spin 1s linear infinite; margin: 20px auto;"></div>
        <p style="margin-bottom: 20px; font-size: 1.2em; color: #ccc;">Carregando, por favor aguarde...</p>
      `;

      overlay.appendChild(content);

      // Adicionar ao corpo do documento
      document.body.appendChild(overlay);
      console.log("Overlay adicionado ao DOM");

      // Mostrar com fade-in de forma segura
      setTimeout(() => {
        const addedOverlay = document.getElementById("gameLaunchOverlay");
        if (addedOverlay) {
          console.log("Adicionando visibilidade ao overlay");
          addedOverlay.style.opacity = "1";
          addedOverlay.style.pointerEvents = "all";
        } else {
          console.error("Overlay não encontrado após timeout");
        }
      }, 50);
    } catch (error) {
      console.error("Erro ao mostrar tela de lançamento de jogo:", error);

      // Fallback em caso de erro no template
      const overlay = document.createElement("div");
      overlay.id = "gameLaunchOverlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
      overlay.style.display = "flex";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.zIndex = "2000";
      overlay.style.opacity = "0";
      overlay.style.transition = "opacity 0.3s ease-in-out";

      overlay.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <h2 style="margin-bottom: 15px; font-size: 2em; color: #1a88ff;">Iniciando Jogo</h2>
          <p style="margin-bottom: 20px; font-size: 1.2em; color: #ccc;">${game.name}</p>
          <div style="width: 60px; height: 60px; border: 5px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: #1a88ff; animation: spin 1s linear infinite; margin: 20px auto;"></div>
        </div>
      `;

      document.body.appendChild(overlay);

      setTimeout(() => {
        const addedOverlay = document.getElementById("gameLaunchOverlay");
        if (addedOverlay) {
          addedOverlay.style.opacity = "1";
          addedOverlay.style.pointerEvents = "all";
        }
      }, 50);
    }
  }

  hideGameLaunchingScreen() {
    const overlay = document.getElementById("gameLaunchOverlay");
    if (overlay) {
      // Fade-out com estilos inline
      overlay.style.opacity = "0";
      overlay.style.pointerEvents = "none";

      // Remover do DOM após a animação
      setTimeout(() => {
        // Verificar novamente se o elemento ainda existe
        const overlayElement = document.getElementById("gameLaunchOverlay");
        if (overlayElement && overlayElement.parentNode) {
          overlayElement.parentNode.removeChild(overlayElement);
        }
      }, 300);
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
    return "src/themes/default/assets/icons/default-game.png";
  }

  // Método para voltar para a tela de sistemas
  backToSystems() {
    console.log("Voltando para a tela de sistemas");
    if (this.app && this.app.themeManager) {
      this.app.themeManager.changeView("system");
    }
  }
}
