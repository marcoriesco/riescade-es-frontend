import { SystemsScreen } from "./systems-screen.js";
import { GameListScreen } from "./gamelist-screen.js";
import { SettingsScreen } from "./settings-screen.js";
import { ThemeManager } from "./theme-manager.js";
import { ConfigParser } from "./config-parser.js";
import { GamepadManager } from "./gamepad-manager.js";

// No início do arquivo, logo após as importações
// Verificar e logar o status da API
console.log("=== VERIFICAÇÃO DA API ===");
console.log("window.api existe?", !!window.api);
if (window.api) {
  console.log("Métodos disponíveis na API:", Object.keys(window.api));
  console.log("window.api.localApi existe?", !!window.api.localApi);
  if (window.api.localApi) {
    console.log(
      "Métodos disponíveis na API local:",
      Object.keys(window.api.localApi)
    );
    console.log(
      "window.api.localApi.games existe?",
      !!window.api.localApi.games
    );
    if (window.api.localApi.games) {
      console.log(
        "Métodos disponíveis na API de jogos:",
        Object.keys(window.api.localApi.games)
      );
      console.log(
        "window.api.localApi.games.getBySystem existe?",
        typeof window.api.localApi.games.getBySystem === "function"
      );
    }
  }
  console.log(
    "window.api.readFile existe?",
    typeof window.api.readFile === "function"
  );
}
console.log("=== FIM DA VERIFICAÇÃO DA API ===");

// Corrigir erro de "dragEvent is not defined"
if (typeof dragEvent === "undefined") {
  window.dragEvent = null;
}

// Verificar se a API local está disponível
document.addEventListener("DOMContentLoaded", function () {
  if (!window.api) {
    console.error(
      "API do Electron não está disponível. Verifique se o preload.js está configurado corretamente."
    );
  } else if (!window.api.localApi) {
    console.error(
      "API local não está disponível. Verifique se a API local foi registrada corretamente."
    );
  } else {
    console.log(
      "API local disponível no escopo global:",
      Object.keys(window.api.localApi)
    );
  }
});

// Classe principal que gerencia o aplicativo
class App {
  constructor() {
    this.systemsScreen = new SystemsScreen(this);
    this.gameListScreen = new GameListScreen(this);
    this.settingsScreen = new SettingsScreen(this);
    this.themeManager = null;
    this.configParser = new ConfigParser();
    this.gamepadManager = new GamepadManager();
    this.navigation = document.getElementById("navigation");
    this.currentScreen = "systems";
    this.currentSystem = null;

    // Verificar se a API está disponível
    if (window.api && window.api.localApi) {
      // API local detectada
    }

    this.init();
  }

  async init() {
    try {
      // Inicializar o gerenciador de temas (antes de qualquer outra coisa)
      console.log("Inicializando gerenciador de temas...");
      this.themeManager = new ThemeManager();
      const themeInitialized = await this.themeManager.initialize();

      if (!themeInitialized) {
        console.warn(
          "Falha na inicialização completa do tema, continuando com funcionalidade limitada"
        );
      } else {
        console.log("Gerenciador de temas inicializado com sucesso");
      }

      // Add console logging to track initialization flow
      console.log("Iniciando carregamento do aplicativo...");

      // Verificação para confirmar carregamento dos estilos
      const styleSheets = document.styleSheets;
      console.log(`Folhas de estilo carregadas: ${styleSheets.length}`);
      for (let i = 0; i < styleSheets.length; i++) {
        try {
          console.log(`Folha de estilo ${i}: ${styleSheets[i].href}`);
        } catch (e) {
          console.log(`Folha de estilo ${i}: [erro ao acessar href]`);
        }
      }

      // Carregar configurações
      console.log("Carregando configurações...");
      await this.loadSettings();

      // Carregar lista de sistemas (apenas uma vez)
      console.log("Carregando lista de sistemas...");
      await this.systemsScreen.loadSystems();

      // Configurar listener para eventos de atualização (se implementado)
      if (typeof this.setupUpdateListener === "function") {
        this.setupUpdateListener();
      }

      // Registrar eventos de UI
      console.log("Registrando eventos de UI...");
      this.setupEventListeners();

      // Configurar navegação por gamepad
      console.log("Configurando navegação por gamepad...");
      this.setupGamepadNavigation();

      console.log("Aplicativo inicializado com sucesso");
      return true;
    } catch (error) {
      console.error("Erro ao inicializar o aplicativo:", error);
      return false;
    }
  }

  applySystemsTheme() {
    this.themeManager.applySystemsScreenTheme();
  }

  applyGameListTheme(systemName) {
    this.themeManager.applyGameListTheme(systemName);
  }

  async selectSystem(system) {
    try {
      console.log(`[App] Selecionando sistema: ${system.name}`);

      // Atualizar estado do aplicativo
      this.currentSystem = system;

      // Usar o themeManager para mudar para a visualização da lista de jogos
      const viewChanged = this.themeManager.changeView("gamelist");
      if (!viewChanged) {
        console.error(
          "[App] Falha ao mudar para a visualização da lista de jogos"
        );
      }

      // Atualizar nome do sistema na interface
      const systemNameElement = document.getElementById("current-system-name");
      if (systemNameElement) {
        systemNameElement.textContent =
          system.fullname || system.name || "Sistema Desconhecido";
      }

      // Mostrar tela de carregamento enquanto carregamos os dados do sistema
      await this.gameListScreen.showLoading(
        `Carregando sistema ${system.name}...`
      );

      // Carregar contagem de jogos para o sistema selecionado
      if (system.gameCount === -1) {
        await this.systemsScreen.loadSystemGameCount(system.name);
      }

      // Carregar jogos
      await this.gameListScreen.loadGames(system.name);

      // Mudar para a tela de games
      this.showScreen("gamelist");

      // Se estiver usando gamepad, selecionar o primeiro jogo
      if (document.body.classList.contains("gamepad-active")) {
        setTimeout(() => {
          this.selectFirstElementInCurrentScreen();
        }, 300); // Tempo maior para garantir que os jogos estejam carregados
      }
    } catch (error) {
      console.error("[App] Erro ao selecionar sistema:", error);
      // Em caso de erro, mostrar mensagem de erro na tela de jogos
      this.gameListScreen.showEmptyState(
        `Erro ao carregar sistema: ${error.message}`
      );
    }
  }

  setupEventListeners() {
    // Configurar eventos de navegação
    const navItems = document.querySelectorAll("#navigation li");
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        if (item.classList.contains("disabled")) return;

        const screenName = item.getAttribute("data-screen");
        this.showScreen(screenName);
      });
    });

    // Event listener para quando um jogo é iniciado
    if (window.api && window.api.onGameLaunched) {
      window.api.onGameLaunched((data) => {
        // Log de retorno da API
        console.log("API onGameLaunched retorno:", data);
      });
    } else {
      // Fallback silencioso
    }

    // Botão voltar da tela de jogos
    const backButton = document.getElementById("back-to-systems");
    if (backButton) {
      backButton.addEventListener("click", () => {
        this.showScreen("systems");
      });
    }

    // Botão voltar da tela de configurações
    const backFromSettingsButton =
      document.getElementById("back-from-settings");
    if (backFromSettingsButton) {
      backFromSettingsButton.addEventListener("click", () => {
        this.showScreen("systems");
      });
    }

    // Detectar tecla ESPAÇO para abrir o menu de configurações
    document.addEventListener("keydown", (e) => {
      // Código 32 é o espaço
      if (e.keyCode === 32 || e.key === " ") {
        console.log("[App] Tecla espaço pressionada");
        // Verificar se a instância de SettingsScreen existe
        if (this.settingsScreen && this.settingsScreen.toggleSettingsModal) {
          console.log("[App] Chamando toggleSettingsModal");
          this.settingsScreen.toggleSettingsModal();
        } else {
          console.error(
            "[App] Erro: settingsScreen ou toggleSettingsModal não encontrado"
          );
          console.log("[App] settingsScreen existe?", !!this.settingsScreen);
          if (this.settingsScreen) {
            console.log(
              "[App] toggleSettingsModal existe?",
              typeof this.settingsScreen.toggleSettingsModal === "function"
            );
          }
        }
      }
    });

    // Verificar se os estilos estão carregados
    this.checkCssLoaded();
  }

  checkCssLoaded() {
    // Verificação para garantir que o CSS de settings está carregado
    const styleSheets = document.styleSheets;
    let settingsCssFound = false;

    console.log("[App] Verificando se CSS de settings está carregado");
    for (let i = 0; i < styleSheets.length; i++) {
      try {
        const href = styleSheets[i].href || "";
        console.log(`[App] StyleSheet ${i}: ${href}`);
        if (href.includes("settings.css")) {
          settingsCssFound = true;
          console.log("[App] CSS de settings encontrado!");
        }
      } catch (e) {
        console.log(`[App] Erro ao acessar stylesheet ${i}`);
      }
    }

    if (!settingsCssFound) {
      console.error(
        "[App] ATENÇÃO: CSS de settings não encontrado. Adicionando-o dinamicamente."
      );
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "src/css/settings.css";
      document.head.appendChild(link);
    }
  }

  setupGamepadNavigation() {
    console.log("[App] Configurando navegação por gamepad");

    // Configurar indicador de gamepad
    this.setupGamepadIndicator();

    // Prevenir o comportamento padrão de scroll com as teclas direcionais
    // e implementar navegação com teclado
    window.addEventListener(
      "keydown",
      (e) => {
        // Teclas direcionais (cima, baixo, esquerda, direita)
        if ([37, 38, 39, 40].includes(e.keyCode)) {
          e.preventDefault();

          // Mapear teclas para direções
          let direction = "";
          switch (e.keyCode) {
            case 38:
              direction = "up";
              break; // Seta para cima
            case 40:
              direction = "down";
              break; // Seta para baixo
            case 37:
              direction = "left";
              break; // Seta para esquerda
            case 39:
              direction = "right";
              break; // Seta para direita
          }

          console.log(`[App] Tecla direcional pressionada: ${direction}`);

          // Usar a mesma função de navegação do gamepad
          if (direction) {
            this.navigateWithGamepad(direction);
          }

          return false;
        }

        // Tecla Enter para selecionar
        if (e.keyCode === 13) {
          console.log("[App] Tecla Enter pressionada");
          this.selectWithGamepad();
          return false;
        }

        // Tecla Esc para voltar
        if (e.keyCode === 27) {
          console.log("[App] Tecla Esc pressionada");

          // Se o modal estiver aberto, fechá-lo
          if (this.settingsScreen && this.settingsScreen.modalOpen) {
            this.settingsScreen.closeSettingsModal();
            return false;
          }

          // Se estiver na tela de jogos, voltar para sistemas
          if (this.currentScreen === "gamelist") {
            this.showScreen("systems");
            return false;
          }
        }
      },
      { passive: false }
    );

    // Quando um gamepad é conectado
    document.addEventListener("gamepad:gamepadconnected", (event) => {
      console.log("[App] Gamepad conectado:", event.detail.gamepad.id);
      // Adicionar classe para estilo específico de gamepad
      document.body.classList.add("gamepad-active");
    });

    // Quando um gamepad é desconectado
    document.addEventListener("gamepad:gamepaddisconnected", () => {
      console.log("[App] Gamepad desconectado");
      // Remover classe de estilo específico de gamepad
      document.body.classList.remove("gamepad-active");
    });

    // Botão Start para abrir menu de configurações (adicionar mais logging)
    this.gamepadManager.onButtonPress("start", (value) => {
      console.log(`[App] Botão START com valor: ${value}`);
      if (value > 0.5) {
        // Botão pressionado
        console.log("[App] Botão START pressionado no gamepad");
        // Verificar se a instância de SettingsScreen existe
        if (this.settingsScreen && this.settingsScreen.toggleSettingsModal) {
          console.log("[App] Abrindo menu de configurações via gamepad");
          this.settingsScreen.toggleSettingsModal();

          // Vibrar o controle para feedback (se suportado)
          this.gamepadManager.vibrate(100, 0.3, 0.3);
        } else {
          console.error(
            "[App] Erro: settingsScreen não encontrado ou toggleSettingsModal não é uma função"
          );
          console.log("[App] settingsScreen existe?", !!this.settingsScreen);
          if (this.settingsScreen) {
            console.log(
              "[App] toggleSettingsModal existe?",
              typeof this.settingsScreen.toggleSettingsModal === "function"
            );
          }
        }
      }
    });

    // Botão B para voltar
    this.gamepadManager.onButtonPress("b", (value) => {
      if (value > 0.5) {
        // Botão pressionado
        console.log("[App] Botão B pressionado no gamepad (voltar)");

        // Se estamos no modal de configurações, fechá-lo
        if (this.settingsScreen && this.settingsScreen.modalOpen) {
          console.log("[App] Fechando modal de configurações");
          this.settingsScreen.closeSettingsModal();
          // Vibrar o controle para feedback
          this.gamepadManager.vibrate(80, 0.2, 0.2);
          return;
        }

        // Se estamos na tela de jogos, voltar para a tela de sistemas
        if (this.currentScreen === "gamelist") {
          console.log("[App] Voltando para a tela de sistemas");
          this.showScreen("systems");

          // Vibrar o controle para feedback (se suportado)
          this.gamepadManager.vibrate(100, 0.2, 0.2);
        }
      }
    });

    // D-pad para navegação - com prevenção de comportamento padrão
    this.gamepadManager.onButtonPress("dup", (value) => {
      if (value > 0.5) {
        console.log("[App] D-PAD UP pressionado");
        // Prevenir scroll
        event && event.preventDefault && event.preventDefault();
        this.navigateWithGamepad("up");
        return false;
      }
    });

    this.gamepadManager.onButtonPress("ddown", (value) => {
      if (value > 0.5) {
        console.log("[App] D-PAD DOWN pressionado");
        // Prevenir scroll
        event && event.preventDefault && event.preventDefault();
        this.navigateWithGamepad("down");
        return false;
      }
    });

    this.gamepadManager.onButtonPress("dleft", (value) => {
      if (value > 0.5) {
        console.log("[App] D-PAD LEFT pressionado");
        // Prevenir scroll
        event && event.preventDefault && event.preventDefault();
        this.navigateWithGamepad("left");
        return false;
      }
    });

    this.gamepadManager.onButtonPress("dright", (value) => {
      if (value > 0.5) {
        console.log("[App] D-PAD RIGHT pressionado");
        // Prevenir scroll
        event && event.preventDefault && event.preventDefault();
        this.navigateWithGamepad("right");
        return false;
      }
    });

    // Botão A para selecionar
    this.gamepadManager.onButtonPress("a", (value) => {
      if (value > 0.5) {
        console.log("[App] Botão A pressionado");
        this.selectWithGamepad();
      }
    });

    // Sticks analógicos para navegação - com prevenção de comportamento padrão
    document.addEventListener(
      "gamepad:gamepadinput",
      (event) => {
        // Verificar se é o botão start
        if (event.detail.button === "start" && event.detail.isPressed) {
          console.log(
            "[App] START detectado via evento. Tentando abrir modal..."
          );
          if (this.settingsScreen && this.settingsScreen.toggleSettingsModal) {
            this.settingsScreen.toggleSettingsModal();
          }
        }

        // Verificar se é um eixo do stick e valor significativo
        if (event.detail.isAxis && Math.abs(event.detail.value) > 0.5) {
          const { button, value } = event.detail;

          // Prevenir comportamento padrão
          event && event.preventDefault && event.preventDefault();

          if (button === "leftstick_y") {
            if (value < -0.5) {
              console.log("[App] Stick analógico para cima");
              this.navigateWithGamepad("up");
            } else if (value > 0.5) {
              console.log("[App] Stick analógico para baixo");
              this.navigateWithGamepad("down");
            }
          } else if (button === "leftstick_x") {
            if (value < -0.5) {
              console.log("[App] Stick analógico para esquerda");
              this.navigateWithGamepad("left");
            } else if (value > 0.5) {
              console.log("[App] Stick analógico para direita");
              this.navigateWithGamepad("right");
            }
          }

          return false;
        }
      },
      { passive: false }
    );

    // Seleção inicial: selecionar o primeiro elemento da tela atual
    this.selectFirstElementInCurrentScreen();

    console.log("[App] Navegação por gamepad configurada");
  }

  // Método para selecionar o primeiro elemento na tela atual
  selectFirstElementInCurrentScreen() {
    console.log("[App] Selecionando primeiro elemento na tela atual");

    let selector = "";
    if (this.currentScreen === "systems") {
      selector = ".system-card";
    } else if (this.currentScreen === "gamelist") {
      selector = ".game-card";
    } else if (this.settingsScreen && this.settingsScreen.modalOpen) {
      selector = ".settings-menu-item";
    }

    if (selector) {
      const firstElement = document.querySelector(selector);
      if (firstElement) {
        console.log(
          `[App] Selecionando primeiro elemento: ${firstElement.textContent.trim()}`
        );

        // Remover qualquer seleção anterior
        document.querySelectorAll(".active").forEach((el) => {
          el.classList.remove("active");
          el.setAttribute("aria-selected", "false");
        });

        // Adicionar classe active
        firstElement.classList.add("active");
        firstElement.setAttribute("aria-selected", "true");
        firstElement.focus();

        return true;
      }
    }

    return false;
  }

  // Configura o indicador visual de gamepad conectado
  setupGamepadIndicator() {
    const indicator = document.getElementById("gamepad-indicator");
    const gamepadName = document.getElementById("gamepad-name");

    if (!indicator || !gamepadName) return;

    // Eventos para atualizar o indicador
    document.addEventListener("gamepad:gamepadconnected", (event) => {
      const gamepad = event.detail.gamepad;
      indicator.classList.add("visible");
      gamepadName.textContent = `Gamepad: ${gamepad.id.split("(")[0].trim()}`;

      // Esconder após alguns segundos
      setTimeout(() => {
        indicator.classList.remove("visible");
      }, 3000);
    });

    document.addEventListener("gamepad:gamepaddisconnected", () => {
      indicator.classList.remove("visible");
    });

    // Verificar se já há um gamepad conectado
    if (this.gamepadManager.isGamepadConnected()) {
      const gamepadInfo = this.gamepadManager.getGamepadInfo();
      if (gamepadInfo) {
        indicator.classList.add("visible");
        gamepadName.textContent = `Gamepad: ${gamepadInfo.id
          .split("(")[0]
          .trim()}`;

        // Esconder após alguns segundos
        setTimeout(() => {
          indicator.classList.remove("visible");
        }, 3000);
      }
    }
  }

  navigateWithGamepad(direction) {
    console.log(`[App] Navegando via gamepad: ${direction}`);

    // Verificar se o modal de settings está aberto
    if (this.settingsScreen && this.settingsScreen.modalOpen) {
      console.log("[App] Navegando no modal de settings");
      this.navigateSettingsModal(direction);
      return;
    }

    // Determinar qual elemento está com foco ou está ativo
    const focusedElement = document.activeElement;
    const activeElement = document.querySelector(
      ".system-card.active, .game-card.active"
    );
    let targetElement = null;

    // Se estamos na tela de sistemas
    if (this.currentScreen === "systems") {
      console.log("[App] Navegando na tela de sistemas");
      // Obter todos os cards de sistema
      const systemCards = document.querySelectorAll(".system-card");
      console.log(`[App] Encontrados ${systemCards.length} cards de sistema`);

      if (systemCards.length === 0) return;

      // Se nenhum card está com foco ou ativo, selecionar o primeiro
      let currentElement = activeElement || focusedElement;
      let currentIndex = -1;

      if (
        !currentElement ||
        !currentElement.classList.contains("system-card")
      ) {
        console.log(
          "[App] Nenhum sistema selecionado, selecionando o primeiro"
        );
        targetElement = systemCards[0];
      } else {
        // Obter o índice do elemento com foco
        currentIndex = Array.from(systemCards).indexOf(currentElement);
        console.log(`[App] Sistema atual: ${currentIndex}`);

        // Calcular o próximo índice baseado na direção
        let nextIndex = currentIndex;

        // Suponha que temos uma grade de sistemas com 4 colunas (ajuste conforme necessário)
        const columns = Math.min(4, systemCards.length);
        const rows = Math.ceil(systemCards.length / columns);

        // Converter índice linear para linha/coluna
        const currentRow = Math.floor(currentIndex / columns);
        const currentCol = currentIndex % columns;

        console.log(
          `[App] Posição atual: linha ${currentRow}, coluna ${currentCol}`
        );
        console.log(`[App] Grade: ${rows} linhas x ${columns} colunas`);

        switch (direction) {
          case "up":
            if (currentRow > 0) {
              nextIndex = (currentRow - 1) * columns + currentCol;
              console.log(`[App] Movendo para cima: novo índice ${nextIndex}`);
            }
            break;
          case "down":
            if (currentRow < rows - 1) {
              nextIndex = Math.min(
                (currentRow + 1) * columns + currentCol,
                systemCards.length - 1
              );
              console.log(`[App] Movendo para baixo: novo índice ${nextIndex}`);
            }
            break;
          case "left":
            if (currentCol > 0) {
              nextIndex = currentIndex - 1;
              console.log(
                `[App] Movendo para esquerda: novo índice ${nextIndex}`
              );
            }
            break;
          case "right":
            if (
              currentCol < columns - 1 &&
              currentIndex < systemCards.length - 1
            ) {
              nextIndex = currentIndex + 1;
              console.log(
                `[App] Movendo para direita: novo índice ${nextIndex}`
              );
            }
            break;
        }

        // Verificar se o índice é válido
        if (
          nextIndex >= 0 &&
          nextIndex < systemCards.length &&
          nextIndex !== currentIndex
        ) {
          targetElement = systemCards[nextIndex];
        } else {
          console.log(`[App] Movimento inválido ou borda alcançada`);
        }
      }
    }
    // Se estamos na tela de jogos
    else if (this.currentScreen === "gamelist") {
      console.log("[App] Navegando na lista de jogos");
      const gameCards = document.querySelectorAll(".game-card");
      console.log(`[App] Encontrados ${gameCards.length} jogos`);

      if (gameCards.length === 0) return;

      // Se nenhum card está com foco ou ativo, selecionar o primeiro
      let currentElement = activeElement || focusedElement;

      if (!currentElement || !currentElement.classList.contains("game-card")) {
        console.log("[App] Nenhum jogo selecionado, selecionando o primeiro");
        targetElement = gameCards[0];
      } else {
        // Navegação simples (cima/baixo)
        const currentIndex = Array.from(gameCards).indexOf(currentElement);
        console.log(`[App] Jogo atual: ${currentIndex}`);
        let nextIndex = currentIndex;

        switch (direction) {
          case "up":
            nextIndex = Math.max(0, currentIndex - 1);
            console.log(`[App] Movendo para cima: novo índice ${nextIndex}`);
            break;
          case "down":
            nextIndex = Math.min(gameCards.length - 1, currentIndex + 1);
            console.log(`[App] Movendo para baixo: novo índice ${nextIndex}`);
            break;
        }

        // Verificar se o índice é válido
        if (
          nextIndex >= 0 &&
          nextIndex < gameCards.length &&
          nextIndex !== currentIndex
        ) {
          targetElement = gameCards[nextIndex];
        }
      }
    }

    // Se encontramos um elemento para focar
    if (targetElement) {
      console.log(
        `[App] Elemento alvo encontrado: ${targetElement.textContent.trim()}`
      );

      // Remover classe active de todos os elementos do tipo atual
      let elements;
      if (this.currentScreen === "systems") {
        elements = document.querySelectorAll(".system-card");
      } else if (this.currentScreen === "gamelist") {
        elements = document.querySelectorAll(".game-card");
      }

      if (elements) {
        elements.forEach((item) => {
          item.classList.remove("active");
          item.setAttribute("aria-selected", "false");
        });
      }

      // Adicionar classe active ao elemento selecionado
      targetElement.classList.add("active");
      targetElement.setAttribute("aria-selected", "true");

      // Focar o elemento
      targetElement.focus();

      // Rolar até o elemento se necessário
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      // Vibrar o controle para feedback (se suportado)
      if (this.gamepadManager) {
        this.gamepadManager.vibrate(50, 0.1, 0.1);
      }

      // Atualizar último elemento selecionado
      this.lastSelectedElement = targetElement;

      return true;
    } else {
      console.log("[App] Nenhum elemento alvo encontrado");
      return false;
    }
  }

  // Método específico para navegar no modal de settings
  navigateSettingsModal(direction) {
    console.log(`[App] Navegando no modal de settings: ${direction}`);

    // Obter itens do menu
    const menuItems = document.querySelectorAll(".settings-menu-item");
    console.log(`[App] Encontrados ${menuItems.length} itens de menu`);

    if (menuItems.length === 0) return false;

    // Determinar qual item está ativo ou com foco
    const focusedElement = document.activeElement;
    const activeElement = document.querySelector(".settings-menu-item.active");
    const currentElement = activeElement || focusedElement;

    let targetElement = null;

    // Se nenhum item está com foco ou ativo, selecionar o primeiro
    if (
      !currentElement ||
      !currentElement.classList.contains("settings-menu-item")
    ) {
      console.log("[App] Nenhum item selecionado, selecionando o primeiro");
      targetElement = menuItems[0];
    } else {
      // Navegação simples (cima/baixo)
      const currentIndex = Array.from(menuItems).indexOf(currentElement);
      console.log(`[App] Item atual: ${currentIndex}`);
      let nextIndex = currentIndex;

      if (direction === "up") {
        nextIndex = Math.max(0, currentIndex - 1);
        console.log(`[App] Movendo para cima: novo índice ${nextIndex}`);
      } else if (direction === "down") {
        nextIndex = Math.min(menuItems.length - 1, currentIndex + 1);
        console.log(`[App] Movendo para baixo: novo índice ${nextIndex}`);
      }

      // Verificar se o índice é válido
      if (
        nextIndex >= 0 &&
        nextIndex < menuItems.length &&
        nextIndex !== currentIndex
      ) {
        targetElement = menuItems[nextIndex];
      }
    }

    // Se encontramos um elemento para focar
    if (targetElement) {
      console.log(
        `[App] Item de menu alvo encontrado: ${targetElement.textContent.trim()}`
      );

      // Remover classe active de todos os itens
      menuItems.forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      });

      // Adicionar classe active ao item selecionado
      targetElement.classList.add("active");
      targetElement.setAttribute("aria-selected", "true");

      // Focar o elemento
      targetElement.focus();

      // Vibrar o controle para feedback (se suportado)
      if (this.gamepadManager) {
        this.gamepadManager.vibrate(50, 0.1, 0.1);
      }

      return true;
    }

    return false;
  }

  /**
   * Seleciona o elemento atual com o gamepad
   */
  selectWithGamepad() {
    console.log("[App] Selecionando com gamepad");

    // Determinar qual elemento está com foco ou ativo
    const focusedElement = document.activeElement;
    const activeElement = document.querySelector(
      ".system-card.active, .game-card.active, .settings-menu-item.active"
    );
    const targetElement = activeElement || focusedElement;

    // Se não encontramos nenhum elemento para selecionar
    if (!targetElement) {
      console.warn("[App] Nenhum elemento selecionado para ação");
      return false;
    }

    console.log(
      `[App] Elemento para seleção: ${
        targetElement.tagName
      } - ${targetElement.textContent.trim()}`
    );

    // Vibrar o controle para feedback (se suportado)
    if (this.gamepadManager) {
      this.gamepadManager.vibrate(100, 0.3, 0.3);
    }

    // Se for um cartão de sistema
    if (targetElement.classList.contains("system-card")) {
      const systemId = targetElement.getAttribute("data-system-id");

      if (systemId) {
        // Encontrar o sistema pelo ID
        const system = this.systemsScreen.loadedSystems.find(
          (s) => s.id === systemId || s.name === systemId
        );

        if (system) {
          console.log(`[App] Selecionando sistema via gamepad: ${system.name}`);
          this.selectSystem(system);
          return true;
        } else {
          console.warn(`[App] Sistema não encontrado para ID: ${systemId}`);
        }
      } else {
        console.warn("[App] Card de sistema não tem data-system-id");
      }
    }
    // Se for um cartão de jogo
    else if (targetElement.classList.contains("game-card")) {
      const gameId = targetElement.getAttribute("data-game-id");

      if (gameId) {
        console.log(`[App] Selecionando jogo via gamepad: ${gameId}`);

        if (
          this.gameListScreen &&
          typeof this.gameListScreen.selectGame === "function"
        ) {
          this.gameListScreen.selectGame(gameId);
          return true;
        } else {
          console.warn(
            "[App] gameListScreen ou método selectGame não encontrado"
          );
        }
      } else {
        console.warn("[App] Card de jogo não tem data-game-id");
      }
    }
    // Se for um item de menu de configurações
    else if (targetElement.classList.contains("settings-menu-item")) {
      const action = targetElement.getAttribute("data-action");

      if (action) {
        console.log(`[App] Selecionando ação via gamepad: ${action}`);

        if (
          this.settingsScreen &&
          typeof this.settingsScreen.handleMenuAction === "function"
        ) {
          this.settingsScreen.handleMenuAction(action);
          return true;
        } else {
          console.warn(
            "[App] settingsScreen ou método handleMenuAction não encontrado"
          );
        }
      } else {
        console.warn("[App] Item de menu não tem data-action");
      }
    }
    // Se for um botão ou outro controle focável
    else if (
      targetElement.tagName === "BUTTON" ||
      targetElement.tagName === "SELECT" ||
      targetElement.tagName === "INPUT"
    ) {
      console.log(
        `[App] Clicando em elemento via gamepad: ${targetElement.tagName}`
      );
      targetElement.click();
      return true;
    }

    console.warn("[App] Nenhuma ação executada pelo gamepad");
    return false;
  }

  showScreen(screenId) {
    console.log(`[App] Mudando para a tela: ${screenId}`);

    const screens = document.querySelectorAll(".screen");
    screens.forEach((screen) => {
      if (screen.id === `${screenId}-screen`) {
        screen.classList.add("active");
      } else {
        screen.classList.remove("active");
      }
    });

    // Atualizar a tela atual
    this.currentScreen = screenId;

    // Aplicar tema apropriado à tela atual
    if (screenId === "systems") {
      console.log("[App] Aplicando tema da tela de sistemas");
      this.themeManager.applySystemsScreenTheme();
    } else if (screenId === "gamelist") {
      console.log("[App] Aplicando tema da tela de jogos");
      if (this.currentSystem) {
        this.themeManager.applyGameListTheme(this.currentSystem);
      }
    }

    // Atualizar a navegação - destacar o item de menu atual
    const navItems = document.querySelectorAll("#navigation li");
    navItems.forEach((item) => {
      const itemScreenId = item.getAttribute("data-screen");
      if (itemScreenId === screenId) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Se estamos usando gamepad, selecionar o primeiro elemento na nova tela
    if (document.body.classList.contains("gamepad-active")) {
      // Dar tempo para a tela carregar
      setTimeout(() => {
        this.selectFirstElementInCurrentScreen();
      }, 100);
    }
  }

  async loadSettings() {
    await this.settingsScreen.loadSettings();
  }
}

// Iniciar aplicativo quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});

// No final do arquivo app.js, após a classe App
const app = new App();

// Expor a instância do app globalmente para facilitar o acesso direto
window.app = app;

console.log("App exposto globalmente como window.app");
