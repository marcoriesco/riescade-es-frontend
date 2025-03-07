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
  window.DragEvent = null;
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
    this.currentScreen = "systems";
    this.currentSystem = null;
  }

  async init() {
    try {
      // Carregar configurações primeiro
      console.log("Carregando configurações...");
      const settings = await window.api.getSettings();

      // Inicializar o gerenciador de temas com o tema das configurações
      this.themeManager = new ThemeManager();
      const themeInitialized = await this.themeManager.init(
        settings?.theme || "default"
      );

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

      // Configurar navegação por teclado
      console.log("Configurando navegação por teclado...");
      this.setupKeyboardNavigation();

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

      // CORREÇÃO: Sempre selecionar o primeiro jogo, não apenas quando usar gamepad
      setTimeout(() => {
        console.log("[App] Selecionando primeiro jogo na lista");
        this.selectFirstElementInCurrentScreen();
      }, 300); // Tempo maior para garantir que os jogos estejam carregados
    } catch (error) {
      console.error("[App] Erro ao selecionar sistema:", error);
      // Em caso de erro, mostrar mensagem de erro na tela de jogos
      this.gameListScreen.showEmptyState(
        `Erro ao carregar sistema: ${error.message}`
      );
    }
  }

  setupEventListeners() {
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

        // Se estamos na tela de detalhes do jogo, voltar para a lista de jogos
        if (this.currentScreen === "gamedetails" && this.gameListScreen) {
          console.log("[App] Voltando para a lista de jogos");
          this.showScreen("gamelist");
          return false;
        }

        // Se estamos em qualquer outra tela, verificar se há um modal aberto
        const modalElements = document.querySelectorAll(
          '.modal, .dialog, [role="dialog"]'
        );
        for (const modal of modalElements) {
          if (
            modal.style.display !== "none" &&
            modal.style.visibility !== "hidden"
          ) {
            console.log("[App] Fechando modal genérico");

            // Tentar fechar o modal
            if (typeof modal.close === "function") {
              modal.close();
            } else {
              modal.style.display = "none";
            }

            return false;
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

    // D-pad para navegação com logs de debug
    this.gamepadManager.onButtonPress("dup", (value) => {
      console.log("[App] D-PAD UP Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] D-PAD UP pressionado");

        // Verificar primeiro se o modal de configurações está aberto
        if (this.settingsScreen && this.settingsScreen.modalOpen) {
          // Obter lista de itens do menu
          const menuItems = document.querySelectorAll(".settings-menu-item");
          if (menuItems.length > 0) {
            // Encontrar o item atual
            const currentItem = Array.from(menuItems).findIndex((item) =>
              item.classList.contains("active")
            );

            // Calcular próximo item (para cima)
            const nextIndex =
              currentItem > 0 ? currentItem - 1 : menuItems.length - 1;

            // Atualizar seleção
            menuItems.forEach((item) => {
              item.classList.remove("active");
              item.setAttribute("aria-selected", "false");
            });

            menuItems[nextIndex].classList.add("active");
            menuItems[nextIndex].setAttribute("aria-selected", "true");
            menuItems[nextIndex].focus();
          }
        } else {
          // Navegação normal
          this.navigateWithGamepad("up");
        }
      }
    });

    this.gamepadManager.onButtonPress("ddown", (value) => {
      console.log("[App] D-PAD DOWN Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] D-PAD DOWN pressionado");

        // Verificar primeiro se o modal de configurações está aberto
        if (this.settingsScreen && this.settingsScreen.modalOpen) {
          // Obter lista de itens do menu
          const menuItems = document.querySelectorAll(".settings-menu-item");
          if (menuItems.length > 0) {
            // Encontrar o item atual
            const currentItem = Array.from(menuItems).findIndex((item) =>
              item.classList.contains("active")
            );

            // Calcular próximo item (para baixo)
            const nextIndex =
              currentItem < menuItems.length - 1 ? currentItem + 1 : 0;

            // Atualizar seleção
            menuItems.forEach((item) => {
              item.classList.remove("active");
              item.setAttribute("aria-selected", "false");
            });

            menuItems[nextIndex].classList.add("active");
            menuItems[nextIndex].setAttribute("aria-selected", "true");
            menuItems[nextIndex].focus();
          }
        } else {
          // Navegação normal
          this.navigateWithGamepad("down");
        }
      }
    });

    this.gamepadManager.onButtonPress("dleft", (value) => {
      console.log("[App] D-PAD LEFT Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] D-PAD LEFT pressionado");
        // Verificar se o modal está aberto (não navegar para esquerda no modal)
        if (!(this.settingsScreen && this.settingsScreen.modalOpen)) {
          this.navigateWithGamepad("left");
        }
      }
    });

    this.gamepadManager.onButtonPress("dright", (value) => {
      console.log("[App] D-PAD RIGHT Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] D-PAD RIGHT pressionado");
        // Verificar se o modal está aberto (não navegar para direita no modal)
        if (!(this.settingsScreen && this.settingsScreen.modalOpen)) {
          this.navigateWithGamepad("right");
        }
      }
    });

    // Botão A para selecionar
    this.gamepadManager.onButtonPress("a", (value) => {
      console.log("[App] Botão A Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] Botão A pressionado");

        // Verificar se o modal de configurações está aberto
        if (this.settingsScreen && this.settingsScreen.modalOpen) {
          // Selecionar item de menu
          const selectedItem = document.querySelector(
            ".settings-menu-item.active"
          );
          if (selectedItem) {
            const action = selectedItem.getAttribute("data-action");
            if (action) {
              this.settingsScreen.handleMenuAction(action);
            }
          }
        } else {
          // Seleção normal
          this.selectWithGamepad();
        }
      }
    });

    // Botão B para voltar
    this.gamepadManager.onButtonPress("b", (value) => {
      console.log("[App] Botão B Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] Botão B pressionado");
        this.handleBackButton();
      }
    });

    // Botão START para configurações
    this.gamepadManager.onButtonPress("start", (value) => {
      console.log("[App] Botão START Event - Value:", value);
      if (value > 0.5) {
        console.log("[App] Botão START pressionado");
        if (this.settingsScreen) {
          this.settingsScreen.toggleSettingsModal();
        }
      }
    });

    // Sticks analógicos para navegação - apenas quando o modal não está aberto
    document.addEventListener("gamepad:gamepadinput", (event) => {
      // Verificar se o modal está aberto
      if (this.settingsScreen && this.settingsScreen.modalOpen) {
        // Se o modal está aberto, tratar eventos apenas para sticks
        if (event.detail.isAxis && Math.abs(event.detail.value) > 0.5) {
          const { button, value } = event.detail;

          // Apenas tratar o stick vertical para navegação no modal
          if (button === "leftstick_y") {
            const menuItems = document.querySelectorAll(".settings-menu-item");
            if (menuItems.length > 0) {
              const currentItem = Array.from(menuItems).findIndex((item) =>
                item.classList.contains("active")
              );

              let nextIndex = currentItem;

              if (value < -0.5) {
                // Para cima
                nextIndex =
                  currentItem > 0 ? currentItem - 1 : menuItems.length - 1;
              } else if (value > 0.5) {
                // Para baixo
                nextIndex =
                  currentItem < menuItems.length - 1 ? currentItem + 1 : 0;
              }

              // Atualizar seleção
              menuItems.forEach((item) => {
                item.classList.remove("active");
                item.setAttribute("aria-selected", "false");
              });

              menuItems[nextIndex].classList.add("active");
              menuItems[nextIndex].setAttribute("aria-selected", "true");
              menuItems[nextIndex].focus();
            }
          }
        }
        return;
      }

      // Código original para quando o modal NÃO está aberto
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
      }
    });

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

  selectWithGamepad() {
    console.log("[App] Processando seleção com gamepad");

    try {
      // CORREÇÃO: buscar por .active em vez de .selected
      const selectedElement = document.querySelector(".active");
      if (!selectedElement) {
        console.log("[App] Nenhum elemento selecionado encontrado");
        return;
      }

      if (this.currentScreen === "systems") {
        // Obter o nome do sistema do atributo data-system-name
        const systemName = selectedElement.dataset.systemName;
        if (systemName) {
          console.log("[App] Selecionando sistema:", systemName);

          // Encontrar o objeto do sistema e selecioná-lo
          const system = this.systemsScreen.loadedSystems.find(
            (s) => s.name === systemName
          );

          if (system) {
            this.selectSystem(system);
          } else {
            console.error("[App] Sistema não encontrado:", systemName);
          }
        } else {
          console.error(
            "[App] Nome do sistema não encontrado no elemento selecionado"
          );
        }
      } else if (this.currentScreen === "gamelist") {
        // CORREÇÃO: Log detalhado para debug
        console.log(
          "[App] Elemento selecionado na lista de jogos:",
          selectedElement
        );

        // CORREÇÃO: Tentar obter o ID do jogo de diferentes atributos
        const gameId =
          selectedElement.dataset.gameId ||
          selectedElement.getAttribute("data-game-id");

        console.log("[App] Game ID encontrado:", gameId);

        if (gameId && this.gameListScreen) {
          console.log("[App] Tentando lançar jogo com ID:", gameId);
          // Mostrar todos os jogos disponíveis para debug
          console.log(
            "[App] Jogos disponíveis:",
            this.gameListScreen.games.map((g) => ({ id: g.id, name: g.name }))
          );

          // Tentar encontrar o jogo por ID ou caminho
          const game = this.gameListScreen.games.find(
            (g) =>
              g.id === gameId ||
              g.path === gameId ||
              (typeof g.id === "string" && g.id.trim() === gameId.trim())
          );

          if (game) {
            console.log("[App] Jogo encontrado, lançando:", game.name);
            // CORREÇÃO: Lançar o jogo diretamente pelo gameListScreen
            this.gameListScreen.launchGame(game);
          } else {
            console.error("[App] Jogo não encontrado para ID:", gameId);
            console.log("[App] Lista de jogos disponíveis:");
            this.gameListScreen.games.forEach((g) => {
              console.log(`ID: ${g.id}, Nome: ${g.name}, Caminho: ${g.path}`);
            });

            // CORREÇÃO ALTERNATIVA: Se não encontrar pelo ID, tentar pelo índice
            const index = Array.from(
              document.querySelectorAll(".game-card")
            ).indexOf(selectedElement);

            if (index !== -1 && this.gameListScreen.games[index]) {
              console.log("[App] Lançando jogo pelo índice:", index);
              this.gameListScreen.launchGame(this.gameListScreen.games[index]);
            }
          }
        } else {
          console.error(
            "[App] Falha ao obter gameId ou gameListScreen não inicializado"
          );
        }
      } else if (this.settingsScreen && this.settingsScreen.modalOpen) {
        // Lógica para menu de configurações
        const menuItem =
          selectedElement.dataset.action || selectedElement.dataset.settingId;
        if (menuItem) {
          console.log("[App] Selecionando configuração:", menuItem);
          this.settingsScreen.handleMenuAction(menuItem);
        }
      }
    } catch (error) {
      console.error("[App] Erro ao processar seleção com gamepad:", error);
    }
  }

  // Correção para o método navigateWithGamepad para incluir navegação no modal de configurações
  navigateWithGamepad(direction) {
    console.log("[App] Navegando com gamepad:", direction);

    // CORREÇÃO: Verificar primeiro se o modal de configurações está aberto
    if (this.settingsScreen && this.settingsScreen.modalOpen) {
      let elements = document.querySelectorAll(".settings-menu-item");

      // Converter NodeList para Array
      elements = Array.from(elements);
      if (elements.length === 0) return;

      // Encontrar o elemento atualmente selecionado
      let currentElement = elements.find((el) =>
        el.classList.contains("active")
      );

      if (!currentElement) {
        currentElement = elements[0];
        currentElement.classList.add("active");
        currentElement.setAttribute("aria-selected", "true");
        return;
      }

      // Encontrar o índice atual
      const currentIndex = elements.indexOf(currentElement);
      let nextIndex = currentIndex;

      // Navegação simples para cima e para baixo em menu vertical
      if (direction === "up") {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = elements.length - 1;
        }
      } else if (direction === "down") {
        nextIndex = currentIndex + 1;
        if (nextIndex >= elements.length) {
          nextIndex = 0;
        }
      }

      // Atualizar seleção
      currentElement.classList.remove("active");
      currentElement.setAttribute("aria-selected", "false");

      elements[nextIndex].classList.add("active");
      elements[nextIndex].setAttribute("aria-selected", "true");
      elements[nextIndex].scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });

      return; // Sair da função para não navegar na tela de fundo
    }

    // Código original para outros casos...
    let elements;
    if (this.currentScreen === "systems") {
      elements = document.querySelectorAll(".system-card");
    } else if (this.currentScreen === "gamelist") {
      elements = document.querySelectorAll(".game-card");
    } else {
      return;
    }

    // Converter NodeList para Array
    elements = Array.from(elements);
    if (elements.length === 0) return;

    // Encontrar o elemento atualmente selecionado
    let currentElement = elements.find(
      (el) =>
        el.classList.contains("selected") || el.classList.contains("active")
    );

    if (!currentElement) {
      currentElement = elements[0];
      // CORREÇÃO: padronizar para a classe active
      currentElement.classList.add("active");
      currentElement.setAttribute("aria-selected", "true");
      return;
    }

    // Calcular o número de colunas na grid
    const containerWidth = elements[0].parentElement.offsetWidth;
    const elementWidth = elements[0].offsetWidth;
    const gap = 16; // Espaço entre elementos (ajuste conforme necessário)
    const columnsCount = Math.floor(
      (containerWidth + gap) / (elementWidth + gap)
    );
    console.log("[App] Número de colunas detectado:", columnsCount);

    // Encontrar o índice atual
    const currentIndex = elements.indexOf(currentElement);
    let nextIndex = currentIndex;

    // Calcular próximo índice baseado na direção
    switch (direction) {
      case "up":
        nextIndex = currentIndex - columnsCount;
        break;
      case "down":
        nextIndex = currentIndex + columnsCount;
        break;
      case "left":
        nextIndex = currentIndex - 1;
        if (currentIndex % columnsCount === 0) {
          nextIndex = currentIndex + (columnsCount - 1);
        }
        break;
      case "right":
        nextIndex = currentIndex + 1;
        if (nextIndex % columnsCount === 0) {
          nextIndex = currentIndex - (columnsCount - 1);
        }
        break;
    }

    // Verificar limites e ajustar se necessário
    if (nextIndex < 0) {
      if (direction === "up") {
        // Ir para a última linha
        const lastRowStart =
          Math.floor((elements.length - 1) / columnsCount) * columnsCount;
        nextIndex = Math.min(
          lastRowStart + (currentIndex % columnsCount),
          elements.length - 1
        );
      } else {
        nextIndex = elements.length - 1;
      }
    } else if (nextIndex >= elements.length) {
      if (direction === "down") {
        // Ir para a primeira linha na mesma coluna
        nextIndex = currentIndex % columnsCount;
      } else {
        nextIndex = 0;
      }
    }

    // Atualizar seleção
    currentElement.classList.remove("selected");
    currentElement.classList.remove("active");
    currentElement.setAttribute("aria-selected", "false");

    elements[nextIndex].classList.add("active");
    elements[nextIndex].setAttribute("aria-selected", "true");
    elements[nextIndex].scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }

  // Adicionar suporte para navegação por teclado
  setupKeyboardNavigation() {
    console.log("[App] Configurando navegação por teclado");

    document.addEventListener("keydown", (e) => {
      console.log("[App] Tecla pressionada:", e.key, e.keyCode);

      // Navegação com teclas de seta
      if (e.key === "ArrowUp") {
        console.log("[App] Tecla SETA PARA CIMA pressionada");
        this.navigateWithGamepad("up");
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        console.log("[App] Tecla SETA PARA BAIXO pressionada");
        this.navigateWithGamepad("down");
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        console.log("[App] Tecla SETA PARA ESQUERDA pressionada");
        this.navigateWithGamepad("left");
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        console.log("[App] Tecla SETA PARA DIREITA pressionada");
        this.navigateWithGamepad("right");
        e.preventDefault();
      }

      // Enter para selecionar
      else if (e.key === "Enter") {
        console.log("[App] Tecla ENTER pressionada");
        this.selectWithGamepad();
        e.preventDefault();
      }

      // ESC para voltar - adicionado
      else if (e.key === "Escape" || e.keyCode === 27) {
        console.log("[App] Tecla ESC pressionada");
        this.handleBackButton();
        e.preventDefault();
      }
    });
  }

  handleBackButton() {
    console.log("[App] Processando botão voltar");

    // Se o modal de configurações estiver aberto, fechá-lo
    if (this.settingsScreen && this.settingsScreen.modalOpen) {
      console.log("[App] Fechando modal de configurações");
      this.settingsScreen.closeSettingsModal();
      return;
    }

    // Se estiver na lista de jogos, voltar para sistemas
    if (this.currentScreen === "gamelist") {
      console.log("[App] Voltando da lista de jogos para sistemas");
      // CORREÇÃO: Chamar diretamente o método showScreen e aplicar o tema correto
      this.themeManager.changeView("system");
      this.showScreen("systems");

      // CORREÇÃO: Selecionar o primeiro elemento após um pequeno delay
      setTimeout(() => {
        this.selectFirstElementInCurrentScreen();
      }, 100);
      return;
    }

    // Se estiver nos detalhes do jogo, voltar para a lista
    if (this.currentScreen === "gamedetails") {
      console.log("[App] Voltando dos detalhes para a lista de jogos");
      this.showScreen("gamelist");

      // CORREÇÃO: Selecionar o primeiro elemento após um pequeno delay
      setTimeout(() => {
        this.selectFirstElementInCurrentScreen();
      }, 100);
      return;
    }
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

  // Método para mudar o tema atual
  async changeTheme(themeName) {
    try {
      console.log(`[App] Alterando tema para: ${themeName}`);

      // Verificar se temos o gerenciador de temas
      if (!this.themeManager) {
        console.error("[App] ThemeManager não está disponível");
        return false;
      }

      // Chamar o método no themeManager
      if (typeof this.themeManager.changeTheme === "function") {
        const success = await this.themeManager.changeTheme(themeName);

        if (success) {
          console.log(`[App] Tema alterado com sucesso para: ${themeName}`);

          // Atualizar a interface
          if (this.currentScreen === "systems") {
            this.themeManager.applySystemsScreenTheme();
          } else if (this.currentScreen === "gamelist") {
            this.themeManager.applyGameListTheme(this.currentSystem);
          }

          return true;
        } else {
          console.error(`[App] Falha ao alterar tema para: ${themeName}`);
          return false;
        }
      } else {
        console.error(
          "[App] Método changeTheme não encontrado no ThemeManager"
        );
        return false;
      }
    } catch (error) {
      console.error(`[App] Erro ao alterar tema: ${error}`);
      return false;
    }
  }
}

// Iniciar aplicativo quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  window.app = app;
  app.init();
});
