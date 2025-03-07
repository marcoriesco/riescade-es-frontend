export class SettingsScreen {
  constructor(app) {
    console.log("[SettingsScreen] Inicializando SettingsScreen");
    this.app = app;
    this.container = document.querySelector(".settings-container");
    this.settings = {};
    this.modalOpen = false;

    // Log para verificar se a instância foi criada corretamente
    console.log(
      "[SettingsScreen] Instância criada com modalOpen =",
      this.modalOpen
    );

    // Verificar se a API local está disponível
    if (!window.api) {
      console.error("SettingsScreen: API do Electron não disponível");
    } else if (!window.api.localApi) {
      console.error("SettingsScreen: API local não disponível");
    } else {
      console.log("SettingsScreen: API local detectada");
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Botão para salvar configurações
    const saveBtn = document.getElementById("save-settings");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveSettings());
    }

    // Selecionar diretório de ROMs
    const browseRomsDir = document.getElementById("browse-roms-dir");
    if (browseRomsDir) {
      browseRomsDir.addEventListener("click", () =>
        this.browseDirectory("roms")
      );
    }

    // Selecionar diretório de EmulationStation
    const browseEmulationStationDir = document.getElementById(
      "browse-emulationstation-dir"
    );
    if (browseEmulationStationDir) {
      browseEmulationStationDir.addEventListener("click", () =>
        this.browseDirectory("emulationstation")
      );
    }

    // Selecionar diretório de emuladores
    const browseEmulatorsDir = document.getElementById("browse-emulators-dir");
    if (browseEmulatorsDir) {
      browseEmulatorsDir.addEventListener("click", () =>
        this.browseDirectory("emulators")
      );
    }

    // Tema
    const themeSelector = document.getElementById("theme-selector");
    if (themeSelector) {
      this.populateThemeSelector(themeSelector);
      themeSelector.addEventListener("change", (e) =>
        this.changeTheme(e.target.value)
      );
    }

    // Modo de tela cheia
    const fullscreenCheckbox = document.getElementById("fullscreen-mode");
    if (fullscreenCheckbox) {
      // Obter configuração salva
      window.api.getSettings().then((settings) => {
        if (settings && typeof settings.fullscreen !== "undefined") {
          fullscreenCheckbox.checked = settings.fullscreen;
        }
      });
    }
  }

  // Novo método para alternar a visibilidade do modal
  toggleSettingsModal() {
    console.log("[SettingsScreen] Método toggleSettingsModal chamado");

    try {
      console.log("[SettingsScreen] Estado atual do modal:", this.modalOpen);

      if (this.modalOpen) {
        console.log("[SettingsScreen] Fechando modal...");
        this.closeSettingsModal();
      } else {
        console.log("[SettingsScreen] Abrindo modal...");
        this.openSettingsModal();
      }

      console.log("[SettingsScreen] Novo estado do modal:", this.modalOpen);
    } catch (error) {
      console.error("[SettingsScreen] Erro ao alternar modal:", error);
    }
  }

  // Novo método para criar e abrir o modal
  openSettingsModal() {
    console.log("[SettingsScreen] Método openSettingsModal chamado");

    if (this.modalOpen) {
      console.log("[SettingsScreen] Modal já está aberto, saindo...");
      return;
    }

    // Adicionar classe ao body para impedir scroll
    document.body.classList.add("modal-open");

    // Criar o modal se ainda não existir
    let modalElement = document.getElementById("settings-menu-modal");
    console.log("[SettingsScreen] Modal existe?", !!modalElement);

    if (!modalElement) {
      console.log("[SettingsScreen] Criando novo elemento modal...");

      try {
        modalElement = document.createElement("div");
        modalElement.id = "settings-menu-modal";
        modalElement.className = "settings-menu-modal";

        // Estrutura do modal com estilos inline para garantir que seja visível
        modalElement.style.position = "fixed";
        modalElement.style.top = "0";
        modalElement.style.left = "0";
        modalElement.style.width = "100%";
        modalElement.style.height = "100%";
        modalElement.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
        modalElement.style.display = "flex";
        modalElement.style.justifyContent = "center";
        modalElement.style.alignItems = "center";
        modalElement.style.zIndex = "9999";

        // Estrutura do modal - atualizada para se parecer com a imagem
        modalElement.innerHTML = `
          <div class="settings-menu-content" style="background-color: #f2f2f2; width: 60%; max-width: 700px; padding: 20px;">
            <h2 class="settings-menu-title">MAIN MENU</h2>
            <ul class="settings-menu-list">
              <li class="settings-menu-item" data-action="scraper" tabindex="0">SCRAPER <span class="arrow">›</span></li>
              <li class="settings-menu-item" data-action="sound" tabindex="0">SOUND SETTINGS <span class="arrow">›</span></li>
              <li class="settings-menu-item" data-action="ui" tabindex="0">UI SETTINGS <span class="arrow">›</span></li>
              <li class="settings-menu-item" data-action="collection" tabindex="0">GAME COLLECTION SETTINGS <span class="arrow">›</span></li>
              <li class="settings-menu-item" data-action="other" tabindex="0">OTHER SETTINGS <span class="arrow">›</span></li>
              <li class="settings-menu-item" data-action="input" tabindex="0">CONFIGURE INPUT <span class="arrow">›</span></li>
              <li class="settings-menu-item" data-action="quit" tabindex="0">QUIT <span class="arrow">›</span></li>
            </ul>
            <div class="settings-menu-footer">
              <span class="version-info">EMULATIONSTATION V2.6.4RP</span>
            </div>
          </div>
        `;

        console.log("[SettingsScreen] Adicionando modal ao body");
        document.body.appendChild(modalElement);

        // Verificar se o modal foi adicionado ao DOM
        const addedModal = document.getElementById("settings-menu-modal");
        console.log("[SettingsScreen] Modal adicionado ao DOM?", !!addedModal);

        // Adicionar event listeners para as opções do menu
        const menuItems = modalElement.querySelectorAll(".settings-menu-item");
        console.log(
          "[SettingsScreen] Número de itens de menu:",
          menuItems.length
        );

        menuItems.forEach((item) => {
          item.addEventListener("click", (e) => {
            const action = e.currentTarget.getAttribute("data-action");
            console.log("[SettingsScreen] Item clicado:", action);
            this.handleMenuAction(action);
          });

          // Adicionar suporte a navegação com teclado (Enter)
          item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.keyCode === 13) {
              const action = e.currentTarget.getAttribute("data-action");
              this.handleMenuAction(action);
            }
          });
        });

        // Fechar ao clicar fora do modal
        modalElement.addEventListener("click", (e) => {
          if (e.target === modalElement) {
            console.log("[SettingsScreen] Clique fora do modal detectado");
            this.closeSettingsModal();
          }
        });

        // Navegação por teclado
        this.setupKeyboardNavigation(modalElement);
      } catch (error) {
        console.error("[SettingsScreen] Erro ao criar modal:", error);
        return;
      }
    }

    // Mostrar o modal
    console.log("[SettingsScreen] Definindo display como flex");
    modalElement.style.display = "flex";
    this.modalOpen = true;

    // Selecionar o primeiro item por padrão
    const firstItem = modalElement.querySelector(".settings-menu-item");
    if (firstItem) {
      console.log("[SettingsScreen] Focando primeiro item");
      firstItem.focus();
      firstItem.classList.add("active");
    }

    console.log(
      "[SettingsScreen] Modal aberto com sucesso, modalOpen =",
      this.modalOpen
    );
  }

  setupKeyboardNavigation(modalElement) {
    let currentIndex = 0;
    const menuItems = modalElement.querySelectorAll(".settings-menu-item");

    // Handler para teclas de navegação
    const keyHandler = (e) => {
      if (!this.modalOpen) return;

      // Mapeamento de teclas
      const KEY_UP = 38;
      const KEY_DOWN = 40;
      const KEY_ENTER = 13;
      const KEY_ESC = 27;

      switch (e.keyCode) {
        case KEY_UP:
          e.preventDefault();
          this.navigateMenu(menuItems, currentIndex, -1);
          currentIndex = Math.max(0, currentIndex - 1);
          break;
        case KEY_DOWN:
          e.preventDefault();
          this.navigateMenu(menuItems, currentIndex, 1);
          currentIndex = Math.min(menuItems.length - 1, currentIndex + 1);
          break;
        case KEY_ENTER:
          e.preventDefault();
          if (menuItems[currentIndex]) {
            const action = menuItems[currentIndex].getAttribute("data-action");
            this.handleMenuAction(action);
          }
          break;
        case KEY_ESC:
          e.preventDefault();
          this.closeSettingsModal();
          break;
      }
    };

    // Adicionar event listener
    document.addEventListener("keydown", keyHandler);

    // Adicionar suporte para gamepad (se disponível)
    if (window.api && window.api.onGamepadAxis) {
      window.api.onGamepadAxis((axis, value) => {
        if (!this.modalOpen) return;

        // Eixo vertical (normalmente eixo 1 em controles padrão)
        if (axis === 1 || axis === "vertical") {
          if (value > 0.5) {
            // Para baixo
            this.navigateMenu(menuItems, currentIndex, 1);
            currentIndex = Math.min(menuItems.length - 1, currentIndex + 1);
          } else if (value < -0.5) {
            // Para cima
            this.navigateMenu(menuItems, currentIndex, -1);
            currentIndex = Math.max(0, currentIndex - 1);
          }
        }
      });

      // Botão A ou X para selecionar
      window.api.onGamepadButton((button, pressed) => {
        if (!this.modalOpen || !pressed) return;

        // Botão A (0) ou X (2) para confirmar
        if (button === 0 || button === 2 || button === "A" || button === "X") {
          if (menuItems[currentIndex]) {
            const action = menuItems[currentIndex].getAttribute("data-action");
            this.handleMenuAction(action);
          }
        }

        // Botão B para cancelar
        if (button === 1 || button === "B") {
          this.closeSettingsModal();
        }
      });
    }
  }

  navigateMenu(menuItems, currentIndex, direction) {
    // Remover classe ativa do item atual
    menuItems.forEach((item) => item.classList.remove("active"));

    // Calcular novo índice
    const nextIndex = Math.max(
      0,
      Math.min(menuItems.length - 1, currentIndex + direction)
    );

    // Adicionar classe ativa e focar no novo item
    if (menuItems[nextIndex]) {
      menuItems[nextIndex].classList.add("active");
      menuItems[nextIndex].focus();
    }
  }

  // Fechar o modal
  closeSettingsModal() {
    console.log("[SettingsScreen] Método closeSettingsModal chamado");

    try {
      const modalElement = document.getElementById("settings-menu-modal");
      console.log(
        "[SettingsScreen] Modal encontrado para fechar?",
        !!modalElement
      );

      if (modalElement) {
        console.log("[SettingsScreen] Ocultando modal");
        modalElement.style.display = "none";
      } else {
        console.warn("[SettingsScreen] Modal não encontrado para fechar");
      }

      // Remover classe do body para permitir scroll novamente
      document.body.classList.remove("modal-open");

      this.modalOpen = false;
      console.log(
        "[SettingsScreen] Modal fechado, modalOpen =",
        this.modalOpen
      );
    } catch (error) {
      console.error("[SettingsScreen] Erro ao fechar modal:", error);
    }
  }

  // Manipular ações do menu
  handleMenuAction(action) {
    console.log(`Ação selecionada: ${action}`);

    switch (action) {
      case "scraper":
        // Implementar ação de scraper
        break;
      case "sound":
        // Implementar configurações de som
        break;
      case "ui":
        // Implementar configurações de UI
        break;
      case "collection":
        // Implementar configurações de coleção de jogos
        break;
      case "other":
        // Mostrar configurações do sistema
        this.showSettingsPage();
        return; // Não fechar o modal
      case "input":
        // Implementar configuração de entrada
        break;
      case "quit":
        // Implementar ação de sair
        if (window.api && window.api.quit) {
          window.api.quit();
        } else {
          window.close();
        }
        break;
    }

    // Fechar o modal após a ação (exceto para 'other' que já retornou antes)
    this.closeSettingsModal();
  }

  // Método para mostrar a página de configurações dentro do modal
  showSettingsPage() {
    console.log("[SettingsScreen] Mostrando página de configurações");

    // Obter o modal
    const modalElement = document.getElementById("settings-menu-modal");
    if (!modalElement) {
      console.error("[SettingsScreen] Modal não encontrado!");
      return;
    }

    // Salvar o conteúdo original para poder voltar
    const originalContent = modalElement.querySelector(
      ".settings-menu-content"
    );
    if (originalContent) {
      // Esconder o menu principal
      originalContent.style.display = "none";
    }

    // Criar a página de configurações
    const settingsPage = document.createElement("div");
    settingsPage.className = "settings-page-content";

    // Estrutura da página de configurações
    settingsPage.innerHTML = `
      <div class="settings-page-header">
        <button id="back-to-main-menu" class="back-button">← Voltar</button>
        <h2>OTHER SETTINGS</h2>
      </div>
      
      <div class="settings-page-body">
        <!-- Seção de Tema -->
        <div class="settings-section">
          <h3>Tema</h3>
          <div class="setting-item">
            <label for="theme-selector">Selecionar Tema:</label>
            <select id="theme-selector" class="theme-selector">
              <option value="default">Padrão</option>
            </select>
          </div>
        </div>

        <!-- Seção de Diretórios -->
        <div class="settings-section">
          <h3>Diretórios</h3>
          <div class="setting-item">
            <label for="roms-dir">Diretório de ROMs:</label>
            <div class="directory-input">
              <input type="text" id="roms-dir" readonly>
              <button id="browse-roms-dir" class="browse-button">Procurar</button>
            </div>
          </div>
          
          <div class="setting-item">
            <label for="emulators-dir">Diretório de Emuladores:</label>
            <div class="directory-input">
              <input type="text" id="emulators-dir" readonly>
              <button id="browse-emulators-dir" class="browse-button">Procurar</button>
            </div>
          </div>
          
          <div class="setting-item">
            <label for="emulationstation-dir">Diretório do EmulationStation:</label>
            <div class="directory-input">
              <input type="text" id="emulationstation-dir" readonly>
              <button id="browse-emulationstation-dir" class="browse-button">Procurar</button>
            </div>
          </div>
        </div>

        <!-- Seção de Interface -->
        <div class="settings-section">
          <h3>Interface</h3>
          <div class="setting-item">
            <label class="checkbox-label">
              <input type="checkbox" id="fullscreen-mode">
              Modo Tela Cheia
            </label>
          </div>
        </div>
      </div>
      
      <div class="settings-page-footer">
        <button id="save-settings" class="save-button">Salvar Configurações</button>
      </div>
    `;

    // Adicionar ao modal
    modalElement.appendChild(settingsPage);

    // Configurar evento para o botão voltar
    const backButton = document.getElementById("back-to-main-menu");
    if (backButton) {
      backButton.addEventListener("click", () => {
        // Remover a página de configurações
        settingsPage.remove();
        // Mostrar o menu principal novamente
        if (originalContent) {
          originalContent.style.display = "flex";
        }
      });
    }

    // Configurar outros eventos na página de configurações
    this.setupSettingsPageEvents();

    // Preencher seletores com dados
    this.populateSettingsPage();
  }

  // Configurar eventos da página de configurações
  setupSettingsPageEvents() {
    // Botão para salvar configurações
    const saveBtn = document.getElementById("save-settings");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.saveSettings();

        // Voltar para o menu principal após salvar
        const settingsPage = document.querySelector(".settings-page-content");
        const originalContent = document.querySelector(
          ".settings-menu-content"
        );

        if (settingsPage) {
          settingsPage.remove();
        }

        if (originalContent) {
          originalContent.style.display = "flex";
        }
      });
    }

    // Selecionar diretório de ROMs
    const browseRomsDir = document.getElementById("browse-roms-dir");
    if (browseRomsDir) {
      browseRomsDir.addEventListener("click", () =>
        this.browseDirectory("roms")
      );
    }

    // Selecionar diretório de EmulationStation
    const browseEmulationStationDir = document.getElementById(
      "browse-emulationstation-dir"
    );
    if (browseEmulationStationDir) {
      browseEmulationStationDir.addEventListener("click", () =>
        this.browseDirectory("emulationstation")
      );
    }

    // Selecionar diretório de emuladores
    const browseEmulatorsDir = document.getElementById("browse-emulators-dir");
    if (browseEmulatorsDir) {
      browseEmulatorsDir.addEventListener("click", () =>
        this.browseDirectory("emulators")
      );
    }

    // Tema
    const themeSelector = document.getElementById("theme-selector");
    if (themeSelector) {
      this.populateThemeSelector(themeSelector);
      themeSelector.addEventListener("change", (e) =>
        this.changeTheme(e.target.value)
      );
    }
  }

  // Preencher os campos da página de configurações
  async populateSettingsPage() {
    try {
      // Obter configurações salvas
      let settings = {};
      if (window.api && window.api.getSettings) {
        settings = await window.api.getSettings();
      }

      // Preencher campos de diretórios
      if (settings.paths) {
        const dirTypes = ["roms", "emulationstation", "emulators"];
        dirTypes.forEach((dirType) => {
          const dirInput = document.getElementById(`${dirType}-dir`);
          if (dirInput && settings.paths[dirType]) {
            dirInput.value = settings.paths[dirType];
          }
        });
      }

      // Configurar modo de tela cheia
      const fullscreenCheckbox = document.getElementById("fullscreen-mode");
      if (fullscreenCheckbox && typeof settings.fullscreen !== "undefined") {
        fullscreenCheckbox.checked = settings.fullscreen;
      }

      // O tema já é configurado pelo populateThemeSelector
    } catch (error) {
      console.error(
        "[SettingsScreen] Erro ao preencher página de configurações:",
        error
      );
    }
  }

  async populateThemeSelector(selector) {
    try {
      // Limpar opções existentes
      selector.innerHTML = "";

      // Obter temas disponíveis
      const themes = await this.app.themeManager.getAvailableThemes();

      // Criar opções para cada tema
      themes.forEach((theme) => {
        const option = document.createElement("option");
        option.value = theme;
        option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
        selector.appendChild(option);
      });

      // Selecionar tema atual
      selector.value = this.app.themeManager.activeTheme;
    } catch (error) {
      console.error("Erro ao popular seletor de temas:", error);
    }
  }

  async changeTheme(themeName) {
    await this.app.changeTheme(themeName);
  }

  async browseDirectory(dirType) {
    try {
      const result = await window.api.browseDirectory(dirType);

      if (result && result.path) {
        const dirInput = document.getElementById(`${dirType}-dir`);
        if (dirInput) {
          dirInput.value = result.path;
        }
      }
    } catch (error) {
      console.error(`Erro ao selecionar diretório ${dirType}:`, error);
    }
  }

  async saveSettings() {
    try {
      const settings = {
        paths: {},
        fullscreen: document.getElementById("fullscreen-mode").checked,
        theme: document.getElementById("theme-selector").value,
      };

      // Obter caminhos dos inputs
      const dirTypes = ["roms", "emulationstation", "emulators"];

      dirTypes.forEach((dirType) => {
        const dirInput = document.getElementById(`${dirType}-dir`);
        if (dirInput && dirInput.value) {
          settings.paths[dirType] = dirInput.value;
        }
      });

      const result = await window.api.saveSettings(settings);

      if (result.success) {
        alert("Configurações salvas com sucesso!");

        // Aplicar configurações
        if (settings.theme) {
          await this.app.changeTheme(settings.theme);
        }
      } else {
        alert(`Erro ao salvar configurações: ${result.error}`);
      }
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert(`Erro ao salvar configurações: ${error.message}`);
    }
  }

  async loadSettings() {
    try {
      const settings = await window.api.getSettings();

      if (settings) {
        // Atualizar inputs com os caminhos
        if (settings.paths) {
          Object.keys(settings.paths).forEach((dirType) => {
            const dirInput = document.getElementById(`${dirType}-dir`);
            if (dirInput) {
              dirInput.value = settings.paths[dirType];
            }
          });
        }

        // Atualizar tema
        if (settings.theme) {
          const themeSelector = document.getElementById("theme-selector");
          if (themeSelector) {
            themeSelector.value = settings.theme;
          }
        }

        // Atualizar modo de tela cheia
        if (typeof settings.fullscreen !== "undefined") {
          const fullscreenCheckbox = document.getElementById("fullscreen-mode");
          if (fullscreenCheckbox) {
            fullscreenCheckbox.checked = settings.fullscreen;
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  }

  // Método auxiliar para testes - chamar diretamente esta função no console do browser
  // Como: app.settingsScreen.testModal()
  testModal() {
    console.log("[SettingsScreen] Método de teste chamado");

    // Verificar a existência de CSS
    const styleSheets = document.styleSheets;
    let settingsCssFound = false;

    console.log("[SettingsScreen.test] Verificando folhas de estilo:");
    for (let i = 0; i < styleSheets.length; i++) {
      try {
        const href = styleSheets[i].href || "";
        console.log(`[SettingsScreen.test] StyleSheet ${i}: ${href}`);
        if (href.includes("settings.css")) {
          settingsCssFound = true;
          console.log("[SettingsScreen.test] CSS de settings encontrado!");
        }
      } catch (e) {
        console.log(`[SettingsScreen.test] Erro ao acessar stylesheet ${i}`);
      }
    }

    if (!settingsCssFound) {
      console.warn(
        "[SettingsScreen.test] CSS de settings não encontrado! Adicionando..."
      );
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "src/css/settings.css";
      document.head.appendChild(link);
    }

    // Criar um modal diretamente
    console.log("[SettingsScreen.test] Criando modal de teste");
    const testModal = document.createElement("div");
    testModal.id = "test-settings-modal";
    testModal.style.position = "fixed";
    testModal.style.top = "0";
    testModal.style.left = "0";
    testModal.style.width = "100%";
    testModal.style.height = "100%";
    testModal.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    testModal.style.display = "flex";
    testModal.style.justifyContent = "center";
    testModal.style.alignItems = "center";
    testModal.style.zIndex = "10000";

    testModal.innerHTML = `
      <div style="background-color: #f2f2f2; width: 60%; max-width: 700px; color: #555; padding: 20px;">
        <h2 style="color: #555; text-align: center; font-size: 24px;">MODAL DE TESTE</h2>
        <p style="text-align: center;">Se você está vendo este modal, o problema não é com o CSS.</p>
        <div style="text-align: center; margin-top: 20px;">
          <button id="close-test-modal" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; cursor: pointer;">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(testModal);

    // Adicionar evento para fechar
    const closeButton = document.getElementById("close-test-modal");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        testModal.remove();
      });
    }

    // Também testar o modal normal
    console.log("[SettingsScreen.test] Tentando abrir o modal normal");
    this.openSettingsModal();

    return "Modal de teste criado. Verifique a tela.";
  }
}
