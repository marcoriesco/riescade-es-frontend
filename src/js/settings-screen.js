export class SettingsScreen {
  constructor(app) {
    this.app = app;
    this.container = document.querySelector(".settings-container");
    this.settings = {};

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
}
