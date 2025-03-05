/**
 * Endpoints para manipulação de temas
 */
const path = require("path");
const fs = require("fs");

// Referência global para os caminhos (será definida na inicialização)
let PATHS;

/**
 * Inicializa os endpoints com as configurações necessárias
 * @param {Object} paths - Objeto com os caminhos do aplicativo
 */
function initialize(paths) {
  PATHS = paths;
}

/**
 * Obtém a lista de todos os temas disponíveis
 * @returns {Promise<Object>} Lista de temas
 */
async function getAllThemes() {
  try {
    // Verificar temas internos
    const internalThemesPath = path.join(PATHS.ROOT, "src", "themes");
    let internalThemes = [];

    if (fs.existsSync(internalThemesPath)) {
      const internalThemesFolders = fs
        .readdirSync(internalThemesPath)
        .filter((item) => {
          const themePath = path.join(internalThemesPath, item);
          return fs.statSync(themePath).isDirectory();
        });

      internalThemes = internalThemesFolders.map((folder) => ({
        name: folder,
        type: "internal",
        path: path.join(internalThemesPath, folder),
        isDefault: folder === "default",
      }));
    }

    // Verificar temas externos
    const externalThemesPath = path.join(PATHS.ROOT, "themes");
    let externalThemes = [];

    if (fs.existsSync(externalThemesPath)) {
      const externalThemesFolders = fs
        .readdirSync(externalThemesPath)
        .filter((item) => {
          const themePath = path.join(externalThemesPath, item);
          return fs.statSync(themePath).isDirectory();
        });

      externalThemes = externalThemesFolders.map((folder) => ({
        name: folder,
        type: "external",
        path: path.join(externalThemesPath, folder),
        isDefault: false,
      }));
    }

    // Combinar temas internos e externos
    const allThemes = [...internalThemes, ...externalThemes];

    return {
      themes: allThemes,
      count: allThemes.length,
      defaultTheme: allThemes.find((theme) => theme.isDefault) || null,
    };
  } catch (error) {
    console.error("Erro ao obter temas:", error);
    return { error: error.message };
  }
}

/**
 * Obtém detalhes de um tema específico
 * @param {string} themeName - Nome do tema
 * @param {boolean} [isExternal=false] - Indica se é um tema externo
 * @returns {Promise<Object>} Detalhes do tema
 */
async function getThemeByName(themeName, isExternal = false) {
  try {
    const themePath = isExternal
      ? path.join(PATHS.ROOT, "themes", themeName)
      : path.join(PATHS.ROOT, "src", "themes", themeName);

    if (!fs.existsSync(themePath)) {
      return { error: `Tema não encontrado: ${themeName}` };
    }

    // Verificar se existe um arquivo de configuração theme.cfg ou theme.json
    let themeConfig = {};
    const themeCfgPath = path.join(themePath, "theme.cfg");
    const themeJsonPath = path.join(themePath, "theme.json");

    if (fs.existsSync(themeCfgPath)) {
      try {
        const configContent = fs.readFileSync(themeCfgPath, "utf8");
        // Processar arquivo de configuração simples (formato de linhas chave=valor)
        const configLines = configContent.split("\n");

        configLines.forEach((line) => {
          const [key, value] = line.split("=").map((item) => item.trim());
          if (key && value) {
            themeConfig[key] = value;
          }
        });
      } catch (error) {
        console.error(`Erro ao ler configuração do tema ${themeName}:`, error);
      }
    } else if (fs.existsSync(themeJsonPath)) {
      try {
        const configContent = fs.readFileSync(themeJsonPath, "utf8");
        themeConfig = JSON.parse(configContent);
      } catch (error) {
        console.error(
          `Erro ao ler configuração JSON do tema ${themeName}:`,
          error
        );
      }
    }

    // Verificar estrutura de diretórios do tema
    const hasTemplatesDir = fs.existsSync(path.join(themePath, "templates"));
    const hasCssDir = fs.existsSync(path.join(themePath, "css"));
    const hasJsDir = fs.existsSync(path.join(themePath, "js"));
    const hasImagesDir = fs.existsSync(path.join(themePath, "images"));

    // Listar templates disponíveis
    let templates = [];
    if (hasTemplatesDir) {
      try {
        templates = fs
          .readdirSync(path.join(themePath, "templates"))
          .filter((file) => file.endsWith(".html"))
          .map((file) => ({
            name: path.basename(file, ".html"),
            path: path.join("templates", file),
          }));
      } catch (error) {
        console.error(`Erro ao listar templates do tema ${themeName}:`, error);
      }
    }

    return {
      theme: {
        name: themeName,
        type: isExternal ? "external" : "internal",
        path: themePath,
        config: themeConfig,
        templates,
        structure: {
          hasTemplates: hasTemplatesDir,
          hasCss: hasCssDir,
          hasJs: hasJsDir,
          hasImages: hasImagesDir,
        },
      },
    };
  } catch (error) {
    console.error(`Erro ao obter detalhes do tema ${themeName}:`, error);
    return { error: error.message };
  }
}

/**
 * Obtém o conteúdo de um arquivo de template de um tema
 * @param {string} themeName - Nome do tema
 * @param {string} templateName - Nome do template
 * @param {boolean} [isExternal=false] - Indica se é um tema externo
 * @returns {Promise<Object>} Conteúdo do template
 */
async function getThemeTemplate(themeName, templateName, isExternal = false) {
  try {
    const themePath = isExternal
      ? path.join(PATHS.ROOT, "themes", themeName)
      : path.join(PATHS.ROOT, "src", "themes", themeName);

    if (!fs.existsSync(themePath)) {
      return { error: `Tema não encontrado: ${themeName}` };
    }

    const templatePath = path.join(
      themePath,
      "templates",
      `${templateName}.html`
    );

    if (!fs.existsSync(templatePath)) {
      return { error: `Template não encontrado: ${templateName}` };
    }

    const templateContent = fs.readFileSync(templatePath, "utf8");

    return {
      template: {
        name: templateName,
        content: templateContent,
        theme: themeName,
      },
    };
  } catch (error) {
    console.error(
      `Erro ao obter template ${templateName} do tema ${themeName}:`,
      error
    );
    return { error: error.message };
  }
}

// Exportar os endpoints
module.exports = {
  initialize,
  getAll: getAllThemes,
  getByName: getThemeByName,
  getTemplate: getThemeTemplate,
};
