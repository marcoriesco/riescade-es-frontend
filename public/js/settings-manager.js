/**
 * Gerenciador de configurações do RIESCADE
 * Responsável por criar e gerenciar o modal de configurações
 */
class SettingsManager {
  constructor() {
    this.modal = null;
    this.themes = [];
    this.currentTheme = null;
    this.originalSettings = {};
    this.currentSettings = {};
    this.isInitialized = false;
    this.selectedThemeId = null;

    // Vincular métodos ao contexto da classe
    this.showModal = this.showModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.saveSettings = this.saveSettings.bind(this);
    this.cancelSettings = this.cancelSettings.bind(this);
    this.setCurrentTheme = this.setCurrentTheme.bind(this);
    this.updateSetting = this.updateSetting.bind(this);

    // Inicializar quando o documento estiver pronto
    document.addEventListener("DOMContentLoaded", () => this.init());

    // Adicionar listener para a tecla de espaço
    document.addEventListener("keydown", (e) => {
      if (
        e.code === "Space" &&
        !this.isModalVisible() &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName
        )
      ) {
        e.preventDefault();
        this.showModal();
      } else if (e.code === "Escape" && this.isModalVisible()) {
        this.closeModal();
      }
    });
  }

  /**
   * Inicializa o gerenciador de configurações
   */
  async init() {
    if (this.isInitialized) return;

    try {
      console.log("Inicializando SettingsManager...");

      // Carregar temas disponíveis
      const themesResponse = await fetch("/api/frontend/themes");
      if (!themesResponse.ok) {
        throw new Error(
          `Erro ao carregar temas: ${themesResponse.status} ${themesResponse.statusText}`
        );
      }

      const themesData = await themesResponse.json();
      console.log("Temas carregados:", themesData);

      if (themesData.success && themesData.data) {
        this.themes = themesData.data;
      } else {
        this.themes = themesData.themes || [];
      }

      console.log("Temas disponíveis:", this.themes);

      // Carregar tema atual
      const currentThemeResponse = await fetch(
        "/api/frontend/themes/current?refresh=true"
      );
      if (!currentThemeResponse.ok) {
        throw new Error(
          `Erro ao carregar tema atual: ${currentThemeResponse.status} ${currentThemeResponse.statusText}`
        );
      }

      const currentThemeData = await currentThemeResponse.json();
      console.log("Tema atual carregado:", currentThemeData);

      if (currentThemeData.success && currentThemeData.data) {
        this.currentTheme = currentThemeData.data;
      } else {
        this.currentTheme = currentThemeData;
      }

      this.selectedThemeId = this.currentTheme.id;

      console.log("Tema atual:", this.currentTheme);

      // Armazenar configurações originais
      console.log("Processando configurações iniciais...");
      console.log("Configurações do tema:", this.currentTheme.settings);

      // Converter as configurações do array para um objeto para facilitar o acesso
      this.originalSettings = {};
      if (
        this.currentTheme.settings &&
        Array.isArray(this.currentTheme.settings)
      ) {
        this.currentTheme.settings.forEach((setting) => {
          this.originalSettings[setting.id] =
            setting.value !== undefined ? setting.value : setting.default;
        });
      }

      console.log(
        "Configurações originais inicializadas:",
        this.originalSettings
      );

      // Copiar as configurações originais para as configurações atuais
      this.currentSettings = JSON.parse(JSON.stringify(this.originalSettings));
      console.log("Configurações atuais inicializadas:", this.currentSettings);

      // Criar o modal
      this.createModal();

      this.isInitialized = true;
      console.log("SettingsManager inicializado com sucesso");
    } catch (error) {
      console.error("Erro ao inicializar o SettingsManager:", error);
    }
  }

  /**
   * Cria o elemento do modal
   */
  createModal() {
    // Verificar se o modal já existe
    if (this.modal) return;

    // Criar o elemento do modal
    this.modal = document.createElement("div");
    this.modal.className = "settings-modal";

    // Estrutura do modal
    this.modal.innerHTML = `
      <div class="settings-modal-content">
        <div class="settings-modal-header">
          <h2>Configurações</h2>
          <button class="settings-modal-close">&times;</button>
        </div>
        <div class="settings-modal-body">
          <div class="settings-section theme-selection-section">
            <h3>Selecionar Tema</h3>
            <div class="theme-selector"></div>
          </div>
          <div class="settings-section theme-info-section">
            <h3>Informações do Tema Atual</h3>
            <div class="theme-info"></div>
          </div>
          <div class="settings-section theme-settings-section">
            <h3>Configurações do Tema</h3>
            <div class="theme-settings"></div>
          </div>
        </div>
        <div class="settings-modal-footer">
          <button class="settings-modal-cancel">Cancelar</button>
          <button class="settings-modal-save">Salvar</button>
        </div>
      </div>
    `;

    // Adicionar o modal ao corpo do documento
    document.body.appendChild(this.modal);

    // Configurar event listeners
    this.setupEventListeners();
  }

  /**
   * Configura os event listeners para o modal
   */
  setupEventListeners() {
    // Botão de fechar
    const closeButton = this.modal.querySelector(".settings-modal-close");
    closeButton.addEventListener("click", this.closeModal);

    // Botão de cancelar
    const cancelButton = this.modal.querySelector(".settings-modal-cancel");
    cancelButton.addEventListener("click", this.cancelSettings);

    // Botão de salvar
    const saveButton = this.modal.querySelector(".settings-modal-save");
    saveButton.addEventListener("click", this.saveSettings);

    // Fechar ao clicar fora do conteúdo
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });
  }

  /**
   * Mostra o modal de configurações
   */
  async showModal() {
    console.log("Abrindo modal de configurações...");

    if (!this.isInitialized) {
      console.log("SettingsManager não inicializado, inicializando...");
      await this.init();
    } else {
      // Recarregar o tema atual para obter as configurações atualizadas
      try {
        console.log(
          "Recarregando tema atual para obter configurações atualizadas..."
        );

        // Limpar o cache do tema atual para forçar uma nova requisição
        if (ESAPI && ESAPI.clearCache) {
          console.log("Limpando cache do tema atual...");
          ESAPI.clearCache("currentTheme");
        }

        // Carregar tema atual com refresh=true para forçar uma nova requisição
        console.log("Fazendo requisição para obter o tema atual...");
        const currentThemeResponse = await fetch(
          "/api/frontend/themes/current?refresh=true"
        );

        if (!currentThemeResponse.ok) {
          throw new Error(
            `Erro ao recarregar tema atual: ${currentThemeResponse.status} ${currentThemeResponse.statusText}`
          );
        }

        const currentThemeData = await currentThemeResponse.json();
        console.log("Tema atual recarregado:", currentThemeData);

        if (currentThemeData.success && currentThemeData.data) {
          this.currentTheme = currentThemeData.data;
        } else {
          this.currentTheme = currentThemeData;
        }

        this.selectedThemeId = this.currentTheme.id;

        // Atualizar configurações originais
        console.log(
          "Atualizando configurações originais com os dados do servidor..."
        );
        console.log("Configurações do tema:", this.currentTheme.settings);

        // Converter as configurações do array para um objeto para facilitar o acesso
        this.originalSettings = {};
        if (
          this.currentTheme.settings &&
          Array.isArray(this.currentTheme.settings)
        ) {
          this.currentTheme.settings.forEach((setting) => {
            this.originalSettings[setting.id] =
              setting.value !== undefined ? setting.value : setting.default;
          });
        }

        console.log(
          "Configurações originais atualizadas:",
          this.originalSettings
        );

        // Copiar as configurações originais para as configurações atuais
        this.currentSettings = JSON.parse(
          JSON.stringify(this.originalSettings)
        );
        console.log("Configurações atuais atualizadas:", this.currentSettings);
      } catch (error) {
        console.error("Erro ao recarregar tema atual:", error);
      }
    }

    // Atualizar o nome do tema atual
    const currentThemeName = document.getElementById("current-theme-name");
    if (currentThemeName && this.currentTheme) {
      currentThemeName.textContent =
        this.currentTheme.name || this.currentTheme.id;
    }

    // Atualizar o conteúdo do modal
    this.renderThemeSelector();
    this.renderThemeSettings();
    this.renderThemeInfo();

    // Mostrar o modal
    this.modal.classList.add("visible");
  }

  /**
   * Verifica se o modal está visível
   */
  isModalVisible() {
    return this.modal && this.modal.classList.contains("visible");
  }

  /**
   * Fecha o modal sem salvar alterações
   */
  closeModal() {
    if (this.modal) {
      this.modal.classList.remove("visible");
    }
  }

  /**
   * Cancela as alterações e fecha o modal
   */
  cancelSettings() {
    // Restaurar configurações originais
    this.currentSettings = JSON.parse(JSON.stringify(this.originalSettings));
    this.closeModal();
  }

  /**
   * Salva as configurações e fecha o modal
   */
  async saveSettings() {
    try {
      console.log("Salvando configurações...");
      console.log("Tema atual:", this.currentTheme.id);
      console.log("Tema selecionado:", this.selectedThemeId);
      console.log("Configurações atualizadas:", this.currentSettings);

      // Verificar se o tema foi alterado
      if (this.currentTheme.id !== this.selectedThemeId) {
        console.log(
          `Alterando tema de ${this.currentTheme.id} para ${this.selectedThemeId}`
        );
        await this.setCurrentTheme(this.selectedThemeId);
      } else {
        // Salvar configurações atualizadas
        const updatedSettings = [];

        // Obter o tema selecionado
        const selectedTheme =
          this.themes.find((t) => t.id === this.selectedThemeId) ||
          this.currentTheme;

        // Para cada configuração no tema
        if (selectedTheme.settings && Array.isArray(selectedTheme.settings)) {
          for (const setting of selectedTheme.settings) {
            const settingId = setting.id;

            // Se a configuração foi alterada
            if (this.currentSettings[settingId] !== undefined) {
              console.log(
                `Configuração alterada: ${settingId} = ${this.currentSettings[settingId]}`
              );

              // Adicionar à lista de configurações atualizadas
              updatedSettings.push({
                id: settingId,
                value: this.currentSettings[settingId],
              });
            }
          }
        }

        // Se houver configurações atualizadas
        if (updatedSettings.length > 0) {
          console.log("Enviando configurações atualizadas:", updatedSettings);

          // Enviar as configurações atualizadas para a API
          const response = await fetch(
            `/api/frontend/themes/${this.selectedThemeId}/settings`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ settings: updatedSettings }),
            }
          );

          if (!response.ok) {
            throw new Error(
              `Erro ao atualizar configurações: ${response.status} ${response.statusText}`
            );
          }

          console.log("Configurações atualizadas com sucesso!");

          // Atualizar o cache da API ESAPI
          if (ESAPI && ESAPI.clearCache) {
            ESAPI.clearCache("currentTheme");
          }

          // Notificar a API ESAPI sobre a alteração das configurações
          if (ESAPI && typeof ESAPI.notifySettingsChange === "function") {
            ESAPI.notifySettingsChange();
          }

          // Fechar o modal
          this.closeModal();

          // Recarregar a página para aplicar as alterações
          // window.location.reload();
        } else {
          console.log("Nenhuma configuração foi alterada.");

          // Fechar o modal
          this.closeModal();
        }
      }
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert(`Erro ao salvar configurações: ${error.message}`);
    }
  }

  /**
   * Define o tema atual
   */
  async setCurrentTheme(themeId) {
    try {
      console.log(`Alterando tema para: ${themeId}`);

      const response = await fetch("/api/frontend/themes/current", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themeId }),
      });

      console.log("Resposta da API:", response);

      if (response.ok) {
        console.log(`Tema alterado com sucesso para: ${themeId}`);

        // Fechar o modal
        this.closeModal();

        // Recarregar a página para aplicar o novo tema
        console.log("Recarregando a página para aplicar o novo tema...");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        console.error("Erro ao alterar o tema");
      }
    } catch (error) {
      console.error("Erro ao definir o tema atual:", error);
    }
  }

  /**
   * Renderiza o seletor de temas
   */
  renderThemeSelector() {
    const themeSelector = this.modal.querySelector(".theme-selector");
    themeSelector.innerHTML = "";

    // Armazenar o ID do tema selecionado
    this.selectedThemeId = this.currentTheme.id;

    console.log(
      "Renderizando seletor de temas com",
      this.themes.length,
      "temas"
    );

    // Criar uma lista para os temas
    const themeList = document.createElement("div");
    themeList.className = "theme-list";
    themeSelector.appendChild(themeList);

    // Renderizar cada opção de tema
    this.themes.forEach((theme) => {
      console.log("Renderizando tema:", theme.id);

      const themeOption = document.createElement("div");
      themeOption.className = `theme-list-item ${
        theme.id === this.selectedThemeId ? "selected" : ""
      }`;
      themeOption.dataset.themeId = theme.id;

      // Imagem de preview do tema (se disponível)
      const previewPath = `/themes/${theme.id}/preview.jpg`;

      themeOption.innerHTML = `
        <div class="theme-preview">
          <img src="${previewPath}" onerror="this.src='/img/theme-placeholder.png'" alt="${
        theme.name || theme.id
      }">
        </div>
        <div class="theme-details">
          <div class="theme-name">${theme.name || theme.id}</div>
          <div class="theme-description">${
            theme.description || "Sem descrição"
          }</div>
        </div>
      `;

      // Event listener para selecionar o tema
      themeOption.addEventListener("click", () => {
        // Remover a classe 'selected' de todas as opções
        themeList.querySelectorAll(".theme-list-item").forEach((option) => {
          option.classList.remove("selected");
        });

        // Adicionar a classe 'selected' à opção clicada
        themeOption.classList.add("selected");

        // Atualizar o tema selecionado
        this.selectedThemeId = theme.id;

        // Atualizar as informações do tema atual
        this.renderThemeInfo();

        // Atualizar as configurações do tema
        this.renderThemeSettings();
      });

      themeList.appendChild(themeOption);
    });

    if (this.themes.length === 0) {
      themeSelector.innerHTML = "<p>Nenhum tema disponível.</p>";
    }
  }

  /**
   * Renderiza as configurações do tema
   */
  renderThemeSettings() {
    const themeSettings = this.modal.querySelector(".theme-settings");
    themeSettings.innerHTML = "";

    // Obter o tema selecionado
    const selectedTheme =
      this.themes.find((t) => t.id === this.selectedThemeId) ||
      this.currentTheme;

    console.log("Renderizando configurações para o tema:", selectedTheme.id);
    console.log("Tema selecionado completo:", selectedTheme);
    console.log("Configurações originais:", this.originalSettings);
    console.log("Configurações atuais:", this.currentSettings);

    // Verificar se o tema tem configurações
    if (
      !selectedTheme.settings ||
      !Array.isArray(selectedTheme.settings) ||
      selectedTheme.settings.length === 0
    ) {
      themeSettings.innerHTML =
        "<p>Este tema não possui configurações personalizáveis.</p>";
      return;
    }

    // Criar um container para as configurações
    const settingsContainer = document.createElement("div");
    settingsContainer.className = "settings-container";
    themeSettings.appendChild(settingsContainer);

    // Renderizar cada configuração
    selectedTheme.settings.forEach((setting) => {
      console.log("Processando configuração:", setting);

      const settingItem = document.createElement("div");
      settingItem.className = "setting-item";

      const label = document.createElement("label");
      label.className = "setting-label";
      label.textContent = setting.name || setting.id;

      let input;

      // Obter o valor atual da configuração
      // Prioridade: 1. Valor atual no objeto currentSettings, 2. Valor no setting, 3. Valor padrão
      const currentValue =
        this.currentSettings[setting.id] !== undefined
          ? this.currentSettings[setting.id]
          : setting.value !== undefined
          ? setting.value
          : setting.default;

      console.log(
        `Configuração ${setting.id}: valor atual = ${currentValue}, tipo = ${setting.type}`
      );

      // Criar o input apropriado com base no tipo
      switch (setting.type) {
        case "select":
          input = document.createElement("select");
          input.className = "setting-select";

          // Adicionar opções
          if (setting.options) {
            setting.options.forEach((option) => {
              const optionElement = document.createElement("option");
              optionElement.value = option.value;
              optionElement.textContent = option.label;

              // Selecionar a opção atual
              if (currentValue === option.value) {
                optionElement.selected = true;
              }

              input.appendChild(optionElement);
            });
          }
          break;

        case "boolean":
        case "checkbox":
          input = document.createElement("input");
          input.type = "checkbox";
          input.className = "setting-checkbox";
          input.checked = currentValue === true;
          break;

        case "color":
          input = document.createElement("input");
          input.type = "color";
          input.className = "setting-color";
          input.value = currentValue || "#000000";
          break;

        case "number":
          input = document.createElement("input");
          input.type = "number";
          input.className = "setting-input";
          input.value = currentValue;

          if (setting.min !== undefined) input.min = setting.min;
          if (setting.max !== undefined) input.max = setting.max;
          if (setting.step !== undefined) input.step = setting.step;
          break;

        default: // text
          input = document.createElement("input");
          input.type = "text";
          input.className = "setting-input";
          input.value = currentValue;
      }

      // Adicionar data attribute para identificar a configuração
      input.dataset.settingKey = setting.id;

      // Adicionar event listener para atualizar as configurações
      input.addEventListener("change", (e) => {
        let value;

        switch (setting.type) {
          case "boolean":
          case "checkbox":
            value = e.target.checked;
            break;
          case "number":
            value = parseFloat(e.target.value);
            break;
          default:
            value = e.target.value;
        }

        this.updateSetting(setting.id, value);
      });

      // Adicionar elementos ao item de configuração
      settingItem.appendChild(label);
      settingItem.appendChild(input);

      // Adicionar item à seção de configurações
      settingsContainer.appendChild(settingItem);
    });
  }

  /**
   * Atualiza uma configuração
   */
  updateSetting(key, value) {
    console.log(`Atualizando configuração: ${key} = ${value}`);
    this.currentSettings[key] = value;
  }

  /**
   * Renderiza as informações do tema
   */
  renderThemeInfo(theme = null) {
    const themeInfo = this.modal.querySelector(".theme-info");

    // Usar o tema fornecido ou o tema atual
    const themeData =
      theme ||
      this.themes.find((t) => t.id === this.selectedThemeId) ||
      this.currentTheme;

    // Imagem de preview do tema (se disponível)
    const previewPath = `/themes/${themeData.id}/preview.jpg`;

    themeInfo.innerHTML = `
      <div class="current-theme-preview">
        <img src="${previewPath}" onerror="this.src='/img/theme-placeholder.png'" alt="${
      themeData.name || themeData.id
    }">
      </div>
      <div class="current-theme-details">
        <p><strong>Nome:</strong> ${themeData.name || "N/A"}</p>
        <p><strong>Descrição:</strong> ${
          themeData.description || "Sem descrição disponível."
        }</p>
        <p><strong>Autor:</strong> ${themeData.author || "Desconhecido"}</p>
        <p><strong>Versão:</strong> ${themeData.version || "1.0.0"}</p>
      </div>
    `;
  }
}

// Criar instância do gerenciador de configurações
const settingsManager = new SettingsManager();
