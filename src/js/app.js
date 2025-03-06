import { SystemsScreen } from "./systems-screen.js";
import { GameListScreen } from "./gamelist-screen.js";
import { SettingsScreen } from "./settings-screen.js";
import { ThemeManager } from "./theme-manager.js";
import { ConfigParser } from "./config-parser.js";

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
      // Inicializar os componentes
      this.themeManager = new ThemeManager();

      // Carregar configurações
      await this.loadSettings();

      try {
        // Inicializar gerenciador de temas
        await this.themeManager.init();

        // Aplicar tema à tela de sistemas
        this.applySystemsTheme();
      } catch (themeError) {
        // Silenciosamente lidar com erros de tema, não impedindo o restante da inicialização
        console.error("Erro ao inicializar tema:", themeError);
      }

      // Carregar lista de sistemas
      await this.systemsScreen.loadSystems();

      // Adicionar event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error("Erro ao inicializar o aplicativo:", error);
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
      // Atualizar estado do aplicativo
      this.currentSystem = system;

      console.log("Selecionando sistema:", system.name);

      // Usar o themeManager para mudar para a visualização da lista de jogos
      const viewChanged = this.themeManager.changeView("gamelist");
      if (!viewChanged) {
        console.error("Falha ao mudar para a visualização da lista de jogos");
      }

      // Atualizar nome do sistema na interface
      const systemNameElement = document.getElementById("current-system-name");
      if (systemNameElement) {
        systemNameElement.textContent = system.name || "Sistema Desconhecido";
      }

      // Mostrar tela de carregamento enquanto carregamos os dados do sistema
      await this.gameListScreen.showLoading(
        `Carregando sistema ${system.name}...`
      );

      // Carregar contagem de jogos para o sistema selecionado
      if (system.gameCount === -1) {
        await this.systemsScreen.loadSystemGameCount(system.name);
      }

      // Habilitar item da lista de jogos na navegação
      const gamelistNavItem = document.querySelector(
        '#navigation li[data-screen="gamelist"]'
      );
      if (gamelistNavItem) {
        gamelistNavItem.classList.remove("disabled");
      }

      // Carregar jogos
      await this.gameListScreen.loadGames(system.name);
    } catch (error) {
      console.error("Erro ao selecionar sistema:", error);
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

  async loadSettings() {
    await this.settingsScreen.loadSettings();
  }
}

// Iniciar aplicativo quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
