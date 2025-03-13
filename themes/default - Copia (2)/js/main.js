/**
 * Script principal para o tema padrão do EmulationStation
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("Iniciando tema web do EmulationStation...");

  // Carregar os recursos do Slick Slider
  loadSlickSliderResources();

  // Inicializar API
  initAPI();

  // Configurar relógio do sistema
  initSystemClock();

  // Configurar navegação por teclado
  initKeyboardNavigation();
});

/**
 * Carrega os recursos do Slick Slider
 */
function loadSlickSliderResources() {
  // jQuery (requerido pelo Slick)
  const jquery = document.createElement("script");
  jquery.src =
    "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js";
  document.head.appendChild(jquery);

  // Slick Slider JavaScript
  const slickJs = document.createElement("script");
  slickJs.src =
    "https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.js";
  // Garantir que o Slick seja carregado após o jQuery
  jquery.onload = () => {
    document.head.appendChild(slickJs);
  };

  // Slick Slider CSS
  const slickCss = document.createElement("link");
  slickCss.rel = "stylesheet";
  slickCss.type = "text/css";
  slickCss.href =
    "https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick.min.css";
  document.head.appendChild(slickCss);

  // Slick Slider tema CSS
  const slickThemeCss = document.createElement("link");
  slickThemeCss.rel = "stylesheet";
  slickThemeCss.type = "text/css";
  slickThemeCss.href =
    "https://cdnjs.cloudflare.com/ajax/libs/slick-carousel/1.8.1/slick-theme.min.css";
  document.head.appendChild(slickThemeCss);
}

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
    // Essa função agora lida apenas com teclas que não afetam a navegação do carrossel
    // A navegação do carrossel é gerenciada pelo Slick Slider
    switch (event.key) {
      case "Enter":
        // Lançar o jogo selecionado (obtido via Slick Slider)
        const gameId = getCurrentGameId();
        if (gameId) {
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
        // Toggle favorito
        const currentId = getCurrentGameId();
        if (currentId) {
          toggleFavorite(currentId);
        }
        break;
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
   * Obtém o ID do jogo atual selecionado no carrossel
   */
  function getCurrentGameId() {
    const slickContainer = document.querySelector(".games-slick-container");
    if (!slickContainer) return null;

    const currentSlide = $(slickContainer).find(".slick-current");
    if (!currentSlide.length) return null;

    return currentSlide.find(".game-item").data("id");
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
 * Carrega e exibe os jogos de uma plataforma usando o Slick Slider
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

    // Criar o container para o Slick Slider
    const slickContainer = document.createElement("div");
    slickContainer.className = "games-slick-container";
    gamesList.appendChild(slickContainer);

    // Para cada jogo, criar um item na lista
    games.forEach((game) => {
      console.log("Processando jogo:", game);

      const slickItem = document.createElement("div");
      slickItem.className = "slick-item";

      const item = document.createElement("div");
      item.className = "game-item";
      item.dataset.id = game.id;

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

      // Informações do jogo
      // const info = document.createElement("div");
      // info.className = "game-item-info";

      // const title = document.createElement("div");
      // title.className = "game-item-title";
      // title.textContent = game.name;

      // const details = document.createElement("div");
      // details.className = "game-item-details";

      // if (game.releaseDate) {
      //   details.textContent = `${game.releaseDate} • `;
      // }

      // if (game.publisher) {
      //   details.textContent += game.publisher;
      // } else if (game.developer) {
      //   details.textContent += game.developer;
      // }

      // info.appendChild(title);
      // info.appendChild(details);

      // Favorito
      if (game.favorite) {
        const favorite = document.createElement("div");
        favorite.className = "game-item-favorite";
        favorite.innerHTML = "⭐";
        item.appendChild(favorite);
      }

      // Montar item
      item.appendChild(thumbnail);
      //item.appendChild(info);

      // Adicionar ao item do Slick
      slickItem.appendChild(item);

      // Adicionar ao container do Slick
      slickContainer.appendChild(slickItem);
    });

    // Inicializar o Slick Slider
    initSlickSlider(slickContainer, games);

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
 * Inicializa o Slick Slider para a navegação de jogos
 * @param {HTMLElement} container - Container onde será inicializado o slider
 * @param {Array} games - Lista de jogos
 */
function initSlickSlider(container, games) {
  // Verificar se o jQuery e Slick estão disponíveis
  if (typeof $ === "undefined" || typeof $.fn.slick === "undefined") {
    console.error("jQuery ou Slick não estão disponíveis ainda. Aguardando...");
    setTimeout(() => initSlickSlider(container, games), 500);
    return;
  }

  // Verificar se o Slick já foi inicializado
  if ($(container).hasClass("slick-initialized")) {
    // Destruir instância anterior
    $(container).slick("unslick");
  }

  // Configurações do Slick Slider
  $(container).slick({
    centerMode: true,
    centerPadding: "0",
    slidesToShow: 18,
    infinite: true,
    speed: 300,
    focusOnSelect: true,
    arrows: false, // Sem setas visuais, usaremos navegação por teclado
    responsive: [
      {
        breakpoint: 768,
        settings: {
          centerMode: true,
          centerPadding: "0",
          slidesToShow: 3,
        },
      },
    ],
  });

  // Evento após mudança de slide
  $(container).on("afterChange", function (event, slick, currentSlide) {
    // Obter o elemento do slide atual
    const currentSlideElement = slick.$slides[currentSlide];

    // Obter o ID do jogo a partir do elemento
    const gameItem = currentSlideElement.querySelector(".game-item");
    if (gameItem) {
      const gameId = gameItem.dataset.id;

      // Verificar se o gameId é válido
      if (gameId) {
        ESAPI.selectGame(gameId);
        console.log(`Selecionado jogo: ${gameId}, slide: ${currentSlide}`);
      }
    }
  });

  // Configurar eventos de teclado para navegação no Slick
  $(document)
    .off("keydown.slick")
    .on("keydown.slick", function (e) {
      // Só processar se estiver na tela de jogos
      if (
        document.getElementById("games-screen").classList.contains("active")
      ) {
        switch (e.key) {
          case "ArrowLeft":
            $(container).slick("slickPrev");
            break;
          case "ArrowRight":
            $(container).slick("slickNext");
            break;
        }
      }
    });
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
