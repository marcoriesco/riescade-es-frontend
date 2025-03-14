/**
 * Gerenciador de configurações para temas RIESCADE
 */
(function () {
  // Elemento onde serão adicionadas as configurações do tema
  const settingsContainer = document.querySelector(".settings-section");

  // Armazenar configurações carregadas
  let themeSettings = null;
  let themeJson = null;
  let currentTheme = null;

  /**
   * Inicializa o gerenciador de configurações
   */
  async function init() {
    try {
      // Obter o tema atual com suas configurações
      currentTheme = await getCurrentTheme();

      if (!currentTheme) {
        console.error("Não foi possível obter o tema atual");
        return;
      }

      // Atualizar nome do tema na interface
      document.getElementById("current-theme-name").textContent =
        currentTheme.name;

      // Usar as configurações atuais do tema
      themeSettings = currentTheme.currentSettings || {};

      // Usar as definições de configurações do tema
      themeJson = {
        settings: currentTheme.settings || [],
      };

      // Renderizar configurações do tema
      renderThemeSettings();

      // Adicionar seletor de temas
      await renderThemeSelector();

      console.log("Configurações do tema inicializadas com sucesso");
    } catch (error) {
      console.error("Erro ao inicializar configurações do tema:", error);
    }
  }

  /**
   * Obtém o tema atual
   * @returns {Promise<Object>} Tema atual
   */
  async function getCurrentTheme() {
    try {
      const response = await fetch("/api/frontend/themes/current");
      const data = await response.json();

      if (data.success && data.data) {
        return data.data;
      }

      throw new Error(data.message || "Erro ao obter tema atual");
    } catch (error) {
      console.error("Erro ao obter tema atual:", error);
      return null;
    }
  }

  /**
   * Renderiza as configurações do tema na interface
   */
  function renderThemeSettings() {
    if (!themeJson || !themeJson.settings || themeJson.settings.length === 0) {
      // Se não houver configurações, mostrar mensagem
      const noSettings = document.createElement("p");
      noSettings.textContent =
        "Este tema não possui configurações personalizáveis.";
      settingsContainer.appendChild(noSettings);
      return;
    }

    // Criar seção de configurações do tema
    const themeSection = document.createElement("div");
    themeSection.className = "settings-section";

    const sectionTitle = document.createElement("h2");
    sectionTitle.textContent = "Configurações do Tema";
    themeSection.appendChild(sectionTitle);

    // Criar campos para cada configuração
    themeJson.settings.forEach((setting) => {
      const currentValue =
        themeSettings[setting.id] !== undefined
          ? themeSettings[setting.id]
          : setting.default;

      const settingDiv = document.createElement("div");
      settingDiv.className = "setting-item";

      // Criar campo de acordo com o tipo
      switch (setting.type) {
        case "boolean":
          settingDiv.innerHTML = `
              <label for="setting-${setting.id}" class="setting-label">
                <input type="checkbox" id="setting-${setting.id}" ${
            currentValue ? "checked" : ""
          }>
                ${setting.name}
              </label>
            `;

          // Adicionar evento de alteração
          setTimeout(() => {
            const checkbox = document.getElementById(`setting-${setting.id}`);

            if (checkbox) {
              checkbox.addEventListener("change", (e) => {
                updateThemeSetting(setting.id, e.target.checked);
              });
            }
          }, 0);
          break;

        case "color":
          settingDiv.innerHTML = `
              <label for="setting-${setting.id}" class="setting-label">${setting.name}</label>
              <div class="color-input">
                <input type="color" id="setting-${setting.id}" value="${currentValue}">
                <span class="color-value">${currentValue}</span>
              </div>
            `;

          // Adicionar evento de alteração
          setTimeout(() => {
            const colorInput = document.getElementById(`setting-${setting.id}`);

            if (colorInput) {
              colorInput.addEventListener("input", (e) => {
                const colorValue = document.querySelector(
                  `#setting-${setting.id} + .color-value`
                );
                if (colorValue) {
                  colorValue.textContent = e.target.value;
                }
                updateThemeSetting(setting.id, e.target.value);
              });
            }
          }, 0);
          break;

        case "select":
          let optionsHtml = "";
          if (setting.options && setting.options.length > 0) {
            optionsHtml = setting.options
              .map(
                (option) =>
                  `<option value="${option.value}" ${
                    currentValue === option.value ? "selected" : ""
                  }>${option.label}</option>`
              )
              .join("");
          }

          settingDiv.innerHTML = `
              <label for="setting-${setting.id}" class="setting-label">${setting.name}</label>
              <select id="setting-${setting.id}" class="setting-select">
                ${optionsHtml}
              </select>
            `;

          // Adicionar evento de alteração
          setTimeout(() => {
            const selectInput = document.getElementById(
              `setting-${setting.id}`
            );

            if (selectInput) {
              selectInput.addEventListener("change", (e) => {
                updateThemeSetting(setting.id, e.target.value);
              });
            }
          }, 0);
          break;

        case "text":
        default:
          settingDiv.innerHTML = `
              <label for="setting-${setting.id}" class="setting-label">${setting.name}</label>
              <input type="text" id="setting-${setting.id}" value="${currentValue}" class="setting-input">
            `;

          // Adicionar evento de alteração
          setTimeout(() => {
            const textInput = document.getElementById(`setting-${setting.id}`);

            if (textInput) {
              textInput.addEventListener("change", (e) => {
                updateThemeSetting(setting.id, e.target.value);
              });
            }
          }, 0);
          break;
      }

      themeSection.appendChild(settingDiv);
    });

    settingsContainer.appendChild(themeSection);
  }

  /**
   * Renderiza o seletor de temas
   */
  async function renderThemeSelector() {
    try {
      // Obter a lista de temas disponíveis
      const response = await fetch("/api/frontend/themes");
      const data = await response.json();

      if (!data.success || !data.data || data.data.length === 0) {
        console.error("Não foi possível obter a lista de temas");
        return;
      }

      const themes = data.data;

      // Criar seção de seleção de tema
      const themeSection = document.createElement("div");
      themeSection.className = "settings-section";

      const sectionTitle = document.createElement("h2");
      sectionTitle.textContent = "Selecionar Tema";
      themeSection.appendChild(sectionTitle);

      // Criar seletor de temas
      const selectDiv = document.createElement("div");
      selectDiv.className = "setting-item";

      const selectLabel = document.createElement("label");
      selectLabel.className = "setting-label";
      selectLabel.textContent = "Tema";
      selectLabel.htmlFor = "theme-select";

      const select = document.createElement("select");
      select.id = "theme-select";
      select.className = "setting-select";

      // Adicionar opções para cada tema
      themes.forEach((theme) => {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.name;

        if (currentTheme && theme.id === currentTheme.id) {
          option.selected = true;
        }

        select.appendChild(option);
      });

      // Adicionar evento de alteração
      select.addEventListener("change", async (e) => {
        const themeId = e.target.value;
        await setCurrentTheme(themeId);
      });

      selectDiv.appendChild(selectLabel);
      selectDiv.appendChild(select);
      themeSection.appendChild(selectDiv);

      // Adicionar informações do tema selecionado
      const infoDiv = document.createElement("div");
      infoDiv.className = "theme-info";
      infoDiv.innerHTML = `
        <p><strong>Tema atual:</strong> <span id="current-theme-name">${
          currentTheme ? currentTheme.name : "Desconhecido"
        }</span></p>
        <p><strong>Autor:</strong> <span id="current-theme-author">${
          currentTheme ? currentTheme.author : "Desconhecido"
        }</span></p>
        <p><strong>Versão:</strong> <span id="current-theme-version">${
          currentTheme ? currentTheme.version : "1.0.0"
        }</span></p>
        <p><strong>Descrição:</strong> <span id="current-theme-description">${
          currentTheme ? currentTheme.description : ""
        }</span></p>
      `;
      themeSection.appendChild(infoDiv);

      // Adicionar botão para aplicar o tema
      const applyButton = document.createElement("button");
      applyButton.className = "settings-button";
      applyButton.textContent = "Aplicar Tema";
      applyButton.addEventListener("click", async () => {
        const themeId = select.value;
        await setCurrentTheme(themeId);

        // Recarregar a página para aplicar o novo tema
        window.location.reload();
      });

      themeSection.appendChild(applyButton);
      settingsContainer.appendChild(themeSection);
    } catch (error) {
      console.error("Erro ao renderizar seletor de temas:", error);
    }
  }

  /**
   * Define o tema atual
   * @param {string} themeId - ID do tema
   */
  async function setCurrentTheme(themeId) {
    try {
      console.log(`Alterando tema para: ${themeId}`);

      const response = await fetch("/api/frontend/themes/current", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ themeId }),
      });

      const data = await response.json();
      console.log(`Resposta da API ao alterar tema:`, data);

      if (data.success) {
        console.log(`Tema alterado para ${themeId} com sucesso`);

        // Atualizar informações do tema na interface
        document.getElementById("current-theme-name").textContent =
          data.data.name;
        document.getElementById("current-theme-author").textContent =
          data.data.author;
        document.getElementById("current-theme-version").textContent =
          data.data.version;
        document.getElementById("current-theme-description").textContent =
          data.data.description;

        // Recarregar a página para aplicar o novo tema
        setTimeout(() => {
          console.log("Recarregando a página para aplicar o novo tema...");
          window.location.href = "/";
        }, 1000);

        return true;
      }

      console.error(`Erro ao alterar tema: ${data.message}`);
      return false;
    } catch (error) {
      console.error(`Erro ao definir tema atual: ${error}`);
      return false;
    }
  }

  /**
   * Atualiza uma configuração do tema
   * @param {string} key - Chave da configuração
   * @param {*} value - Valor da configuração
   */
  async function updateThemeSetting(key, value) {
    try {
      const response = await fetch("/api/frontend/settings/theme", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`Configuração ${key} atualizada para ${value}`);

        // Atualizar configurações em memória
        if (themeSettings) {
          themeSettings[key] = value;
        }

        return true;
      }

      console.error(`Erro ao atualizar configuração ${key}:`, data.message);
      return false;
    } catch (error) {
      console.error(`Erro ao atualizar configuração ${key}:`, error);
      return false;
    }
  }

  /**
   * Define a tecla SPACE como tecla de configurações
   */
  async function setSpaceAsConfigKey() {
    try {
      const response = await fetch("/api/frontend/settings/keys", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configKey: "Space",
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("Tecla SPACE definida como tecla de configurações");
        return true;
      }

      console.error("Erro ao definir tecla de configurações:", data.message);
      return false;
    } catch (error) {
      console.error("Erro ao definir tecla de configurações:", error);
      return false;
    }
  }

  // Inicializar quando o DOM estiver pronto
  document.addEventListener("DOMContentLoaded", init);
})();
