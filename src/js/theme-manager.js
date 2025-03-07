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

      // Verificar se o tema existe no diretório externo primeiro (se a API estiver disponível)
      if (window.api && typeof window.api.checkExternalTheme === "function") {
        try {
          const externalThemeExists = await window.api.checkExternalTheme(
            themeName
          );
          this.isExternalTheme = externalThemeExists;
        } catch (error) {
          console.error("Erro ao verificar tema externo:", error);
          this.isExternalTheme = false;
        }
      } else {
        // Sem API disponível, assumir tema interno
        this.isExternalTheme = false;
      }

      // Carregar dados do tema
      await this.loadThemeData();

      // Carregar estilos do tema
      await this.loadThemeStyles();

      return true;
    } catch (error) {
      console.error(`Erro ao inicializar o ThemeManager: ${error.message}`);
      return false;
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
        `[ThemeManager] Carregando dados do tema: ${this.currentTheme}`
      );

      // Definir o caminho do tema
      const themePath = `src/themes/${this.currentTheme}`;

      // Carregar o theme.json
      const themeData = await this.fetchThemeJson(themePath);

      if (themeData) {
        console.log(
          `[ThemeManager] Dados do tema carregados do theme.json:`,
          themeData
        );

        // Estruturar os dados do tema
        this.themeData = {
          theme: {
            name: themeData.name || this.currentTheme,
            version: themeData.version || "1.0.0",
            author: themeData.author || "Sistema",
            description: themeData.description || "Tema",
            primaryColor: themeData.colors?.primary || "#1a88ff",
            backgroundColor: themeData.colors?.background || "#121212",
            textColor: themeData.colors?.text || "#ffffff",
            accentColor: themeData.colors?.accent || "#ff5722",
            cardColor: themeData.colors?.card || "#1e1e1e",
            fontFamily: themeData.fonts?.main || "Roboto, sans-serif",
            headingFont:
              themeData.fonts?.headings || "Roboto Condensed, sans-serif",
          },
          settings: themeData.settings || {
            showGameCount: true,
            useCustomBackground: false,
          },
        };
      } else {
        console.warn(
          `[ThemeManager] theme.json não encontrado, usando dados padrão`
        );

        // Usar valores padrão se não conseguir carregar o JSON
        this.themeData = {
          theme: {
            name: this.currentTheme,
            version: "1.0.0",
            author: "Sistema",
            description: "Tema padrão",
            primaryColor: "#1a88ff",
            backgroundColor: "#121212",
            textColor: "#ffffff",
            cardColor: "#1e1e1e",
          },
        };
      }

      return this.themeData;
    } catch (error) {
      console.error(
        `[ThemeManager] Erro ao carregar dados do tema: ${error.message}`
      );

      // Garantir que sempre temos um objeto de dados básico
      this.themeData = {
        theme: {
          name: this.currentTheme,
          version: "1.0.0",
          author: "Sistema",
          description: "Tema padrão fallback",
          primaryColor: "#1a88ff",
          backgroundColor: "#121212",
          textColor: "#ffffff",
          cardColor: "#1e1e1e",
        },
      };

      return this.themeData;
    }
  }

  // Load theme styles
  async loadThemeStyles() {
    try {
      const themeName = this.currentTheme;
      const themePath = `src/themes/${themeName}/css`;

      console.log(`[ThemeManager] Carregando estilos do tema: ${themeName}`);

      // Remover estilos antigos do tema
      document.querySelectorAll('link[id^="theme-"]').forEach((link) => {
        link.remove();
      });

      // Carregar os estilos CSS necessários
      const cssFiles = [
        "base.css",
        "theme.css",
        "systems.css",
        "gamelist.css",
        "settings.css",
        "fontawesome.css",
      ];

      // Adicionar cada arquivo CSS ao head
      let loadedCount = 0;
      for (let i = 0; i < cssFiles.length; i++) {
        const file = cssFiles[i];
        const linkElement = document.createElement("link");
        linkElement.id = `theme-style-${i}`;
        linkElement.rel = "stylesheet";
        linkElement.href = `${themePath}/${file}`;

        // Adicionar handler para erros de carregamento
        linkElement.onerror = () => {
          console.warn(
            `[ThemeManager] Erro ao carregar CSS: ${themePath}/${file}`
          );

          // Se não for o fontawesome (que é opcional), tentar carregar do tema padrão
          if (file !== "fontawesome.css") {
            console.log(
              `[ThemeManager] Tentando carregar do tema padrão: ${file}`
            );
            linkElement.href = `src/themes/default/css/${file}`;
          }
        };

        // Adicionar handler para carregamento bem-sucedido
        linkElement.onload = () => {
          loadedCount++;
          console.log(
            `[ThemeManager] CSS carregado (${loadedCount}/${cssFiles.length}): ${linkElement.href}`
          );
        };

        document.head.appendChild(linkElement);
      }

      console.log(`[ThemeManager] Estilos do tema ${themeName} carregados`);
      return true;
    } catch (error) {
      console.error(
        `[ThemeManager] Erro ao carregar estilos do tema: ${error.message}`
      );

      // Em caso de falha, tentar carregar o tema padrão
      if (themeName !== "default") {
        console.warn("[ThemeManager] Tentando carregar estilos do tema padrão");
        this.currentTheme = "default";
        return this.loadThemeStyles();
      }

      return false;
    }
  }

  // Load theme's JavaScript files (opcional)
  async loadThemeScripts() {
    try {
      const themeName = this.currentTheme;
      const scriptPath = `src/themes/${themeName}/js/theme.js`;
      const scriptId = "theme-script";

      // Remove existing theme script if it exists
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }

      // Verificar se o script existe usando fetch antes de tentar carregar
      try {
        const response = await fetch(scriptPath, { method: "HEAD" });
        if (!response.ok) {
          console.log(
            `[ThemeManager] Script não encontrado: ${scriptPath} - isso é normal para temas que usam apenas theme.json`
          );
          return true; // Retornar sucesso mesmo sem carregar script
        }
      } catch (fetchError) {
        // Ignorar erro de fetch, o script pode não existir
        console.log(
          `[ThemeManager] Script não encontrado via fetch: ${scriptPath}`
        );
        return true; // Retornar sucesso mesmo sem carregar script
      }

      // Add new theme script
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "module";
      script.src = scriptPath;

      console.log(`[ThemeManager] Carregando script do tema: ${scriptPath}`);

      // Promise para saber quando o script terminar de carregar
      return new Promise((resolve, reject) => {
        script.onload = () => {
          console.log(
            `[ThemeManager] Script do tema ${themeName} carregado com sucesso`
          );
          resolve(true);
        };
        script.onerror = (error) => {
          console.warn(
            `[ThemeManager] Erro ao carregar script do tema ${themeName}:`,
            error
          );
          // Não rejeitar para não interromper o carregamento do tema
          resolve(false);
        };
        document.head.appendChild(script);
      });
    } catch (error) {
      console.warn(
        `[ThemeManager] Erro ao carregar scripts do tema: ${error.message}`
      );
      return false; // Não falhar o carregamento do tema se os scripts falharem
    }
  }

  // Load and cache a template
  async loadTemplate(templateName) {
    try {
      console.log(
        `ThemeManager: Iniciando carregamento do template "${templateName}"`
      );
      console.log(`ThemeManager: Tema atual: ${this.currentTheme}`);

      // Verificar se já temos esse template em cache
      if (this.templateCache.has(templateName)) {
        console.log(
          `ThemeManager: Template "${templateName}" encontrado em cache.`
        );
        return this.templateCache.get(templateName);
      }

      // Construir o caminho para o template
      const themeName = this.currentTheme || "default";
      const templatePath = `src/themes/${themeName}/templates/${templateName}.html`;

      console.log(`ThemeManager: Caminho do template: ${templatePath}`);

      // Carregar o template
      try {
        // Usar fetch para carregar o template
        const response = await fetch(templatePath);

        if (!response.ok) {
          throw new Error(
            `Falha ao carregar o template (${response.status} ${response.statusText})`
          );
        }

        const templateHtml = await response.text();
        this.templateCache.set(templateName, templateHtml);

        console.log(
          `ThemeManager: Template "${templateName}" carregado e armazenado em cache.`
        );
        return templateHtml;
      } catch (fetchError) {
        console.error(
          `ThemeManager: Erro ao carregar template via fetch: ${fetchError.message}`
        );
        throw fetchError;
      }
    } catch (error) {
      console.error(
        `ThemeManager: Erro ao carregar template "${templateName}": ${error.message}`
      );
      return null;
    }
  }

  // Render a template asynchronously
  async renderTemplateAsync(templateName, data) {
    try {
      console.log(
        `ThemeManager: Iniciando renderização assíncrona do template "${templateName}"`
      );

      // Carregar o template se ainda não estiver em cache
      const template = await this.loadTemplate(templateName);
      if (!template) {
        throw new Error(`Template "${templateName}" não encontrado`);
      }

      // Adicionar helpers ao contexto de dados
      const enhancedData = {
        ...data,
        app: {
          title: "RIESCADE",
          ...(data.app || {}),
        },
      };

      // Usar o Mustache para renderizar o template
      console.log(
        `ThemeManager: Renderizando template "${templateName}" com Mustache`
      );

      try {
        // Registrar helpers para o Mustache
        Mustache.Formatters = Mustache.Formatters || {};
        Mustache.Formatters.gt = function (value1, value2) {
          return value1 > value2;
        };

        const rendered = Mustache.render(template, enhancedData);
        return rendered;
      } catch (mustacheError) {
        console.error(`Erro na renderização Mustache:`, mustacheError);

        // Fallback para renderização simples
        console.log(`ThemeManager: Fallback para renderização simples`);
        return this.renderTemplate(template, enhancedData);
      }
    } catch (error) {
      console.error(`Erro ao renderizar template "${templateName}":`, error);
      throw error;
    }
  }

  // Render a template with data (método síncrono)
  renderTemplate(template, data) {
    console.log("ThemeManager.renderTemplate: Iniciando renderização");

    if (!template) {
      console.error("ThemeManager.renderTemplate: Template está vazio");
      return "";
    }

    try {
      // Process conditional blocks first (if statements)
      let processedTemplate = template;

      // Helper para comparação: greater than (gt)
      processedTemplate = processedTemplate.replace(
        /\{\{#if \(gt ([^}]+) ([^}]+)\)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (match, value1, value2, ifContent, elseContent) => {
          const val1 = this.getNestedValue(data, value1.trim());
          const val2 = Number(value2.trim());
          return val1 > val2 ? ifContent : elseContent;
        }
      );

      // Helper para simples condicional
      processedTemplate = processedTemplate.replace(
        /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (match, condition, ifContent, elseContent) => {
          const value = this.getNestedValue(data, condition.trim());
          return value ? ifContent : elseContent;
        }
      );

      // Versão simples do condicional sem else
      processedTemplate = processedTemplate.replace(
        /\{\{#if ([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
        (match, condition, content) => {
          const value = this.getNestedValue(data, condition.trim());
          return value ? content : "";
        }
      );

      // Process repeating blocks next
      processedTemplate = this.processRepeatingBlocks(processedTemplate, data);

      // Replace all interpolation tags with actual data
      const rendered = processedTemplate.replace(
        /\{\{([^}]+)\}\}/g,
        (match, key) => {
          return this.getNestedValue(data, key.trim()) || "";
        }
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
      // Verificar se os dados são válidos
      if (!data || !data.systems || !Array.isArray(data.systems)) {
        console.error("Invalid data for systems view:", data);
        throw new Error("Invalid data for systems view");
      }

      console.log("Renderizando systems view com tema:", this.currentTheme);

      // Carregar o template de sistemas
      let template = await this.loadTemplate("systems");
      console.log("Template carregado:", template ? "sim" : "não");

      // Se o template não for encontrado, usar um template fallback
      if (!template) {
        console.warn("Template systems não encontrado, usando fallback");

        // FALLBACK: Se não encontrar o template, gerar HTML diretamente
        let html = `<div class="systems-grid">`;

        // Gerar HTML para cada sistema
        data.systems.forEach((system) => {
          const logoPath = this.getSystemLogoPath(system.name);
          html += `
            <div class="system-card" data-system-id="${
              system.name
            }" data-system-name="${system.name}">
              <div class="system-logo">
                <img src="${logoPath}" alt="${
            system.name
          }" onerror="this.style.display='none'; this.parentNode.textContent='${
            system.fullname || system.name
          }'">
              </div>
              <div class="system-name">${system.fullname || system.name}</div>
              <div class="system-info">
                <span class="game-count">${system.gameCount || 0} jogos</span>
              </div>
            </div>
          `;
        });

        html += `</div>`;
        console.log("Template gerado diretamente como fallback");
        return html;
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

      console.log("Dados preparados para renderização:", {
        totalSystems: templateData.systems.length,
        firstSystem: templateData.systems[0]?.name,
      });

      // Check if template starts with systems-container div and remove it to prevent nesting
      if (template.trim().startsWith('<div class="systems-container">')) {
        console.log(
          "Removendo div systems-container do template para evitar duplicação"
        );
        // Extract the content inside the systems-container div
        const containerContentMatch = template.match(
          /<div class="systems-container">([\s\S]*?)<\/div>\s*$/
        );
        if (containerContentMatch && containerContentMatch[1]) {
          template = containerContentMatch[1];
        }
      }

      // Renderizar manualmente - mais confiável que usar Mustache em alguns casos
      let html = template;

      // Substituir variáveis simples
      html = html.replace(/\{\{app.title\}\}/g, templateData.app.title);
      html = html.replace(
        /\{\{stats.totalGames\}\}/g,
        templateData.stats.totalGames
      );
      html = html.replace(
        /\{\{stats.totalSystems\}\}/g,
        templateData.stats.totalSystems
      );

      // Processar o loop de sistemas
      const systemsTemplateMatch = html.match(
        /<!-- BEGIN systems -->([\s\S]*?)<!-- END systems -->/
      );
      if (systemsTemplateMatch && systemsTemplateMatch[1]) {
        const systemTemplate = systemsTemplateMatch[1];
        let systemsHtml = "";

        templateData.systems.forEach((system) => {
          let systemHtml = systemTemplate;
          systemHtml = systemHtml.replace(/\{\{id\}\}/g, system.id);
          systemHtml = systemHtml.replace(/\{\{name\}\}/g, system.name);
          systemHtml = systemHtml.replace(
            /\{\{fullname\}\}/g,
            system.fullname || system.name
          );
          systemHtml = systemHtml.replace(/\{\{logoPath\}\}/g, system.logoPath);

          // Fix for conditional rendering
          const gameCount = system.gameCount || 0;
          if (gameCount > -1) {
            // Replace the entire conditional with just the true part
            systemHtml = systemHtml.replace(
              /\{\{#if \(gt gameCount -1\)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
              `<span class="game-count">${gameCount} jogos</span>`
            );
          } else {
            // Replace the entire conditional with just the false part
            systemHtml = systemHtml.replace(
              /\{\{#if \(gt gameCount -1\)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
              `<span class="game-count">? jogos</span>`
            );
          }

          // Keep this line for backward compatibility with other templates
          systemHtml = systemHtml.replace(/\{\{gameCount\}\}/g, gameCount);

          systemsHtml += systemHtml;
        });

        html = html.replace(systemsTemplateMatch[0], systemsHtml);
      } else {
        console.error(
          "Não foi possível encontrar o bloco de template para sistemas"
        );
      }

      console.log("Template systems renderizado com sucesso");
      return html;
    } catch (error) {
      console.error("Error rendering systems view:", error);

      // SUPER FALLBACK - apenas gerar uma grade básica de sistemas
      let html = `<div class="systems-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">`;
      data.systems.forEach((system) => {
        html += `
          <div class="system-card" data-system-id="${
            system.name
          }" data-system-name="${system.name}" 
               style="background-color: #333; padding: 20px; border-radius: 10px; cursor: pointer; text-align: center;">
            <div class="system-name" style="font-weight: bold; margin-top: 10px; color: white;">${
              system.fullname || system.name
            }</div>
            <div class="system-info" style="font-size: 0.8em; color: #ccc;">
              <span class="game-count">${system.gameCount || 0} jogos</span>
            </div>
          </div>
        `;
      });
      html += `</div>`;

      return html;
    }
  }
  // Render the game list view
  async renderGameListView(system, games) {
    console.log("ThemeManager: Iniciando renderização da lista de jogos");

    // Validate the system object
    if (!system) {
      console.error("ThemeManager: Sistema inválido (null ou undefined)");
      return null;
    }

    if (typeof system === "string") {
      console.warn(
        "ThemeManager: Sistema passado como string, convertendo para objeto"
      );
      system = {
        name: system,
        fullname: system,
        id: system,
        logoPath: this.getSystemLogoPath(system),
      };
    }

    // Ensure required properties
    if (!system.logoPath) {
      console.warn("ThemeManager: Sistema sem logoPath, adicionando");
      system.logoPath = this.getSystemLogoPath(system.name);
    }

    if (!system.fullname) {
      system.fullname = system.name;
    }

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
        games: games || [], // Passar a lista completa de jogos
        currentTheme: this.currentTheme,
        // Adicionar helpers para o Mustache
        hasGames: function () {
          return games && games.length > 0;
        },
      };

      console.log("ThemeManager: Dados preparados para renderização:", {
        systemName: system.name,
        systemFullname: system.fullname,
        systemLogoPath: system.logoPath,
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
      console.log("Iniciando inicialização do gerenciador de temas...");

      // Configurar valores iniciais
      this.currentTheme = "default"; // Tema padrão
      this.templateCache = new Map(); // Cache de templates
      this.systemThemeCache = {}; // Cache de temas por sistema

      console.log("Valores iniciais configurados. Carregando tema padrão...");

      // Carregar dados do tema
      await this.loadThemeData();
      console.log("Dados do tema carregados");

      // Carregar estilos do tema
      await this.loadThemeStyles();
      console.log("Estilos do tema carregados");

      // Aplica propriedades CSS globais do tema
      this.applyGlobalTheme();
      console.log("Propriedades globais do tema aplicadas");

      // Carregar scripts do tema
      try {
        await this.loadThemeScripts();
        console.log("Scripts do tema carregados");
      } catch (scriptError) {
        console.warn("Erro ao carregar scripts do tema:", scriptError);
        // Continuamos mesmo se os scripts falharem
      }

      console.log("Tema padrão carregado com sucesso");
      return true;
    } catch (error) {
      console.error("Erro ao inicializar gerenciador de temas:", error);
      return false;
    }
  }

  // Aplicar tema global à interface
  applyGlobalTheme() {
    if (!this.currentTheme) return;

    const theme = this.currentTheme;

    // Aplicar cores globais via variáveis CSS
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

    console.log(`Mudando para visualização: ${viewName}`);

    // Fixar viewName para systems se for system
    const viewId = viewName === "system" ? "systems" : viewName;

    // Esconder todas as visualizações
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.add("hidden");
    });

    // Mostrar a visualização selecionada
    const viewElement = document.getElementById(`${viewId}-view`);
    if (viewElement) {
      console.log(`Mostrando visualização: ${viewId}-view`);
      viewElement.classList.remove("hidden");
      viewElement.classList.add("fade-in");

      // Aplicar configurações específicas da visualização
      if (this.currentTheme) {
        if (
          this.themeParser &&
          typeof this.themeParser.applyViewTheme === "function"
        ) {
          this.themeParser.applyViewTheme(
            this.currentTheme.views && this.currentTheme.views[viewName],
            viewName
          );
        }
      }

      this.currentView = viewName;
      return true;
    } else {
      console.error(`Elemento de visualização não encontrado: ${viewId}-view`);
      return false;
    }
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
    try {
      // Verificar se há uma tela de sistemas para aplicar o tema
      const systemsContainer = document.querySelector(".systems-container");
      if (!systemsContainer) {
        return;
      }

      // Adicionar classe para indicar que o tema foi aplicado
      systemsContainer.classList.add("theme-applied");
    } catch (error) {
      console.error("Erro ao aplicar tema à tela de sistemas:", error);
    }
  }

  // Aplica tema específico à tela de lista de jogos
  applyGameListTheme(systemName) {
    try {
      // Verificar se há um container de lista de jogos para aplicar o tema
      const gameListContainer = document.querySelector(".gamelist-container");
      if (!gameListContainer) {
        return;
      }

      // Adicionar classe para indicar que o tema foi aplicado
      gameListContainer.classList.add("theme-applied");

      // Aplicar layout de grade por padrão
      gameListContainer.classList.add("grid-layout");
    } catch (error) {
      console.error("Erro ao aplicar tema à lista de jogos:", error);
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
      console.log(`[ThemeManager] Alterando tema para: ${themeName}`);

      // Verificar se o tema é passado como objeto ou string
      if (typeof themeName === "object") {
        console.warn(
          "[ThemeManager] changeTheme recebeu um objeto em vez de uma string:",
          themeName
        );
        themeName = themeName.id || themeName.name || "default";
      }

      // Validar se o tema existe na lista de temas disponíveis
      const availableThemes = await this.getAvailableThemes();
      const themeExists = availableThemes.some(
        (theme) =>
          theme.id === themeName ||
          (typeof theme === "string" && theme === themeName)
      );

      if (!themeExists) {
        console.warn(
          `[ThemeManager] Tema '${themeName}' não encontrado na lista de temas disponíveis. Usando o padrão.`
        );
        themeName = "default";
      }

      // Atualizar propriedades
      this.activeTheme = themeName;
      this.currentTheme = themeName;

      // Limpar cache para garantir que os novos templates sejam carregados
      this.systemThemeCache = {};
      this.templateCache.clear();

      // Carregar dados do tema
      await this.loadThemeData();

      // Carregar estilos do tema
      await this.loadThemeStyles();

      // Aplicar propriedades globais do tema
      this.applyGlobalTheme();

      // Tentar carregar scripts do tema
      try {
        await this.loadThemeScripts();
      } catch (scriptError) {
        console.warn(
          `[ThemeManager] Erro ao carregar scripts do tema ${themeName}:`,
          scriptError
        );
        // Continuamos mesmo se os scripts falharem
      }

      // Emitir evento de mudança de tema
      const event = new CustomEvent("theme-changed", {
        detail: {
          theme: themeName,
          previous: this.activeTheme,
        },
      });
      document.dispatchEvent(event);

      console.log(`[ThemeManager] Tema '${themeName}' carregado com sucesso`);
      return true;
    } catch (error) {
      console.error(
        `[ThemeManager] Erro ao mudar para o tema ${themeName}:`,
        error
      );
      // Em caso de erro, tentar voltar para o tema padrão se ainda não estamos tentando usá-lo
      if (themeName !== "default") {
        console.warn("[ThemeManager] Tentando carregar o tema padrão...");
        return this.changeTheme("default");
      }
      return false;
    }
  }

  // Get available themes (both internal and external)
  async getAvailableThemes() {
    try {
      console.log("[ThemeManager] Buscando temas disponíveis dinamicamente");

      // Lista para armazenar todos os temas validados
      let validThemes = [];
      const themeBasePath = "src/themes";

      // ====== ABORDAGEM DINÂMICA PARA DESCOBRIR TEMAS ======

      // 1. Verificar se existe um arquivo de índice que o servidor possa gerar
      try {
        // Tentar obter um índice de diretórios, se o servidor suportar
        const indexResponse = await fetch(`${themeBasePath}/`);
        if (
          indexResponse.ok &&
          indexResponse.headers.get("content-type").includes("text/html")
        ) {
          // Extrair nomes de diretórios do HTML da página de índice
          const html = await indexResponse.text();

          // Usar regex para extrair links de diretórios
          const dirRegex = /<a[^>]+href="([^"]+)\/"/g;
          let match;
          const potentialDirs = [];

          while ((match = dirRegex.exec(html)) !== null) {
            if (
              match[1] &&
              !match[1].startsWith(".") &&
              !match[1].includes("/")
            ) {
              potentialDirs.push(match[1]);
            }
          }

          console.log(
            "[ThemeManager] Diretórios potenciais encontrados via índice:",
            potentialDirs
          );

          // Verificar cada diretório potencial
          for (const dir of potentialDirs) {
            const themePath = `${themeBasePath}/${dir}`;
            const themeJson = await this.fetchThemeJson(themePath);

            if (themeJson) {
              validThemes.push({
                id: dir,
                name: themeJson.name || dir,
                description: themeJson.description || "",
                version: themeJson.version || "1.0.0",
                author: themeJson.author || "",
                path: themePath,
                type: "internal",
              });
              console.log(
                `[ThemeManager] Tema '${dir}' encontrado dinamicamente e validado`
              );
            }
          }
        }
      } catch (indexError) {
        console.log(
          "[ThemeManager] Não foi possível obter índice de diretórios:",
          indexError
        );
      }

      // 2. Se o método acima não encontrou temas, tentar descoberta iterativa
      if (validThemes.length === 0) {
        console.log("[ThemeManager] Usando descoberta iterativa de temas");

        // Abordagem 1: Verificar se theme-list.json existe como referência
        try {
          const response = await fetch(`${themeBasePath}/theme-list.json`);
          if (response.ok) {
            const themeList = await response.json();
            console.log(
              "[ThemeManager] Temas listados em theme-list.json:",
              themeList
            );

            // Verificar cada tema da lista
            for (const dir of themeList) {
              const themePath = `${themeBasePath}/${dir}`;
              const themeJson = await this.fetchThemeJson(themePath);

              if (themeJson) {
                validThemes.push({
                  id: dir,
                  name: themeJson.name || dir,
                  description: themeJson.description || "",
                  version: themeJson.version || "1.0.0",
                  author: themeJson.author || "",
                  path: themePath,
                  type: "internal",
                });
                console.log(
                  `[ThemeManager] Tema '${dir}' validado via theme-list.json`
                );
              }
            }
          }
        } catch (listError) {
          console.log(
            "[ThemeManager] Não foi possível usar theme-list.json:",
            listError
          );
        }
      }

      // 3. Se ainda não temos temas, fazer uma varredura ampla para descobrir temas
      if (
        validThemes.length === 0 ||
        (validThemes.length === 1 && validThemes[0].id === "default")
      ) {
        console.log(
          "[ThemeManager] Realizando varredura ampla para encontrar temas"
        );

        // Uma abordagem é tentar nomes de pastas comuns e verificar cada uma
        // mas também incluir variações alfabéticas para encontrar pastas personalizadas
        const commonNames = [
          // Nomes de temas comuns
          "default",
          "dark",
          "light",
          "platform",
          "retro",
          "modern",
          "arcade",
          "classic",
          "minimal",
          "neon",
          "vintage",
          "custom",
          "material",

          // Algumas cores comuns que podem ser nomes de temas
          "blue",
          "red",
          "green",
          "yellow",
          "purple",
          "orange",
          "black",
          "white",

          // Estilos de consoles populares
          "nes",
          "snes",
          "genesis",
          "playstation",
          "xbox",
          "gamecube",
          "n64",
          "dreamcast",
          "atari",
          "gameboy",
          "wiiu",
          "switch",
          "ps5",
          "ps4",

          // Outros nomes potenciais
          "theme1",
          "theme2",
          "theme3",
          "mytheme",
          "special",
          "holiday",
          "clean",
        ];

        // Adicionar checagens alfabéticas para capturar temas com nomes não previstos
        for (let i = 97; i <= 122; i++) {
          // códigos ASCII para 'a' até 'z'
          const letter = String.fromCharCode(i);
          // Adicionando algumas combinações básicas como 'a-theme', 'b-theme', etc.
          commonNames.push(letter);
          commonNames.push(`${letter}-theme`);
          commonNames.push(`theme-${letter}`);
        }

        // Busca assíncrona de todos os diretórios potenciais
        const themePromises = commonNames.map(async (dir) => {
          try {
            const themePath = `${themeBasePath}/${dir}`;
            const themeJson = await this.fetchThemeJson(themePath);

            if (themeJson) {
              return {
                id: dir,
                name: themeJson.name || dir,
                description: themeJson.description || "",
                version: themeJson.version || "1.0.0",
                author: themeJson.author || "",
                path: themePath,
                type: "internal",
              };
            }
          } catch (e) {
            // Silenciosamente ignorar se a pasta não existe
            return null;
          }
          return null;
        });

        // Esperar que todas as promessas sejam resolvidas e filtrar os nulos
        const discoveredThemes = (await Promise.all(themePromises)).filter(
          (theme) => theme !== null
        );
        console.log(
          `[ThemeManager] Descobertos ${discoveredThemes.length} temas via varredura ampla`
        );

        // Adicionar à lista de temas validados (evitar duplicatas)
        for (const theme of discoveredThemes) {
          if (!validThemes.some((t) => t.id === theme.id)) {
            validThemes.push(theme);
          }
        }
      }

      // Verificar temas externos (se a API estiver disponível)
      if (window.api && typeof window.api.getExternalThemes === "function") {
        try {
          const externalThemes = await window.api.getExternalThemes();
          if (Array.isArray(externalThemes) && externalThemes.length > 0) {
            validThemes = [...validThemes, ...externalThemes];
          }
        } catch (error) {
          console.warn("[ThemeManager] Erro ao obter temas externos:", error);
        }
      }

      // Garantir que pelo menos o tema padrão esteja disponível
      if (
        validThemes.length === 0 ||
        !validThemes.some((t) => t.id === "default")
      ) {
        validThemes.push({
          id: "default",
          name: "Default",
          description: "Default theme for RIESCADE",
          version: "1.0.0",
          author: "RIESCADE Team",
          path: "src/themes/default",
          type: "internal",
        });
      }

      // Remover duplicatas (pode acontecer nos métodos de descoberta)
      const uniqueThemes = [];
      const seenIds = new Set();

      for (const theme of validThemes) {
        if (!seenIds.has(theme.id)) {
          seenIds.add(theme.id);
          uniqueThemes.push(theme);
        }
      }

      console.log(
        `[ThemeManager] Total de ${uniqueThemes.length} temas únicos encontrados:`,
        uniqueThemes.map((t) => t.id).join(", ")
      );

      return uniqueThemes;
    } catch (error) {
      console.error("[ThemeManager] Erro ao obter temas disponíveis:", error);
      return [
        {
          id: "default",
          name: "Default",
          description: "Default theme for RIESCADE",
          version: "1.0.0",
          author: "RIESCADE Team",
          path: "src/themes/default",
          type: "internal",
        },
      ];
    }
  }

  // Método simplificado para carregar theme.json usando fetch
  async fetchThemeJson(themePath) {
    try {
      const response = await fetch(`${themePath}/theme.json`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn(
        `[ThemeManager] Erro ao carregar theme.json de ${themePath}:`,
        error
      );
      return null;
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
          "src/themes/default/assets/icons/default-game.png",
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
              <img src="{{game.image}}" alt="{{game.title}}" onerror="this.src='src/themes/default/assets/icons/default-game.png'">
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
      return "src/themes/default/assets/icons/default-game.png";
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
    const fallbackImagePath =
      "src/themes/default/assets/icons/default-game.png";

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
  getDefaultGameImage() {
    return "src/themes/default/assets/icons/default-game.png";
  }

  /**
   * Retorna o caminho do logo padrão para sistemas
   * @returns {string} - Caminho para o logo padrão
   */
  getDefaultSystemLogo() {
    return "src/themes/default/assets/icons/default-system.png";
  }

  async loadTheme(themeName = "default") {
    try {
      // Definir nome do tema
      this.currentTheme = themeName;

      // Verificar se é um tema externo
      this.isExternalTheme = themeName !== "default";

      // Carregar o tema
      let theme = null;

      // Tentar carregar via API
      if (window.api && window.api.localApi && window.api.localApi.themes) {
        try {
          const response = await window.api.localApi.themes.getByName(
            themeName
          );

          // Log de retorno de API
          console.log(
            `[ThemeManager] Resposta API themes.getByName(${themeName}):`,
            response
          );

          if (response && !response.error) {
            theme = response;
          }
        } catch (error) {
          console.error(
            `[ThemeManager] Erro ao carregar tema via API: ${error.message}`
          );
        }
      }

      // Se não conseguiu via API, tentar carregar o theme.json diretamente
      if (!theme) {
        try {
          // Definir caminho do tema
          const themePath = `src/themes/${themeName}`;

          // Tentar carregar o theme.json
          const themeData = await this.fetchThemeJson(themePath);

          if (themeData) {
            theme = themeData;
            console.log(`[ThemeManager] Tema carregado do theme.json:`, theme);
          } else {
            console.warn(
              `[ThemeManager] theme.json não encontrado para ${themeName}`
            );
          }
        } catch (error) {
          console.error(
            `[ThemeManager] Erro ao carregar theme.json: ${error.message}`
          );
        }
      }

      // Se ainda não conseguiu, criar uma instância falsa
      if (!theme) {
        console.warn(
          `[ThemeManager] Não foi possível carregar o tema ${themeName}. Usando fallback.`
        );
        theme = {
          name: themeName,
          description: "Tema padrão de fallback",
          version: "1.0.0",
          author: "Sistema",
        };
      }

      // Armazenar a instância do tema
      this.theme = theme;

      return true;
    } catch (error) {
      console.error(
        `[ThemeManager] Erro ao carregar tema ${themeName}: ${error.message}`
      );
      return false;
    }
  }

  async loadThemeTemplates() {
    try {
      // Tentar carregar os templates via API
      if (window.api && window.api.localApi && window.api.localApi.themes) {
        try {
          const response = await window.api.localApi.themes.getTemplates(
            this.currentTheme
          );

          // Log de retorno de API
          console.log(
            `Resposta API themes.getTemplates(${this.currentTheme}):`,
            response
          );

          if (response && !response.error) {
            this.templates = response;
            return true;
          }
        } catch (error) {
          console.error(`Erro ao carregar templates via API: ${error.message}`);
        }
      }

      // Se não conseguiu via API, carregar os templates básicos manualmente
      this.templates = {
        systems: null,
        gamelist: null,
        gamedetails: null,
      };

      return true;
    } catch (error) {
      console.error(`Erro ao carregar templates: ${error.message}`);
      return false;
    }
  }

  // Método para renderizar template de loading
  async renderLoadingTemplate(data = {}) {
    try {
      const defaultData = {
        title: "Carregando...",
        message: "Por favor, aguarde enquanto carregamos os dados.",
        showProgress: false,
        progress: 0,
      };

      // Combinar dados padrão com os fornecidos
      const templateData = { ...defaultData, ...data };

      // Carregar e renderizar o template
      return await this.renderTemplateAsync("loading", templateData);
    } catch (error) {
      console.error("Erro ao renderizar template de loading:", error);

      // Fallback simples em caso de erro
      return `
        <div class="loading-container">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-message">${data.message || "Carregando..."}</p>
          </div>
        </div>
      `;
    }
  }

  // Método para renderizar template de lançamento de jogo
  async renderLaunchGameTemplate(data = {}) {
    try {
      const defaultData = {
        gameName: "Jogo",
        systemName: "Sistema",
        showTip: false,
        tip: "Dica de jogo",
        systemLogo: "src/themes/default/assets/icons/default-system.png",
        gameImage: "src/themes/default/assets/icons/default-game.png",
      };

      // Combinar dados padrão com os fornecidos
      const templateData = { ...defaultData, ...data };

      // Garantir que os caminhos das imagens sejam válidos
      if (!templateData.gameImage) {
        templateData.gameImage = defaultData.gameImage;
      }

      if (!templateData.systemLogo) {
        templateData.systemLogo = defaultData.systemLogo;
      }

      // Remover prefixo 'src/' se presente nos caminhos de imagem
      if (templateData.gameImage.startsWith("src/")) {
        templateData.gameImage = templateData.gameImage.substring(4);
      }

      if (templateData.systemLogo.startsWith("src/")) {
        templateData.systemLogo = templateData.systemLogo.substring(4);
      }

      // Carregar e renderizar o template
      return await this.renderTemplateAsync("launchgame", templateData);
    } catch (error) {
      console.error(
        "Erro ao renderizar template de lançamento de jogo:",
        error
      );

      // Fallback simples em caso de erro
      return `
        <div class="game-launch-overlay">
          <div class="launch-content">
            <h2>Iniciando Jogo</h2>
            <p class="game-title">${data.gameName || "Jogo"}</p>
            <div class="loading-spinner"></div>
          </div>
        </div>
      `;
    }
  }
}
