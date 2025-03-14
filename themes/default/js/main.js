/**
 * Script principal para o tema padrão do RIESCADE
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("Iniciando tema web do RIESCADE...");

  // Inicializar API
  initAPI();

  // Configurar relógio do sistema
  initSystemClock();

  // Configurar navegação por teclado
  initKeyboardNavigation();

  // Aplicar configurações visuais do tema
  applyThemeSettings();
});

/**
 * Converte caminhos absolutos de arquivos em URLs relativas para uso no navegador
 * @param {string} path - Caminho da imagem ou mídia
 * @returns {string} - URL relativa para o servidor
 */
function convertPathToUrl(path) {
  if (!path) return "";

  // Se já é uma URL, manter como está
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("/")
  ) {
    return path;
  }

  // Se for um caminho absoluto do sistema (como Y:\imagens\...)
  if (path.match(/^[a-zA-Z]:\\/) || path.startsWith("/")) {
    // Extrair a parte do caminho após 'roms'
    const parts = path.split(/[\/\\]/);
    const romsIndex = parts.findIndex((part) => part === "roms");

    if (romsIndex >= 0 && romsIndex < parts.length - 1) {
      // Reconstruir o caminho relativo
      const relativePath = parts.slice(romsIndex + 1).join("/");
      return `/roms-media/${relativePath}`;
    }
  }

  // Se chegou aqui, retorna o caminho original
  return path;
}

/**
 * Inicializa a API do RIESCADE
 */
function initAPI() {
  // Mostrar loader
  showLoader();

  // Inicializar API
  ESAPI.onReady(() => {
    // Carregar plataformas
    loadPlatforms();

    // Configurar callbacks
    ESAPI.onPlatformSelect((platformId) => {
      loadGames(platformId);
    });

    ESAPI.onGameSelect((gameId) => {
      showGameDetails(gameId);
    });

    ESAPI.onGameLaunch((gameId) => {
      showGameLoading(gameId);
    });

    // Adicionar callback para mudanças nas configurações
    ESAPI.onSettingsChange(() => {
      console.log("Configurações alteradas, atualizando interface...");

      // Atualizar configurações visuais com forceRefresh=true para obter as configurações mais recentes
      applyThemeSettings(true);

      // Atualizar visibilidade do relógio
      if (ESAPI.updateClockVisibility) {
        ESAPI.updateClockVisibility();
      }
    });

    // Esconder loader quando tudo estiver pronto
    hideLoader();
  });

  // Iniciar a API
  ESAPI.init().catch((error) => {
    alert(
      "Erro ao inicializar o sistema. Verifique o console para mais detalhes."
    );
  });
}

/**
 * Inicializa o relógio do sistema
 */
function initSystemClock() {
  // Verificar se o relógio deve ser exibido com base nas configurações do tema
  const checkClockVisibility = () => {
    // Obter as configurações do tema atual
    ESAPI.getThemeSettings()
      .then((settings) => {
        console.log("Configurações do tema carregadas:", settings);

        // Verificar a configuração show_clock
        const showClock =
          settings.show_clock !== undefined ? settings.show_clock : true;
        console.log("Exibir relógio:", showClock);

        // Obter todos os elementos de relógio
        const clockElements = [
          document.getElementById("system-time"),
          document.getElementById("system-time-games"),
        ].filter((el) => el); // Filtrar elementos nulos

        // Atualizar a visibilidade dos relógios
        clockElements.forEach((clock) => {
          clock.style.display = showClock ? "block" : "none";
        });

        // Se o relógio estiver visível, atualizar o tempo
        if (showClock) {
          updateClockTime();
        }
      })
      .catch((error) => {
        console.error("Erro ao carregar configurações do tema:", error);
        // Em caso de erro, manter o relógio visível por padrão
        updateClockTime();
      });
  };

  // Função para atualizar o tempo exibido no relógio
  const updateClockTime = () => {
    const now = new Date();
    let timeString;

    const settings = ESAPI.getSettings();
    const format = settings?.ui?.ClockFormat || "24";

    if (format === "12") {
      timeString = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } else {
      timeString = now.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    // Atualizar todos os elementos de relógio
    const systemTime = document.getElementById("system-time");
    if (systemTime) {
      systemTime.textContent = timeString;
    }

    const gamesTimeClock = document.getElementById("system-time-games");
    if (gamesTimeClock) {
      gamesTimeClock.textContent = timeString;
    }
  };

  // Verificar a visibilidade do relógio inicialmente
  checkClockVisibility();

  // Atualizar o relógio a cada minuto
  setInterval(() => {
    // Verificar a visibilidade e atualizar o tempo
    checkClockVisibility();
  }, 60000);

  // Adicionar um método à API ESAPI para atualizar a visibilidade do relógio
  // quando as configurações do tema forem alteradas
  if (!ESAPI.updateClockVisibility) {
    ESAPI.updateClockVisibility = checkClockVisibility;
  }
}

/**
 * Inicializa a navegação por teclado
 */
function initKeyboardNavigation() {
  // Definir a tela atual como uma propriedade global
  window.currentScreen = "platforms-screen";
  let selectedPlatformIndex = 0;
  window.selectedGameIndex = 0;

  document.addEventListener("keydown", (e) => {
    // Ignorar eventos de teclado se o loader estiver visível
    if (document.getElementById("loader").style.display !== "none") {
      return;
    }

    console.log(
      "Tecla pressionada:",
      e.key,
      "Tela atual:",
      window.currentScreen
    );

    // Tecla F para favoritar jogos
    if (e.key === "f" && window.currentScreen === "games-screen") {
      const selectedGame = document.querySelector(".game-item.selected");
      if (selectedGame) {
        const gameId = selectedGame.dataset.id;
        toggleFavorite(gameId);
      }
      return;
    }

    // Tecla Escape para voltar
    if (e.key === "Escape") {
      switch (window.currentScreen) {
        case "games-screen":
          showScreen("platforms-screen");
          window.currentScreen = "platforms-screen";
          break;
        case "game-loading-screen":
          // Cancelar carregamento do jogo
          showScreen("games-screen");
          window.currentScreen = "games-screen";
          break;
      }
      return;
    }

    // Tecla Enter para selecionar
    if (e.key === "Enter") {
      switch (window.currentScreen) {
        case "platforms-screen":
          const selectedPlatform = document.querySelector(
            ".platform-card.selected"
          );
          if (selectedPlatform) {
            const platformId = selectedPlatform.dataset.id;
            ESAPI.selectPlatform(platformId);
            showScreen("games-screen");
            window.currentScreen = "games-screen";
          }
          break;
        case "games-screen":
          const selectedGame = document.querySelector(".game-item.selected");
          if (selectedGame) {
            const gameId = selectedGame.dataset.id;
            ESAPI.launchGame(gameId);
          }
          break;
      }
      return;
    }

    // Navegação com setas
    switch (window.currentScreen) {
      case "platforms-screen":
        navigatePlatforms(e);
        break;
      case "games-screen":
        navigateGames(e);
        break;
    }
  });

  /**
   * Navega entre as plataformas usando as teclas de seta
   * @param {KeyboardEvent} e - Evento de teclado
   */
  function navigatePlatforms(e) {
    const platformElements = document.querySelectorAll(".platform-card");
    const container = document.querySelector(".platforms-grid");

    if (platformElements.length === 0) return;

    // Garantir que haja uma plataforma selecionada
    if (
      !document.querySelector(".platform-card.selected") &&
      platformElements.length > 0
    ) {
      platformElements[0].classList.add("selected");
      selectedPlatformIndex = 0;
    }

    let newIndex = selectedPlatformIndex;

    // Determinar a quantidade de plataformas por linha
    const platformWidth = platformElements[0].offsetWidth;
    const containerWidth = container.offsetWidth;
    const platformsPerRow = Math.floor(containerWidth / platformWidth) || 4;

    switch (e.key) {
      case "ArrowUp":
        newIndex = Math.max(0, selectedPlatformIndex - platformsPerRow);
        break;
      case "ArrowDown":
        newIndex = Math.min(
          platformElements.length - 1,
          selectedPlatformIndex + platformsPerRow
        );
        break;
      case "ArrowLeft":
        newIndex = Math.max(0, selectedPlatformIndex - 1);
        break;
      case "ArrowRight":
        newIndex = Math.min(
          platformElements.length - 1,
          selectedPlatformIndex + 1
        );
        break;
    }

    if (newIndex !== selectedPlatformIndex) {
      // Remover seleção anterior
      platformElements[selectedPlatformIndex].classList.remove("selected");

      // Atualizar índice e adicionar seleção
      selectedPlatformIndex = newIndex;
      platformElements[selectedPlatformIndex].classList.add("selected");

      // Garantir que a plataforma selecionada esteja visível
      platformElements[selectedPlatformIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  /**
   * Navega entre os jogos usando as teclas de seta
   * @param {KeyboardEvent} e - Evento de teclado
   */
  function navigateGames(e) {
    const games = document.querySelectorAll(".game-item");
    const container = document.getElementById("games-list");

    if (games.length === 0) return;

    // Garantir que haja um jogo selecionado
    if (!document.querySelector(".game-item.selected") && games.length > 0) {
      games[0].classList.add("selected");
      window.selectedGameIndex = 0;

      // Mostrar detalhes do primeiro jogo
      const gameId = games[0].dataset.id;
      ESAPI.selectGame(gameId);
    }

    let newIndex = window.selectedGameIndex;

    switch (e.key) {
      case "ArrowUp":
      case "ArrowLeft":
        newIndex = Math.max(0, window.selectedGameIndex - 1);
        break;
      case "ArrowDown":
      case "ArrowRight":
        newIndex = Math.min(games.length - 1, window.selectedGameIndex + 1);
        break;
    }

    if (newIndex !== window.selectedGameIndex) {
      console.log(`Navegando de ${window.selectedGameIndex} para ${newIndex}`);

      // Remover seleção anterior
      games[window.selectedGameIndex].classList.remove("selected");

      // Atualizar índice e adicionar seleção
      window.selectedGameIndex = newIndex;
      games[window.selectedGameIndex].classList.add("selected");

      // Garantir que o jogo selecionado esteja visível
      games[window.selectedGameIndex].scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });

      // Mostrar detalhes do jogo selecionado
      const gameId = games[window.selectedGameIndex].dataset.id;
      ESAPI.selectGame(gameId);
    }
  }
}

/**
 * Carrega e exibe as plataformas disponíveis
 */
function loadPlatforms() {
  const platformsGrid = document.getElementById("platforms-grid");
  platformsGrid.innerHTML = "";

  const platforms = ESAPI.getPlatforms();

  if (!platforms || platforms.length === 0) {
    console.log("Nenhuma plataforma encontrada, adicionando mensagem");
    platformsGrid.innerHTML =
      "<div class='no-platforms'>Nenhuma plataforma encontrada</div>";
    return;
  }

  platforms.forEach((platform) => {
    const card = document.createElement("div");
    card.className = "platform-card";
    card.dataset.id = platform.id;

    // Imagem da plataforma
    const imageDiv = document.createElement("div");
    imageDiv.className = "platform-image";

    const img = document.createElement("img");
    img.src = `/themes/default/img/logos/${platform.id}.png`;
    img.alt = platform.name;
    img.onerror = function () {
      console.log(
        `Erro ao carregar imagem para ${platform.id}, usando placeholder`
      );
      // Verificar se já estamos tentando carregar o placeholder para evitar loop
      if (this.src.includes("placeholder.png")) {
        console.log(
          "Já estamos tentando carregar o placeholder, não vamos tentar novamente"
        );
        return;
      }
      this.src = "/themes/default/img/placeholder.png";
      // Remover o handler de erro para evitar loops
      this.onerror = null;
    };

    imageDiv.appendChild(img);

    // Informações da plataforma
    const info = document.createElement("div");
    info.className = "platform-info";

    const name = document.createElement("h2");
    name.textContent = platform.name;

    info.appendChild(name);

    // Adicionar à card
    card.appendChild(imageDiv);
    card.appendChild(info);

    // Evento de clique modificado para validar gamelist antes de carregar
    card.addEventListener("click", async () => {
      // Mostrar loader enquanto validamos
      showLoader();

      try {
        // Validar a gamelist
        await validateGamelistIDs(platform.id);

        // Selecionar a plataforma após a validação
        ESAPI.selectPlatform(platform.id);
      } catch (error) {
        console.error(`Erro ao validar gamelist para ${platform.id}:`, error);

        // Mesmo com erro, tentar carregar a plataforma
        ESAPI.selectPlatform(platform.id);

        // Não esconder o loader aqui, deixar que loadGames faça isso
      }
    });

    // Adicionar à grid
    platformsGrid.appendChild(card);
  });

  // Mostrar tela de plataformas
  showScreen("platforms-screen");

  // Selecionar a primeira plataforma
  const platformElements = document.querySelectorAll(".platform-card");
  if (platformElements.length > 0) {
    platformElements[0].classList.add("selected");
  }
}

/**
 * Carrega e exibe os jogos de uma plataforma
 * @param {string} platformId - ID da plataforma
 */
function loadGames(platformId) {
  try {
    // Mostrar loader enquanto carrega os jogos
    showLoader();

    const gamesList = document.getElementById("games-list");
    gamesList.innerHTML = "";

    // Obter a plataforma
    const platform = ESAPI.getPlatform(platformId);
    console.log("Plataforma obtida:", platform);

    if (!platform) {
      console.error("Plataforma não encontrada:", platformId);
      gamesList.innerHTML =
        "<div class='no-games'>Plataforma não encontrada</div>";
      hideLoader();
      return;
    }

    document.getElementById("platform-name").textContent = platform.name;

    // Obter os jogos
    const games = ESAPI.getGames(platformId);
    console.log("Jogos obtidos:", games);

    document.getElementById(
      "games-count"
    ).textContent = `${games.length} jogos`;

    if (!games || games.length === 0) {
      console.log("Nenhum jogo encontrado para a plataforma:", platformId);
      gamesList.innerHTML =
        "<div class='no-games'>Nenhum jogo encontrado</div>";

      // Mostrar a tela de jogos mesmo sem jogos
      showScreen("games-screen");
      hideLoader();
      return;
    }

    // Para cada jogo, criar um item na lista
    games.forEach((game) => {
      console.log("Processando jogo:", game);

      const item = document.createElement("div");
      item.className = "game-item";
      item.dataset.id = game.id;

      // Thumbnail
      const thumbnail = document.createElement("div");
      thumbnail.className = "game-item-thumbnail";

      const gameCarouselImage = game.mix ? game.mix : game.marquee;
      const gameCarouselClass = game.mix
        ? "game-item-mix"
        : "game-item-marquee";

      if (gameCarouselImage) {
        const img = document.createElement("img");
        img.src = gameCarouselImage;
        img.alt = game.name;
        img.className = gameCarouselClass;
        img.onerror = () => {
          thumbnail.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
        };
        thumbnail.appendChild(img);
      }

      // Informações do jogo
      const info = document.createElement("div");
      info.className = "game-item-info";

      const title = document.createElement("div");
      title.className = "game-item-title";
      title.textContent = game.name;

      const details = document.createElement("div");
      details.className = "game-item-details";

      if (game.releaseDate) {
        details.textContent = `${game.releaseDate} • `;
      }

      if (game.publisher) {
        details.textContent += game.publisher;
      } else if (game.developer) {
        details.textContent += game.developer;
      }

      info.appendChild(title);
      info.appendChild(details);

      // Favorito
      if (game.favorite) {
        const favorite = document.createElement("div");
        favorite.className = "game-item-favorite";
        favorite.innerHTML = "⭐";
        item.appendChild(favorite);
      }

      // Montar item
      item.appendChild(thumbnail);
      item.appendChild(info);

      // Adicionar à lista
      gamesList.appendChild(item);
    });

    // Mostrar tela de jogos
    showScreen("games-screen");

    // Definir a tela atual
    window.currentScreen = "games-screen";

    // Inicializar a seleção fixa
    initFixedPositionNavigation();

    // Resetar o índice atual para 0
    window.selectedGameIndex = 0;

    // Atualizar as classes visuais
    const gamesItems = document.querySelectorAll(".game-item");
    updateGameSelectionClasses(gamesItems);

    // Garantir que o primeiro jogo esteja na posição fixa
    if (gamesItems.length > 0) {
      const container = document.getElementById("games-list");
      container.scrollLeft = 0;

      // Selecionar o primeiro jogo
      gamesItems[0].classList.add("selected");

      // Mostrar detalhes do primeiro jogo
      const gameId = gamesItems[0].dataset.id;
      ESAPI.selectGame(gameId);
    }
  } catch (error) {
    console.error("Erro ao carregar jogos:", error);
    alert("Erro ao carregar jogos. Verifique o console para mais detalhes.");
  } finally {
    hideLoader();
  }
}

/**
 * Exibe os detalhes de um jogo com efeito de transição
 * @param {string} gameId - ID do jogo
 */
function showGameDetails(gameId) {
  const gameDetails = ESAPI.getGameDetails(gameId);

  if (!gameDetails) return;

  // Atualizar elementos da UI
  document.getElementById("game-title").textContent = gameDetails.name;
  document.getElementById("game-description").textContent =
    gameDetails.desc || "Sem descrição disponível.";

  // Imagem com efeito de transição
  const gameImage = document.getElementById("game-image");

  // Adicionar classe de fade-out para iniciar a transição
  gameImage.classList.add("fade-out");

  // Usar setTimeout para dar tempo para a animação acontecer
  // antes de atualizar a nova imagem
  setTimeout(() => {
    // Atualizar a fonte da imagem
    if (gameDetails.image) {
      gameImage.src = gameDetails.image;
    } else {
      gameImage.src = "themes/default/img/default.jpg";
    }

    // Força reflow para que a transição de opacity funcione
    void gameImage.offsetWidth;

    // Remover a classe de fade-out para fazer a imagem aparecer
    gameImage.classList.remove("fade-out");
  }, 250); // 250ms para a transição de saída

  // Metadados
  document.getElementById("game-developer").textContent =
    gameDetails.developer || "-";
  document.getElementById("game-publisher").textContent =
    gameDetails.publisher || "-";
  document.getElementById("game-genre").textContent = gameDetails.genre || "-";
  document.getElementById("game-players").textContent =
    gameDetails.players || "-";

  if (gameDetails.releaseDate) {
    document.getElementById("game-release-date").textContent =
      gameDetails.releaseDate;
  }
}

/**
 * Exibe a tela de carregamento de jogo
 * @param {string} gameId - ID do jogo
 */
function showGameLoading(gameId) {
  const gameDetails = ESAPI.getGameDetails(gameId);
  const platform = ESAPI.getPlatform(ESAPI.getCurrentPlatform());

  console.log("GAME DETAILS:", gameDetails);

  document.getElementById(
    "loading-game-background"
  ).style.backgroundImage = `url("${gameDetails.image}")`;
  document.getElementById("loading-game-title").textContent = gameDetails.name;
  document.getElementById("loading-game-system").textContent = platform.name;

  showScreen("game-loading-screen");

  // Configurar um intervalo para verificar se o jogo ainda está em execução
  const statusCheckInterval = setInterval(() => {
    fetch(`/api/games/${gameId}/status`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success && !data.data.running) {
          // O jogo foi encerrado
          clearInterval(statusCheckInterval);

          // Esconder o loader
          hideLoader();

          // Retornar à tela de jogos
          showScreen("games-screen");
          setCurrentScreen("games-screen");

          console.log("Jogo encerrado, retornando à tela de jogos");
        }
      })
      .catch((error) => {
        console.error("Erro ao verificar status do jogo:", error);
        // Em caso de erro, também retornamos à tela de jogos
        clearInterval(statusCheckInterval);
        hideLoader();
        showScreen("games-screen");
        setCurrentScreen("games-screen");
      });
  }, 2000); // Verificar a cada 2 segundos
}

/**
 * Mostra uma tela específica e esconde as outras
 * @param {string} screenId - ID da tela a ser mostrada
 */
function showScreen(screenId) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach((screen) => {
    screen.classList.remove("active");
  });

  document.getElementById(screenId).classList.add("active");
}

/**
 * Mostra o loader
 */
function showLoader() {
  document.getElementById("loader").style.display = "flex";
}

/**
 * Esconde o loader
 */
function hideLoader() {
  document.getElementById("loader").style.opacity = "0";
  setTimeout(() => {
    document.getElementById("loader").style.display = "none";
  }, 300);
}

/**
 * Alterna o status de favorito de um jogo
 * @param {string} gameId - ID do jogo
 */
function toggleFavorite(gameId) {
  const gameDetails = ESAPI.getGameDetails(gameId);

  if (!gameDetails) return;

  // Todo: Implementar toggle de favorito via API
  console.log(`Alternando favorito para ${gameDetails.name}`);
}

/**
 * Valida a gamelist.xml de uma plataforma e corrige IDs ausentes
 * @param {string} platformId - ID da plataforma
 * @returns {Promise<Object>} Resultado da validação
 */
async function validateGamelistIDs(platformId) {
  try {
    console.log(`Validando gamelist.xml para plataforma ${platformId}...`);

    // Fazer uma requisição para a API de validação
    const response = await fetch(
      `/api/platforms/${platformId}/validate-gamelist`
    );

    if (!response.ok) {
      throw new Error(
        `Erro ao validar gamelist: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.success) {
      if (data.changes) {
        console.log(
          `gamelist.xml para ${platformId} foi corrigida: ${data.message}`
        );
      } else {
        console.log(`gamelist.xml para ${platformId} está OK: ${data.message}`);
      }
    } else {
      console.error(`Erro na validação: ${data.message}`);
    }

    return data;
  } catch (error) {
    console.error(`Erro ao validar gamelist para ${platformId}:`, error);
    throw error;
  }
}

/**
 * Função para verificar se a imagem existe e carregar com fallback
 * @param {HTMLElement} thumbnail - O elemento de miniatura do jogo
 * @param {string} primaryImagePath - O caminho da imagem primária
 * @param {string} fallbackImagePath - O caminho da imagem de fallback
 * @param {string} gameName - O nome do jogo
 */
function loadImageWithFallback(
  thumbnail,
  primaryImagePath,
  fallbackImagePath,
  gameName
) {
  // Converter caminhos para URLs
  const primaryUrl = convertPathToUrl(primaryImagePath);
  const fallbackUrl = convertPathToUrl(fallbackImagePath);

  // Tentar carregar a imagem primária
  thumbnail.src = primaryUrl;
  thumbnail.alt = gameName;

  // Se a imagem primária falhar, tentar a imagem de fallback
  thumbnail.onerror = function () {
    console.log(
      `Erro ao carregar imagem primária para ${gameName}, tentando fallback`
    );

    if (fallbackUrl && fallbackUrl !== primaryUrl) {
      thumbnail.src = fallbackUrl;
      thumbnail.onerror = function () {
        console.log(
          `Erro ao carregar imagem de fallback para ${gameName}, usando placeholder`
        );
        thumbnail.src = "/themes/default/img/placeholder.png";
        thumbnail.onerror = null; // Remover handler para evitar loops
      };
    } else {
      console.log(`Sem fallback para ${gameName}, usando placeholder`);
      thumbnail.src = "/themes/default/img/placeholder.png";
      thumbnail.onerror = null; // Remover handler para evitar loops
    }
  };
}

// Atualizar as classes visuais dos jogos
const FIXED_SELECTION_INDEX = 0; // A posição do item fixo (0 = primeiro item, 1 = segundo item)

function updateGameSelectionClasses(games) {
  // Remover a classe 'selected' de todos os jogos
  games.forEach((game) => game.classList.remove("selected"));

  // Adicionar a classe ao jogo atual
  if (games[window.selectedGameIndex]) {
    games[window.selectedGameIndex].classList.add("selected");
  }
}

function initFixedPositionNavigation() {
  // Inicializar a seleção fixa ao carregar a lista de jogos
  const gamesContainer = document.getElementById("games-list");

  // Criar o elemento de seleção fixa se ainda não existir
  if (!document.getElementById("fixed-selection")) {
    const fixedSelection = document.createElement("div");
    fixedSelection.id = "fixed-selection";
    fixedSelection.className = "fixed-selection";

    // Inserir antes da lista de jogos
    gamesContainer.parentNode.insertBefore(fixedSelection, gamesContainer);

    // Posicionar adequadamente
    setTimeout(positionFixedSelection, 100);
  }
}

function positionFixedSelection() {
  const gamesContainer = document.getElementById("games-list");
  const fixedSelection = document.getElementById("fixed-selection");
  const gameItems = document.querySelectorAll(".game-item");

  if (gameItems.length === 0 || !fixedSelection) return;

  // Calcular a posição do segundo item (índice 1)
  if (gameItems.length > FIXED_SELECTION_INDEX) {
    const targetItem = gameItems[FIXED_SELECTION_INDEX];
    const containerRect = gamesContainer.getBoundingClientRect();
    const itemRect = targetItem.getBoundingClientRect();

    // Posicionar o elemento de seleção fixa sobre o segundo item
    fixedSelection.style.left = `${
      itemRect.left - containerRect.left + gamesContainer.scrollLeft
    }px`;
    fixedSelection.style.top = `${itemRect.top - containerRect.top}px`;
    fixedSelection.style.width = `${itemRect.width}px`;
    fixedSelection.style.height = `${itemRect.height}px`;

    // Tornar visível
    fixedSelection.style.display = "block";
  }
}

/**
 * Aplica as configurações visuais do tema
 */
function applyThemeSettings(forceRefresh = false) {
  console.log(
    `Aplicando configurações do tema (forceRefresh: ${forceRefresh})...`
  );

  // Obter as configurações do tema atual
  ESAPI.getThemeSettings(forceRefresh)
    .then((settings) => {
      console.log("Aplicando configurações visuais do tema:", settings);

      // Aplicar cor de fundo
      if (settings.background_color) {
        console.log(`Aplicando cor de fundo: ${settings.background_color}`);
        document.body.style.backgroundColor = settings.background_color;

        // Também podemos aplicar a cor a outros elementos
        const mainContainer = document.querySelector(".main-container");
        if (mainContainer) {
          mainContainer.style.backgroundColor = settings.background_color;
        }
      }

      // Aplicar estilo de transição
      if (settings.transition_style) {
        console.log(
          `Aplicando estilo de transição: ${settings.transition_style}`
        );

        // Remover classes de transição existentes
        document.body.classList.remove(
          "transition-fade",
          "transition-slide",
          "transition-none"
        );

        // Adicionar a classe de transição selecionada
        document.body.classList.add(`transition-${settings.transition_style}`);
      }
    })
    .catch((error) => {
      console.error("Erro ao aplicar configurações do tema:", error);
    });
}
