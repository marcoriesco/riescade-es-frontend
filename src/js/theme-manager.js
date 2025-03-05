// js/theme-manager.js
import { ThemeParser } from "./config-parser.js";

import Mustache from "https://cdnjs.cloudflare.com/ajax/libs/mustache.js/4.2.0/mustache.min.js";

export class ThemeManager {
  constructor() {
    this.themeParser = new ThemeParser();
    this.currentTheme = "default";
    this.currentView = "system";
    this.currentSystem = null;
    this.activeTheme = "default";
    this.themeData = null;
    this.systemThemeCache = {}; // Cache para dados de tema específicos por sistema
    this.templateCache = new Map();
    this.isExternalTheme = false;

    // Verificar se a API local está disponível
    if (!window.api) {
      console.error("ThemeManager: API do Electron não disponível");
    } else if (!window.api.localApi) {
      console.error("ThemeManager: API local não disponível");
    } else {
      console.log(
        "ThemeManager: API local detectada:",
        Object.keys(window.api.localApi.themes || {}).length > 0
          ? Object.keys(window.api.localApi.themes)
          : "sem endpoints de temas"
      );
    }
  }

  // Initialize the theme manager
  async init(themeName = "default") {
    try {
      this.currentTheme = themeName;

      // Check if theme exists in external directory first
      const externalThemeExists = await window.api.checkExternalTheme(
        themeName
      );
      this.isExternalTheme = externalThemeExists;

      // Carregar dados do tema
      await this.loadThemeData();

      // Carregar estilos do tema
      await this.loadThemeStyles();

      return true;
    } catch (error) {
      console.error("Error initializing theme manager:", error);
      // Fallback to default theme
      this.currentTheme = "default";
      this.isExternalTheme = false;
      try {
        await this.loadThemeData();
        await this.loadThemeStyles();
        return true;
      } catch (fallbackError) {
        console.error("Critical error loading default theme:", fallbackError);
        return false;
      }
    }
  }

  getThemePath(themeName) {
    // Garantir que usamos string para o nome do tema
    const theme =
      typeof themeName === "string"
        ? themeName
        : themeName && themeName.name
        ? themeName.name
        : "default";

    console.log(
      `Gerando caminho para o tema: ${theme}, isExternal: ${this.isExternalTheme}`
    );

    if (this.isExternalTheme) {
      return `riescade://external-themes/${theme}`;
    }

    return `src/themes/${theme}`;
  }

  // Load theme data
  async loadThemeData() {
    try {
      console.log(
        `Carregando dados do tema: ${this.currentTheme}, isExternal: ${this.isExternalTheme}`
      );

      // Obter configuração do tema
      const themeConfig = await window.api.getThemeConfig(
        this.currentTheme,
        this.isExternalTheme
      );

      if (!themeConfig) {
        console.error(
          `Configuração do tema não encontrada: ${this.currentTheme}`
        );
        throw new Error(
          `Configuração do tema não encontrada: ${this.currentTheme}`
        );
      }

      console.log(
        `Configuração do tema carregada: ${JSON.stringify(themeConfig)}`
      );

      // Armazenar dados do tema
      this.themeData = {
        name: themeConfig.name || this.currentTheme,
        variables: {
          primaryColor: themeConfig.variables?.primaryColor || "#ff1a4f",
          backgroundColor: themeConfig.variables?.backgroundColor || "#121212",
          textColor: themeConfig.variables?.textColor || "#ffffff",
          cardColor: themeConfig.variables?.cardColor || "#242424",
        },
      };

      return this.themeData;
    } catch (error) {
      console.error(
        `Erro ao carregar dados do tema ${this.currentTheme}:`,
        error
      );

      // Usar tema padrão em caso de erro
      this.themeData = {
        name: "default",
        variables: {
          primaryColor: "#ff1a4f",
          backgroundColor: "#121212",
          textColor: "#ffffff",
          cardColor: "#242424",
        },
      };

      return this.themeData;
    }
  }

  // Load theme styles
  async loadThemeStyles() {
    try {
      const themeName = this.currentTheme;
      const isExternal = this.isExternalTheme;

      // Remover estilos antigos do tema
      const oldThemeStyles = document.getElementById("theme-styles");
      if (oldThemeStyles) {
        oldThemeStyles.remove();
      }

      // Criar novo elemento de estilo
      const styleElement = document.createElement("style");
      styleElement.id = "theme-styles";

      // Caminho para o CSS do tema
      const cssPath = `${this.getThemePath(themeName)}/css/theme.css`;

      try {
        // Carregar CSS do tema
        const css = await window.api.readFile(cssPath, isExternal);
        if (css) {
          styleElement.textContent = css;
          document.head.appendChild(styleElement);
          console.log(`Estilos do tema ${themeName} carregados com sucesso`);
        } else {
          console.warn(`CSS do tema ${themeName} não encontrado em ${cssPath}`);
        }
      } catch (error) {
        console.error(`Erro ao carregar CSS do tema ${themeName}:`, error);
      }

      return true;
    } catch (error) {
      console.error("Erro ao carregar estilos do tema:", error);
      return false;
    }
  }

  // Load theme's JavaScript files
  async loadThemeScripts() {
    const themePath = this.getThemePath(this.currentTheme);
    const scriptId = "theme-script";

    // Remove existing theme script if it exists
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    // Add new theme script
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `${themePath}/js/theme.js`;
    document.body.appendChild(script);
  }

  // Load and cache a template
  async loadTemplate(templateName) {
    try {
      console.log(
        `ThemeManager: Iniciando carregamento do template "${templateName}"`
      );
      console.log(`ThemeManager: Tema atual: ${this.currentTheme}`);
      console.log(`ThemeManager: isExternalTheme: ${this.isExternalTheme}`);

      // Verificar se já temos este template em cache
      if (this.templateCache.has(templateName)) {
        console.log(
          `ThemeManager: Template "${templateName}" encontrado em cache`
        );
        return this.templateCache.get(templateName);
      }

      // Tentar carregar o template do tema atual primeiro
      let templatePath;
      let templateHtml;

      // Caminho para o tema atual
      if (this.currentTheme) {
        console.log(
          `ThemeManager: Tentando carregar template do tema: ${this.currentTheme}`
        );

        // Verificar se é um tema externo
        if (this.isExternalTheme) {
          templatePath = `themes/${this.currentTheme}/templates/${templateName}.html`;
          console.log(
            `ThemeManager: Tentando caminho externo: ${templatePath}`
          );

          // Usar API para ler arquivo externo
          templateHtml = await window.api.readFile(templatePath, true);
          console.log(
            `ThemeManager: Resultado da leitura externa: ${!!templateHtml}`
          );
        } else {
          // Tema interno (src/themes)
          templatePath = `src/themes/${this.currentTheme}/templates/${templateName}.html`;
          console.log(
            `ThemeManager: Tentando caminho interno: ${templatePath}`
          );

          // Verificar se window.api.readFile existe
          if (typeof window.api.readFile === "function") {
            templateHtml = await window.api.readFile(templatePath, false);
            console.log(
              `ThemeManager: Resultado da leitura interna: ${!!templateHtml}`
            );
          } else {
            console.error(
              `ThemeManager: window.api.readFile não é uma função!`
            );
            templateHtml = null;
          }
        }
      }

      // Se não encontrou no tema atual ou não há tema atual, tentar no tema padrão
      if (!templateHtml) {
        templatePath = `src/themes/default/templates/${templateName}.html`;
        console.log(`ThemeManager: Tentando caminho padrão: ${templatePath}`);

        if (typeof window.api.readFile === "function") {
          templateHtml = await window.api.readFile(templatePath, false);
          console.log(
            `ThemeManager: Resultado da leitura do caminho padrão: ${!!templateHtml}`
          );
        } else {
          console.error(`ThemeManager: window.api.readFile não é uma função!`);
          templateHtml = null;
        }
      }

      // Se ainda não encontrou, tentar no diretório raiz de templates
      if (!templateHtml) {
        templatePath = `src/templates/${templateName}.html`;
        console.log(`ThemeManager: Tentando diretório raiz: ${templatePath}`);

        if (typeof window.api.readFile === "function") {
          templateHtml = await window.api.readFile(templatePath, false);
          console.log(
            `ThemeManager: Resultado da leitura do diretório raiz: ${!!templateHtml}`
          );
        } else {
          console.error(`ThemeManager: window.api.readFile não é uma função!`);
          templateHtml = null;
        }
      }

      // Se não encontrou o template em nenhum lugar
      if (!templateHtml) {
        console.error(
          `ThemeManager: Template "${templateName}" não encontrado em nenhum lugar após tentar todos os caminhos`
        );
        return null;
      }

      console.log(
        `ThemeManager: Template "${templateName}" carregado com sucesso de ${templatePath}`
      );

      // Armazenar no cache
      this.templateCache.set(templateName, templateHtml);

      return templateHtml;
    } catch (error) {
      console.error(
        `ThemeManager: Erro ao carregar template "${templateName}":`,
        error
      );
      return null;
    }
  }

  // Render a template with data - with async (original method)
  async renderTemplateAsync(templateName, data) {
    console.log(`Renderizando template assíncrono: ${templateName}`);

    const template = await this.loadTemplate(templateName);
    if (!template) {
      console.error(
        `Failed to render template ${templateName}: Template not found`
      );
      throw new Error(`Failed to render template ${templateName}`);
    }

    try {
      console.log(`Template carregado com sucesso: ${templateName}`);

      // Use o renderTemplate síncrono após carregar o template
      return this.renderTemplate(template, data);
    } catch (error) {
      console.error(`Error rendering template ${templateName}:`, error);
      throw new Error(`Error rendering template: ${error.message}`);
    }
  }

  // Render a template with data - without async
  renderTemplate(template, data) {
    console.log("ThemeManager.renderTemplate: Iniciando renderização");

    if (!template) {
      console.error("ThemeManager.renderTemplate: Template está vazio");
      return "";
    }

    console.log(
      "ThemeManager.renderTemplate: Dados recebidos:",
      Object.keys(data)
    );
    if (data.games) {
      console.log(
        `ThemeManager.renderTemplate: Número de jogos: ${data.games.length}`
      );
    }

    try {
      // Process repeating blocks first
      let processedTemplate = this.processRepeatingBlocks(template, data);

      // Replace all interpolation tags with actual data
      const rendered = processedTemplate.replace(
        /\{\{([^}]+)\}\}/g,
        (match, key) => {
          return this.getNestedValue(data, key.trim());
        }
      );

      console.log(
        "ThemeManager.renderTemplate: Renderização concluída com sucesso"
      );
      return rendered;
    } catch (error) {
      console.error(
        "ThemeManager.renderTemplate: Erro na renderização:",
        error
      );
      return "";
    }
  }

  // Método para obter facilmente um template
  getTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }
    throw new Error(`Template ${templateName} não encontrado no cache`);
  }

  // Método para obter dados do tema do sistema
  getSystemThemeData(systemName) {
    if (this.systemThemeCache[systemName]) {
      return this.systemThemeCache[systemName];
    }

    // Dados padrão se não encontrados
    return {
      name: systemName,
      logo: this.getSystemLogoPath(systemName),
    };
  }

  // Process repeating blocks in template
  processRepeatingBlocks(template, data) {
    const blockRegex =
      /<!-- BEGIN ([a-zA-Z0-9_]+) -->([\s\S]*?)<!-- END \1 -->/g;

    return template.replace(blockRegex, (match, blockName, blockContent) => {
      const items = data[blockName];
      if (!Array.isArray(items)) {
        console.warn(`Block ${blockName} is not an array or not found`);
        return "";
      }

      return items
        .map((item) => {
          return blockContent.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const value = this.getNestedValue(item, key.trim());
            return value !== undefined ? value : "";
          });
        })
        .join("\n");
    });
  }

  // Helper function to get nested object values
  getNestedValue(obj, path) {
    if (!obj) return "";

    return (
      path.split(".").reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
      }, obj) || ""
    );
  }

  async renderSystemsView(data) {
    try {
      if (!data || !data.systems) {
        console.error("Invalid data for systems view:", data);
        throw new Error("Invalid data for systems view");
      }

      console.log("Renderizando systems view com tema:", this.currentTheme);
      console.log("Dados para renderização:", data);

      // Carregar o template
      const template = await this.loadTemplate("systems");
      if (!template) {
        console.error("Template 'systems' não encontrado");
        return null;
      }

      // Adicionar caminhos dos logos para cada sistema
      const systemsWithLogos = data.systems.map((system) => {
        return {
          ...system,
          logoPath: this.getSystemLogoPath(system.name),
          id: system.id || system.name, // Garantir que temos um ID para cada sistema
        };
      });

      // Preparar dados para o template
      const templateData = {
        app: {
          title: "RIESCADE",
        },
        stats: data.stats || {
          totalGames: 0,
          totalSystems: data.systems.length,
        },
        systems: systemsWithLogos,
      };

      console.log("Dados preparados para renderização:", templateData);

      // Renderizar usando Mustache
      const rendered = Mustache.render(template, templateData);
      console.log("Template systems renderizado com sucesso");

      return rendered;
    } catch (error) {
      console.error("Error rendering systems view:", error);
      throw new Error(`Failed to render systems view: ${error.message}`);
    }
  }

  // Render the game list view
  async renderGameListView(system, games) {
    console.log("ThemeManager: Iniciando renderização da lista de jogos");
    console.log("ThemeManager: Sistema:", system);
    console.log("ThemeManager: Número de jogos:", games ? games.length : 0);

    try {
      // Carregar o template da lista de jogos
      console.log("ThemeManager: Tentando carregar template 'gamelist'");
      const template = await this.loadTemplate("gamelist");

      if (!template) {
        console.error("ThemeManager: Template 'gamelist' não encontrado");
        return null;
      }

      console.log("ThemeManager: Template 'gamelist' carregado com sucesso");

      // Preparar dados para o template
      const templateData = {
        system: system,
        games: games || [],
        theme: this.currentTheme,
        helpers: this.templateHelpers,
      };

      console.log("ThemeManager: Dados preparados para renderização:", {
        systemName: system.name,
        gamesCount: games ? games.length : 0,
        currentTheme: this.currentTheme,
      });

      // Renderizar o template
      const rendered = Mustache.render(template, templateData);
      console.log("ThemeManager: Template renderizado com sucesso");

      return rendered;
    } catch (error) {
      console.error("ThemeManager: Erro ao renderizar lista de jogos:", error);
      return null;
    }
  }

  // Inicializar o gerenciador de temas
  async initialize() {
    try {
      // Definir o tema como default
      this.currentTheme = "default";

      // Carregar tema padrão
      const defaultThemeData = await this.themeParser.getThemeData();

      // Armazenar dados do tema
      this.themeData = defaultThemeData;

      // Carregar estilos do tema
      await this.loadThemeStyles();

      // Aplica propriedades CSS globais do tema
      this.applyGlobalTheme();

      // Carregar scripts do tema
      await this.loadThemeScripts();

      console.log("Tema padrão carregado com sucesso");

      return true;
    } catch (error) {
      console.error("Erro ao inicializar gerenciador de temas:", error);
      return false;
    }
  }

  // Aplica propriedades CSS globais baseadas no tema
  applyGlobalTheme() {
    if (!this.themeData || !this.themeData.theme) return;

    const theme = this.themeData.theme;

    // Aplicar variáveis CSS do tema
    document.documentElement.style.setProperty(
      "--primary-color",
      theme.primaryColor || "#1a88ff"
    );
    document.documentElement.style.setProperty(
      "--background-color",
      theme.backgroundColor || "#121212"
    );
    document.documentElement.style.setProperty(
      "--text-color",
      theme.textColor || "#ffffff"
    );
    document.documentElement.style.setProperty(
      "--card-background",
      theme.cardColor || "#1e1e1e"
    );

    // Aplicar plano de fundo global, se disponível
    if (theme.globalBackground) {
      const backgroundElement = document.createElement("div");
      backgroundElement.className = "theme-background";
      backgroundElement.id = "global-background";
      backgroundElement.style.backgroundImage = `url(${theme.globalBackground})`;

      // Remover background existente, se houver
      const existingBackground = document.getElementById("global-background");
      if (existingBackground) {
        existingBackground.remove();
      }

      // Adicionar novo background
      document.body.appendChild(backgroundElement);
    }
  }

  // Carregar tema para um sistema específico
  async loadSystemTheme(systemName) {
    try {
      if (this.currentSystem === systemName) {
        return true; // Já está usando este tema
      }

      // Verificar se já temos no cache
      if (this.systemThemeCache[systemName]) {
        const themeData = this.systemThemeCache[systemName];
        this.applyTheme(themeData);
        // Não mudar o currentTheme, apenas armazenar o sistema atual
        this.currentSystem = systemName;
        return true;
      }

      const themeData = await this.themeParser.getSystemTheme(systemName);
      this.applyTheme(themeData);

      // NÃO alterar o currentTheme, apenas o sistema atual
      this.currentSystem = systemName;

      // Atualizar classe do body para CSS específico do sistema
      document.body.className = "";
      document.body.classList.add(`theme-${systemName}`);

      // Guardar no cache
      this.systemThemeCache[systemName] = themeData;

      console.log(`Tema do sistema ${systemName} aplicado`);
      return true;
    } catch (error) {
      console.error(`Erro ao carregar tema para ${systemName}:`, error);
      return false;
    }
  }

  // Mudar para uma visualização específica
  changeView(viewName) {
    if (viewName !== "system" && viewName !== "gamelist") {
      console.error(`Visualização inválida: ${viewName}`);
      return false;
    }

    // Esconder todas as visualizações
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.add("hidden");
    });

    // Mostrar a visualização selecionada
    const viewElement = document.getElementById(`${viewName}-view`);
    if (viewElement) {
      viewElement.classList.remove("hidden");
      viewElement.classList.add("fade-in");

      // Aplicar configurações específicas da visualização
      if (this.currentTheme) {
        this.themeParser.applyViewTheme(
          this.currentTheme.views[viewName],
          viewName
        );
      }

      this.currentView = viewName;
      return true;
    }

    return false;
  }

  // Aplicar tema ao DOM
  applyTheme(theme) {
    // Primeiro, garantir que os estilos do tema foram carregados
    this.loadThemeStyles();

    // Aplicar variáveis globais do tema ao CSS
    const root = document.documentElement;
    const variables = theme.variables;

    // Verificar se temos variáveis
    if (!variables) {
      console.warn("Nenhuma variável disponível no tema");
      return;
    }

    // Converter cores para variáveis CSS
    if (variables.primaryColor) {
      root.style.setProperty("--primary-color", variables.primaryColor);
    }
    if (variables.backgroundColor) {
      root.style.setProperty("--background-color", variables.backgroundColor);
    }
    if (variables.textColor) {
      root.style.setProperty("--text-color", variables.textColor);
    }
    if (variables.selectionColor) {
      root.style.setProperty("--selection-color", variables.selectionColor);
    }

    // Converter cor primária para RGB para usar com opacidade
    if (variables.primaryColor) {
      const rgbPrimary = this.hexToRgb(variables.primaryColor);
      if (rgbPrimary) {
        root.style.setProperty(
          "--primary-color-rgb",
          `${rgbPrimary.r}, ${rgbPrimary.g}, ${rgbPrimary.b}`
        );
      }
    }

    // Aplicar configurações para a visualização atual
    if (this.currentView && theme.views && theme.views[this.currentView]) {
      this.themeParser.applyViewTheme(
        theme.views[this.currentView],
        this.currentView
      );
    }
  }

  // Converter cor hexadecimal para RGB
  hexToRgb(hex) {
    if (!hex) return null;

    // Remover # se estiver presente
    hex = hex.replace(/^#/, "");

    // Converter para valores RGB
    const bigint = parseInt(hex, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255,
    };
  }

  // Obter informações do tema atual
  getCurrentThemeInfo() {
    return {
      name: this.currentTheme?.name || "Default Theme",
      system: this.currentSystem || "none",
      view: this.currentView,
      primaryColor: this.currentTheme?.variables?.primaryColor || "#1a88ff",
    };
  }

  // Reproduzir som para sistema atual
  playSystemSound() {
    if (this.currentTheme?.system?.sound) {
      const soundPath = this.currentTheme.system.sound;
      const fullPath = soundPath.startsWith("./")
        ? `themes/default${soundPath.substring(1)}`
        : soundPath;

      const audio = new Audio(fullPath);
      audio.volume = 0.5;
      audio.play().catch((err) => console.error("Erro ao tocar som:", err));
    }
  }

  // Aplica tema específico à tela de sistemas
  applySystemsScreenTheme() {
    if (
      !this.themeData ||
      !this.themeData.theme ||
      !this.themeData.theme.systemsScreen
    )
      return;

    const systemsTheme = this.themeData.theme.systemsScreen;
    const systemsContainer = document.querySelector(".systems-container");

    if (!systemsContainer) {
      console.warn("Container de sistemas não encontrado no DOM");
      return;
    }

    // Aplicar estilo ao container de sistemas
    if (systemsTheme.backgroundColor) {
      systemsContainer.style.backgroundColor = systemsTheme.backgroundColor;
    }

    if (systemsTheme.layout === "grid") {
      systemsContainer.classList.add("grid-layout");
      systemsContainer.classList.remove("list-layout");
    } else if (systemsTheme.layout === "list") {
      systemsContainer.classList.add("list-layout");
      systemsContainer.classList.remove("grid-layout");
    }

    // Aplicar plano de fundo específico, se disponível
    if (systemsTheme.background) {
      const backgroundElement = document.createElement("div");
      backgroundElement.className = "theme-background";
      backgroundElement.id = "systems-background";
      backgroundElement.style.backgroundImage = `url(${systemsTheme.background})`;

      // Remover background existente, se houver
      const existingBackground = document.getElementById("systems-background");
      if (existingBackground) {
        existingBackground.remove();
      }

      // Adicionar novo background ao systems-screen
      const systemsScreen = document.getElementById("systems-screen");
      if (systemsScreen) {
        systemsScreen.appendChild(backgroundElement);
      } else {
        console.warn("Element systems-screen não encontrado");
      }
    }
  }

  // Aplica tema específico à tela de lista de jogos
  applyGameListTheme(systemName) {
    if (
      !this.themeData ||
      !this.themeData.theme ||
      !this.themeData.theme.gameListScreen
    )
      return;

    const gameListTheme = this.themeData.theme.gameListScreen;
    const gameListContainer = document.querySelector(".gamelist-container");

    if (!gameListContainer) {
      console.warn("Container da lista de jogos não encontrado no DOM");
      return;
    }

    // Aplicar estilo ao container da lista de jogos
    if (gameListTheme.backgroundColor) {
      gameListContainer.style.backgroundColor = gameListTheme.backgroundColor;
    }

    if (gameListTheme.layout === "grid") {
      gameListContainer.classList.add("grid-layout");
      gameListContainer.classList.remove("list-layout");
    } else if (gameListTheme.layout === "list") {
      gameListContainer.classList.add("list-layout");
      gameListContainer.classList.remove("grid-layout");
    }

    // Aplicar plano de fundo específico para o sistema atual, se disponível
    const systemTheme = this.systemThemeCache[systemName];
    if (systemTheme && systemTheme.background) {
      const backgroundElement = document.createElement("div");
      backgroundElement.className = "theme-background";
      backgroundElement.id = "gamelist-background";
      backgroundElement.style.backgroundImage = `url(${systemTheme.background})`;

      // Remover background existente, se houver
      const existingBackground = document.getElementById("gamelist-background");
      if (existingBackground) {
        existingBackground.remove();
      }

      // Adicionar novo background ao gamelist-screen
      const gameListScreen = document.getElementById("gamelist-screen");
      if (gameListScreen) {
        gameListScreen.appendChild(backgroundElement);
      } else {
        console.warn("Element gamelist-screen não encontrado");
      }
    }
  }

  // No arquivo theme-manager.js
  async checkImageExists(imagePath) {
    try {
      // Para verificar se a imagem existe sem tentar carregá-la
      const response = await fetch(imagePath, { method: "HEAD" });
      return response.ok;
    } catch (error) {
      console.error(`Erro ao verificar se imagem existe: ${imagePath}`, error);
      return false;
    }
  }

  // Obter o caminho do logo para um sistema
  getSystemLogoPath(systemName) {
    if (!systemName) {
      console.error("Nome do sistema não fornecido para getSystemLogoPath");
      return "src/themes/default/assets/icons/default-system.png";
    }

    // Se systemName for um objeto, extrair a propriedade name
    const sysName =
      typeof systemName === "object" && systemName.name
        ? systemName.name
        : systemName;

    console.log(`Gerando caminho do logo para o sistema: ${sysName}`);

    // Se temos um caminho já cacheado para o sistema, usá-lo
    if (
      this.systemThemeCache[sysName] &&
      this.systemThemeCache[sysName].system &&
      this.systemThemeCache[sysName].system.logo
    ) {
      console.log(
        `Usando caminho de logo cacheado: ${this.systemThemeCache[sysName].system.logo}`
      );
      return this.systemThemeCache[sysName].system.logo;
    }

    // Caso contrário, construir o caminho baseado no tema atual
    const themeName =
      typeof this.currentTheme === "string"
        ? this.currentTheme
        : this.currentTheme && this.currentTheme.name
        ? this.currentTheme.name
        : "default";

    // Caminho para o logo do sistema - atualizado para nova estrutura
    const logoPath = `src/themes/${themeName}/assets/logos/${sysName}.png`;
    console.log(`Logo path: ${logoPath}`);

    // Retornar o caminho, o tratamento de erro será feito no próprio img com onerror
    return logoPath;
  }

  // Obter a imagem de fundo específica para um sistema
  getSystemBackgroundPath(systemName) {
    // Se systemName for um objeto, extrair a propriedade name
    const sysName =
      typeof systemName === "object" && systemName.name
        ? systemName.name
        : systemName;

    // Se temos um caminho já cacheado para o sistema, usá-lo
    if (
      this.systemThemeCache[sysName] &&
      this.systemThemeCache[sysName].system &&
      this.systemThemeCache[sysName].system.background
    ) {
      return this.systemThemeCache[sysName].system.background;
    }

    // Caso contrário, construir o caminho baseado no tema atual
    const themePath = this.getThemePath(this.activeTheme || "default");
    return `${themePath}/backgrounds/${sysName}.jpg`;
  }

  // Altera o tema atual
  async changeTheme(themeName) {
    try {
      if (typeof themeName === "object") {
        console.error(
          "Erro: changeTheme recebeu um objeto em vez de uma string:",
          themeName
        );
        // Tenta extrair o nome se possível
        themeName = themeName.name || "default";
      }

      this.activeTheme = themeName; // Garantir que é uma string
      this.currentTheme = themeName; // Garantir que é uma string

      // Limpar cache
      this.systemThemeCache = {};
      this.templateCache.clear();

      // Reinicializar com o novo tema
      await this.init(themeName);

      return true;
    } catch (error) {
      console.error(`Erro ao mudar para o tema ${themeName}:`, error);
      return false;
    }
  }

  // Get available themes (both internal and external)
  async getAvailableThemes() {
    try {
      const [internalThemes, externalThemes] = await Promise.all([
        this.callApi("getInternalThemes"),
        this.callApi("getExternalThemes"),
      ]);

      // Combine and deduplicate themes (external themes override internal ones)
      const allThemes = [...new Set([...internalThemes, ...externalThemes])];
      return allThemes;
    } catch (error) {
      console.error("Error getting available themes:", error);
      return ["default"];
    }
  }

  // Render game details view
  async renderGameDetails(game, system) {
    try {
      console.log(`Renderizando detalhes do jogo: ${game.name || game.id}`);

      // Load game details template
      const template = await this.loadTemplate("gamedetails");
      if (!template) {
        console.error("Template de detalhes do jogo não encontrado");
        throw new Error("Template de detalhes do jogo não encontrado");
      }

      // Ensure all required properties are set with fallbacks
      const gameData = {
        id: game.id || "",
        title: game.name || game.path || "Jogo sem título",
        image:
          game.imagePath ||
          this.getGameImagePath(system.name, game.id) ||
          "assets/icons/default-game.png",
        developer: game.developer || "Desconhecido",
        publisher: game.publisher || "Desconhecido",
        releaseDate: game.releaseDate || "N/A",
        genre: game.genre || "N/A",
        description: game.desc || "Sem descrição disponível",
        path: game.path || "",
        favorite: game.favorite || false,
        rating: game.rating || 0,
        playCount: game.playCount || 0,
        lastPlayed: game.lastPlayed
          ? new Date(game.lastPlayed).toLocaleDateString()
          : "Nunca jogado",
        systemName: system.name || "Sistema desconhecido",
        systemLogo:
          this.getSystemLogoPath(system.name) ||
          "assets/icons/default-system.png",
      };

      console.log("Dados do jogo preparados:", gameData);

      // Render the template
      return this.renderTemplate(template, { game: gameData, system });
    } catch (error) {
      console.error("Error rendering game details:", error);

      // Fallback template if the main template fails
      const fallbackTemplate = `
        <div class="game-details-container">
          <div class="game-header">
            <div class="game-image">
              <img src="{{game.image}}" alt="{{game.title}}" onerror="this.src='assets/icons/default-game.png'">
            </div>
            <div class="game-info">
              <h1 class="game-title">{{game.title}}</h1>
              <div class="game-metadata">
                <span class="developer">{{game.developer}}</span>
                <span class="release-date">{{game.releaseDate}}</span>
                <span class="genre">{{game.genre}}</span>
              </div>
            </div>
          </div>
          <div class="game-description">
            <p>{{game.description}}</p>
          </div>
          <div class="game-actions">
            <button class="play-button" data-game-id="{{game.id}}" data-game-path="{{game.path}}">Jogar</button>
            <button class="favorite-button" data-game-id="{{game.id}}">
              {{#if game.favorite}}Remover dos Favoritos{{else}}Adicionar aos Favoritos{{/if}}
            </button>
          </div>
        </div>
      `;

      // Try to render with the fallback template
      try {
        return this.renderTemplate(fallbackTemplate, {
          game: gameData,
          system,
        });
      } catch (fallbackError) {
        console.error("Error rendering fallback game details:", fallbackError);
        return `<div class="error-message">Erro ao carregar detalhes do jogo: ${error.message}</div>`;
      }
    }
  }

  // Método para obter o caminho da imagem do jogo
  getGameImagePath(systemName, gameId) {
    // Se systemName for um objeto, extrair a propriedade name
    const sysName =
      typeof systemName === "object" && systemName.name
        ? systemName.name
        : systemName;

    // Verificar se temos um ID de jogo válido
    if (!gameId) {
      console.warn("ID de jogo inválido para obter imagem");
      return "assets/icons/default-game.png";
    }

    // Limpar o ID do jogo para uso em caminhos de arquivo
    const cleanGameId = gameId.replace(/[\\/:*?"<>|]/g, "_");

    // Caminho padrão para imagens de jogos no sistema (com várias extensões possíveis)
    const extensions = [".png", ".jpg", ".jpeg", ".webp"];
    const defaultExtension = ".png";

    // Caminho base para imagens de jogos no sistema
    const basePath = `riescade://media/images/${sysName}/${cleanGameId}`;

    // Caminho padrão com extensão
    const defaultGameImagePath = `${basePath}${defaultExtension}`;

    // Caminho para imagem padrão caso não exista
    const fallbackImagePath = "assets/icons/default-game.png";

    console.log(
      `Caminho da imagem para jogo ${gameId} (sistema ${sysName}): ${defaultGameImagePath}`
    );

    // Verificar se a imagem existe (usando o protocolo riescade)
    // Como não podemos verificar diretamente, retornamos o caminho e deixamos
    // o navegador lidar com o fallback usando onerror no elemento img
    return defaultGameImagePath;
  }

  /**
   * Retorna o caminho da imagem padrão para jogos
   * @param {string} systemName - Nome opcional do sistema para personalizar a imagem
   * @returns {string} - Caminho para a imagem padrão
   */
  getDefaultGameImage(systemName = null) {
    console.log(
      `ThemeManager.getDefaultGameImage: Retornando imagem padrão para jogo, sistema: ${systemName}`
    );

    // Se temos um tema atual com imagem personalizada para jogos
    if (
      this.themeData &&
      this.themeData.defaultImages &&
      this.themeData.defaultImages.gameImage
    ) {
      return this.themeData.defaultImages.gameImage;
    }

    // Verificar se há um padrão específico para o sistema
    if (systemName && this.systemThemeCache[systemName]) {
      const systemTheme = this.systemThemeCache[systemName];
      if (systemTheme.defaultImages && systemTheme.defaultImages.gameImage) {
        return systemTheme.defaultImages.gameImage;
      }
    }

    // Caso contrário, usar o padrão geral
    return "src/themes/default/assets/icons/default-game.png";
  }

  /**
   * Retorna o caminho do logo padrão para sistemas
   * @returns {string} - Caminho para o logo padrão
   */
  getDefaultSystemLogo() {
    console.log(
      `ThemeManager.getDefaultSystemLogo: Retornando logo padrão para sistema`
    );

    // Verificar se há um tema atual com logo personalizado
    if (
      this.themeData &&
      this.themeData.defaultImages &&
      this.themeData.defaultImages.systemLogo
    ) {
      return this.themeData.defaultImages.systemLogo;
    }

    // Caso contrário, usar o logo padrão do app
    return "src/themes/default/assets/icons/default-system.png";
  }
}
