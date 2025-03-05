import { SystemsScreen } from "./systems-screen.js";
import { GameListScreen } from "./gamelist-screen.js";
import { SettingsScreen } from "./settings-screen.js";
import { ThemeManager } from "./theme-manager.js";

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
    this.currentSystem = null;

    // Inicializar gerenciador de temas
    this.themeManager = new ThemeManager();

    // Inicializar telas
    this.systemsScreen = new SystemsScreen(this);
    this.gamelistScreen = new GameListScreen(this);
    this.settingsScreen = new SettingsScreen(this);

    // Verificar a API novamente
    if (!window.api || !window.api.localApi) {
      console.error("App: API local não disponível no construtor");
    } else {
      console.log("App: API local disponível no construtor");
    }

    // Configurar navegação
    this.setupNavigation();
  }

  async init() {
    console.log("App.init: Inicializando aplicativo...");

    try {
      // Inicializar GameListScreen
      console.log(
        "App.init: GameListScreen inicializado?",
        !!this.gamelistScreen
      );
      console.log(
        "App.init: GameListScreen.loadGames é uma função?",
        typeof this.gamelistScreen.loadGames === "function"
      );

      // Inicializar ThemeManager
      console.log("App.init: ThemeManager inicializado?", !!this.themeManager);
      console.log(
        "App.init: ThemeManager.renderGameListView é uma função?",
        typeof this.themeManager.renderGameListView === "function"
      );

      // Carregar configurações
      console.log("App.init: Carregando configurações...");
      await this.settingsScreen.loadSettings();
      console.log("App.init: Configurações carregadas com sucesso");

      // Carregar tema
      console.log("App.init: Inicializando gerenciador de temas...");
      await this.themeManager.initialize();
      console.log("App.init: Gerenciador de temas inicializado com sucesso");

      // Aplicar tema à tela de sistemas
      console.log("App.init: Aplicando tema à tela de sistemas...");
      this.themeManager.applySystemsScreenTheme();
      console.log("App.init: Tema aplicado à tela de sistemas com sucesso");

      // Carregar sistemas
      console.log("App.init: Carregando sistemas...");
      await this.systemsScreen.loadSystems();
      console.log("App.init: Sistemas carregados com sucesso");

      // Adicionar event listeners
      console.log("App.init: Adicionando event listeners...");
      this.addEventListeners();
      console.log("App.init: Event listeners adicionados com sucesso");

      console.log("App.init: Aplicativo inicializado com sucesso");
    } catch (error) {
      console.error("App.init: Erro ao inicializar aplicativo:", error);
    }
  }

  setupNavigation() {
    const navItems = document.querySelectorAll("#navigation li");
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        if (item.classList.contains("disabled")) return;

        const screenId = item.getAttribute("data-screen");
        this.showScreen(screenId);

        // Atualizar nav ativo
        navItems.forEach((navItem) => navItem.classList.remove("active"));
        item.classList.add("active");
      });
    });

    // Botão voltar da lista de jogos
    document.getElementById("back-to-systems").addEventListener("click", () => {
      this.showScreen("systems");
      this.updateNavigation("systems");
    });

    // Botão voltar das configurações
    document
      .getElementById("back-from-settings")
      .addEventListener("click", () => {
        this.showScreen("systems");
        this.updateNavigation("systems");
      });
  }

  updateNavigation(activeScreen) {
    const navItems = document.querySelectorAll("#navigation li");
    navItems.forEach((item) => {
      if (item.getAttribute("data-screen") === activeScreen) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }

      // Desativar o item de lista de jogos quando não há sistema selecionado
      if (item.getAttribute("data-screen") === "gamelist") {
        if (this.currentSystem) {
          item.classList.remove("disabled");
        } else {
          item.classList.add("disabled");
        }
      }
    });
  }

  showScreen(screenId) {
    const screens = document.querySelectorAll(".screen");
    screens.forEach((screen) => {
      if (screen.id === `${screenId}-screen`) {
        screen.classList.add("active");
      } else {
        screen.classList.remove("active");
      }
    });

    // Aplicar tema apropriado à tela atual
    if (screenId === "systems") {
      console.log("Aplicando tema da tela de sistemas");
      this.themeManager.applySystemsScreenTheme();

      // Renderizar sistemas apenas se ainda não estiverem carregados
      // ou se um tema diferente foi aplicado
      this.systemsScreen.loadSystems(false);
    } else if (screenId === "gamelist" && this.currentSystem) {
      console.log("Aplicando tema da lista de jogos");
      this.themeManager.applyGameListTheme(this.currentSystem.name);
    }
  }

  async selectSystem(system) {
    console.log("App.selectSystem: Iniciando com sistema:", system);
    this.currentSystem = system;
    document.getElementById("current-system-name").textContent = system.name;
    console.log("App.selectSystem: Nome do sistema atualizado na interface");

    // Carregar tema específico do sistema - passar apenas o nome do sistema
    console.log(
      `App.selectSystem: Carregando tema para o sistema ${system.name}`
    );
    try {
      await this.themeManager.loadSystemTheme(system.name);
      console.log("App.selectSystem: Tema do sistema carregado com sucesso");
    } catch (error) {
      console.error(
        "App.selectSystem: Erro ao carregar tema do sistema:",
        error
      );
    }

    // Ativar navegação para lista de jogos
    console.log("App.selectSystem: Ativando navegação para lista de jogos");
    const gamelistNav = document.querySelector(
      '#navigation li[data-screen="gamelist"]'
    );
    if (gamelistNav) {
      gamelistNav.classList.remove("disabled");
      console.log("App.selectSystem: Navegação para lista de jogos ativada");
    } else {
      console.error(
        "App.selectSystem: Elemento de navegação para lista de jogos não encontrado"
      );
    }

    // Carregar lista de jogos
    console.log(
      `App.selectSystem: Iniciando carregamento de jogos para ${system.name}`
    );
    try {
      const result = await this.gamelistScreen.loadGames(system.name);
      console.log(
        "App.selectSystem: Resultado do carregamento de jogos:",
        result
      );
    } catch (error) {
      console.error("App.selectSystem: Erro ao carregar jogos:", error);
    }

    // Mostrar tela de lista de jogos
    console.log("App.selectSystem: Exibindo tela de lista de jogos");
    this.showScreen("gamelist");
    this.updateNavigation("gamelist");
    console.log("App.selectSystem: Processo concluído");
  }

  addEventListeners() {
    console.log("Configurando event listeners...");

    // Método de fallback para onGameLaunched
    if (window.api && typeof window.api.onGameLaunched === "function") {
      window.api.onGameLaunched((event, data) => {
        console.log("Jogo iniciado:", data);
      });
    } else {
      console.log("API onGameLaunched não está disponível, usando fallback");
      // Se a função não estiver disponível, podemos monitorar de outra forma
      // ou simplesmente ignorar esta funcionalidade
    }

    // Configurar navegação
    this.setupNavigation();

    // Botão voltar da lista de jogos
    const backButton = document.getElementById("back-to-systems");
    if (backButton) {
      backButton.addEventListener("click", () => {
        this.showScreen("systems");
        this.updateNavigation("systems");
      });
    }

    // Botão voltar das configurações
    const backFromSettingsButton =
      document.getElementById("back-from-settings");
    if (backFromSettingsButton) {
      backFromSettingsButton.addEventListener("click", () => {
        this.showScreen("systems");
        this.updateNavigation("systems");
      });
    }

    console.log("Event listeners configurados com sucesso");
  }

  // Método para trocar o tema atual
  async changeTheme(themeName) {
    const success = await this.themeManager.changeTheme(themeName);
    if (success) {
      // Atualizar a visualização da tela atual
      const activeScreen = document.querySelector(".screen.active");
      if (activeScreen) {
        const screenId = activeScreen.id.replace("-screen", "");

        // Forçar a recarga dos sistemas quando o tema é alterado
        if (screenId === "systems") {
          this.systemsScreen.loadSystems(true); // Forçar recarga
        } else {
          this.showScreen(screenId);
        }
      }

      // Forçar uma recarga completa dos estilos
      await this.themeManager.loadThemeStyles();
    }
    return success;
  }
}

// Iniciar aplicativo quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
