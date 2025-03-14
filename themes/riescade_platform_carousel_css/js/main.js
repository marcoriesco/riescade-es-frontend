/**
 * Script principal para o tema padrão do EmulationStation
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("Iniciando tema web do EmulationStation...");

  // Inicializar API
  initAPI();

  // Configurar relógio do sistema
  initSystemClock();

  // Configurar navegação por teclado
  initKeyboardNavigation();
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
 * Inicializa a API do EmulationStation
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

    // Inicializar tela de configurações
    initSettingsScreen();

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
  const updateClock = () => {
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

    document.getElementById("system-time").textContent = timeString;
    document.getElementById("system-time-games").textContent = timeString;
  };

  // Atualizar relógio imediatamente
  updateClock();

  // Atualizar a cada minuto
  setInterval(updateClock, 60000);
}

/**
 * Inicializa a navegação por teclado
 */
function initKeyboardNavigation() {
  let currentScreen = "platforms-screen";
  let selectedPlatformIndex = -1;
  let selectedGameIndex = 0;

  document.addEventListener("keydown", (event) => {
    switch (currentScreen) {
      case "platforms-screen":
        handlePlatformsNavigation(event);
        break;
      case "games-screen":
        handleGamesNavigation(event);
        break;
      case "settings-screen":
        handleSettingsNavigation(event);
        break;
    }
  });

  function handlePlatformsNavigation(event) {
    const platforms = document.querySelectorAll(".platform-card");
    const container = document.querySelector(".platforms-grid");

    if (platforms.length === 0) return;

    let newIndex = selectedPlatformIndex;

    switch (event.key) {
      case "ArrowUp":
        newIndex = Math.max(0, selectedPlatformIndex - 4);
        break;
      case "ArrowDown":
        newIndex = Math.min(platforms.length - 1, selectedPlatformIndex + 4);
        break;
      case "ArrowLeft":
        newIndex = Math.max(0, selectedPlatformIndex - 1);
        break;
      case "ArrowRight":
        newIndex = Math.min(platforms.length - 1, selectedPlatformIndex + 1);
        break;
      case "Enter":
        if (
          selectedPlatformIndex >= 0 &&
          selectedPlatformIndex < platforms.length
        ) {
          platforms[selectedPlatformIndex].click();
        }
        break;
      case "F1":
        showScreen("settings-screen");
        currentScreen = "settings-screen";
        return;
    }

    if (newIndex !== selectedPlatformIndex) {
      // Remove previous selection
      if (
        selectedPlatformIndex >= 0 &&
        selectedPlatformIndex < platforms.length
      ) {
        platforms[selectedPlatformIndex].classList.remove("selected");
      }

      // Update index and add selection
      selectedPlatformIndex = newIndex;
      platforms[selectedPlatformIndex].classList.add("selected");

      // Rolagem automática
      scrollItemIntoView(platforms[selectedPlatformIndex], container);
    }
  }

  function handleGamesNavigation(event) {
    const games = document.querySelectorAll(".game-item");
    const container = document.querySelector(".ps5-carousel");

    if (games.length === 0) return;

    let newIndex = selectedGameIndex;

    switch (event.key) {
      case "ArrowLeft":
        newIndex = (selectedGameIndex - 1 + games.length) % games.length;
        break;
      case "ArrowRight":
        newIndex = (selectedGameIndex + 1) % games.length;
        break;
      case "Enter":
        if (selectedGameIndex >= 0 && selectedGameIndex < games.length) {
          // Lançar o jogo selecionado
          const gameId = games[selectedGameIndex].dataset.id;
          ESAPI.launchGame(gameId);
        }
        break;
      case "Escape":
        // Voltar para a tela de plataformas
        showScreen("platforms-screen");
        currentScreen = "platforms-screen";
        break;
      case "f":
      case "F":
        if (selectedGameIndex >= 0 && selectedGameIndex < games.length) {
          // Toggle favorito
          const gameId = games[selectedGameIndex].dataset.id;
          toggleFavorite(gameId);
        }
        break;
    }

    if (newIndex !== selectedGameIndex) {
      // Remove a seleção anterior
      if (selectedGameIndex >= 0 && selectedGameIndex < games.length) {
        games[selectedGameIndex].classList.remove("selected");
      }

      // Atualiza o índice e adiciona a seleção
      selectedGameIndex = newIndex;
      games[selectedGameIndex].classList.add("selected");

      // Rola a visualização para mostrar o item selecionado
      scrollPS5Carousel(games[selectedGameIndex], container);

      // Mostrar detalhes do jogo
      const gameId = games[selectedGameIndex].dataset.id;
      ESAPI.selectGame(gameId);
    }
  }

  function handleSettingsNavigation(event) {
    switch (event.key) {
      case "Escape":
        // Voltar para a tela anterior
        showScreen("platforms-screen");
        currentScreen = "platforms-screen";
        break;
    }
  }

  /**
   * Rola o container para garantir que o item selecionado esteja visível
   * @param {HTMLElement} item - O elemento selecionado
   * @param {HTMLElement} container - O container com overflow
   */
  function scrollItemIntoView(item, container) {
    if (!item || !container) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    // Verificar se o item está fora da área visível
    if (itemRect.left < containerRect.left) {
      container.scrollLeft += itemRect.left - containerRect.left - 20;
    } else if (itemRect.right > containerRect.right) {
      container.scrollLeft += itemRect.right - containerRect.right + 20;
    }
  }

  /**
   * Rola o carrossel estilo PS5 para centralizar o item selecionado
   * @param {HTMLElement} item - O elemento selecionado
   * @param {HTMLElement} container - O container do carrossel
   */
  function scrollPS5Carousel(item, container) {
    if (!item || !container) return;

    const containerWidth = container.offsetWidth;
    const itemWidth = item.offsetWidth;
    const itemLeft = item.offsetLeft;

    // Calcular a posição para centralizar o item
    const scrollPosition = itemLeft - containerWidth / 2 + itemWidth / 2;

    // Aplicar rolagem com animação suave
    container.scrollTo({
      left: scrollPosition,
      behavior: "smooth",
    });
  }

  // Função para definir a tela atual
  window.setCurrentScreen = function (screen) {
    currentScreen = screen;

    // Resetar seleções
    if (screen === "platforms-screen") {
      selectedPlatformIndex = 0;
      const platforms = document.querySelectorAll(".platform-card");
      if (platforms.length > 0) {
        platforms.forEach((p) => p.classList.remove("selected"));
        platforms[0].classList.add("selected");
      }
    } else if (screen === "games-screen") {
      selectedGameIndex = 0;
      const games = document.querySelectorAll(".game-item");
      if (games.length > 0) {
        games.forEach((g) => g.classList.remove("selected"));
        games[0].classList.add("selected");

        // Mostrar detalhes do primeiro jogo
        const gameId = games[0].dataset.id;
        ESAPI.selectGame(gameId);

        // Garantir que o primeiro jogo esteja visível
        const container = document.querySelector(".ps5-carousel");
        if (container) {
          container.scrollLeft = 0;
        }
      }
    }
  };
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
  setCurrentScreen("platforms-screen");
}

/**
 * Carrega e exibe os jogos de uma plataforma usando o estilo de carrossel do PS5
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
      setCurrentScreen("games-screen");
      hideLoader();
      return;
    }

    // Criar o container do carrossel estilo PS5
    const carouselContainer = document.createElement("div");
    carouselContainer.className = "ps5-carousel-container";
    gamesList.appendChild(carouselContainer);

    // Criar o carrossel
    const carousel = document.createElement("div");
    carousel.className = "ps5-carousel";
    carouselContainer.appendChild(carousel);

    // Para cada jogo, criar um item no carrossel
    games.forEach((game, index) => {
      console.log("Processando jogo:", game);

      const item = document.createElement("div");
      item.className = "game-item";
      item.dataset.id = game.id;

      // Selecionar o primeiro item por padrão
      if (index === 0) {
        item.classList.add("selected");
      }

      // Thumbnail
      const thumbnail = document.createElement("div");
      thumbnail.className = "game-item-thumbnail";

      const gameCarouselImage = game.mix ? game.mix : game.marquee;

      if (gameCarouselImage) {
        const img = document.createElement("img");
        img.src = gameCarouselImage;
        img.alt = game.name;
        img.onerror = () => {
          thumbnail.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
        };
        thumbnail.appendChild(img);
      }

      // Título do jogo
      const title = document.createElement("div");
      title.className = "game-item-title";
      title.textContent = game.name;

      // Favorito
      if (game.favorite) {
        const favorite = document.createElement("div");
        favorite.className = "game-item-favorite";
        favorite.innerHTML = "⭐";
        item.appendChild(favorite);
      }

      // Montar item
      item.appendChild(thumbnail);
      item.appendChild(title);

      // Evento de clique
      item.addEventListener("click", () => {
        // Remover seleção de todos os itens
        const allItems = carousel.querySelectorAll(".game-item");
        allItems.forEach((g) => g.classList.remove("selected"));

        // Selecionar este item
        item.classList.add("selected");

        // Atualizar o índice selecionado
        const selectedIndex = Array.from(allItems).indexOf(item);
        document.dispatchEvent(
          new CustomEvent("gameSelected", { detail: { index: selectedIndex } })
        );

        // Mostrar detalhes do jogo
        ESAPI.selectGame(game.id);
      });

      // Adicionar ao carrossel
      carousel.appendChild(item);
    });

    // Mostrar tela de jogos
    showScreen("games-screen");
    setCurrentScreen("games-screen");

    // Mostrar detalhes do primeiro jogo
    if (games.length > 0) {
      const gameId = games[0].id;
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
      gameImage.src = "/themes/default/img/default.jpg";
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
  } else {
    document.getElementById("game-release-date").textContent = "-";
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
 * Inicializa a tela de configurações
 */
function initSettingsScreen() {
  // Preencher seletor de temas
  const themeSelect = document.getElementById("theme-select");
  themeSelect.innerHTML = "";

  const themes = ESAPI.getThemes();
  const currentTheme = ESAPI.getCurrentTheme();

  themes.forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;

    if (theme.id === currentTheme.id) {
      option.selected = true;
      document.getElementById("current-theme-name").textContent = theme.name;
    }

    themeSelect.appendChild(option);
  });

  // Evento de mudança de tema
  themeSelect.addEventListener("change", () => {
    const themeId = themeSelect.value;
    ESAPI.setCurrentTheme(themeId).then(() => {
      // Recarregar a página para aplicar o novo tema
      window.location.reload();
    });
  });

  // Configuração de formato de hora
  const clockFormat = document.getElementById("clock-format");
  const settings = ESAPI.getSettings();

  if (settings?.ui?.ClockFormat) {
    clockFormat.value = settings.ui.ClockFormat;
  }

  clockFormat.addEventListener("change", () => {
    ESAPI.updateSetting("ClockFormat", clockFormat.value);
  });
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
    document.getElementById("loader").style.opacity = "1";
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

// Função para verificar se a imagem existe e carregar com fallback
function loadImageWithFallback(
  thumbnail,
  primaryImagePath,
  fallbackImagePath,
  gameName
) {
  const img = document.createElement("img");

  // Definir handlers antes de definir src para garantir que eles sejam ativados
  img.onload = () => {
    // Imagem carregada com sucesso
    console.log(`Imagem carregada com sucesso: ${img.src}`);
  };

  img.onerror = () => {
    // Se a imagem primária falhar, tentar carregar a fallback
    if (img.src === primaryImagePath) {
      console.log(`Imagem primária não encontrada: ${primaryImagePath}`);

      if (fallbackImagePath) {
        console.log(`Tentando fallback: ${fallbackImagePath}`);
        img.src = fallbackImagePath;
      } else {
        // Se não houver fallback, usar cor de fundo
        console.log(`Sem imagem fallback disponível`);
        thumbnail.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
      }
    } else {
      // Se a imagem fallback também falhar
      console.log(`Imagem fallback não encontrada: ${fallbackImagePath}`);
      thumbnail.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
    }
  };

  // Definir atributos da imagem
  img.alt = gameName;
  img.src = primaryImagePath; // Isso dispara o carregamento

  // Adicionar ao DOM
  thumbnail.appendChild(img);
}
