/**
 * Rotas da API para configurações de temas RIESCADE
 */
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const configService = require("../services/configService");

const router = express.Router();

// Variável para armazenar o tema atual
let currentThemeId = "default";

/**
 * Obtém o caminho para o arquivo theme.json de um tema
 * @param {string} themeId - ID do tema
 * @returns {string} Caminho para o arquivo theme.json
 */
function getThemeJsonPath(themeId) {
  return path.join(__dirname, "../../themes", themeId, "theme.json");
}

/**
 * Lê o arquivo theme.json de um tema
 * @param {string} themeId - ID do tema
 * @returns {Object} Conteúdo do theme.json
 */
function readThemeJson(themeId) {
  try {
    const themeJsonPath = getThemeJsonPath(themeId);

    if (!fs.existsSync(themeJsonPath)) {
      console.error(`Arquivo theme.json não encontrado para o tema ${themeId}`);
      return null;
    }

    const themeJsonContent = fs.readFileSync(themeJsonPath, "utf8");
    return JSON.parse(themeJsonContent);
  } catch (error) {
    console.error(`Erro ao ler theme.json para o tema ${themeId}:`, error);
    return null;
  }
}

/**
 * Escreve no arquivo theme.json de um tema
 * @param {string} themeId - ID do tema
 * @param {Object} themeJson - Conteúdo a ser escrito
 * @returns {boolean} true se bem-sucedido, false caso contrário
 */
function writeThemeJson(themeId, themeJson) {
  try {
    const themeJsonPath = getThemeJsonPath(themeId);
    fs.writeFileSync(themeJsonPath, JSON.stringify(themeJson, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error(`Erro ao escrever theme.json para o tema ${themeId}:`, error);
    return false;
  }
}

/**
 * Obtém o ID do tema atual
 * @returns {string} ID do tema atual
 */
function getCurrentThemeId() {
  return currentThemeId;
}

/**
 * Define o ID do tema atual
 * @param {string} themeId - ID do tema
 */
function setCurrentThemeId(themeId) {
  console.log(`Definindo tema atual para: ${themeId}`);
  currentThemeId = themeId;

  // Salvar a preferência em um arquivo de configuração do sistema
  try {
    const configPath = path.join(
      __dirname,
      "../../config",
      "current_theme.json"
    );
    console.log(`Salvando configuração de tema em: ${configPath}`);

    fs.ensureDirSync(path.dirname(configPath));

    const configData = JSON.stringify({ currentTheme: themeId }, null, 2);
    console.log(`Conteúdo da configuração: ${configData}`);

    fs.writeFileSync(configPath, configData, "utf8");

    console.log(`Tema atual salvo com sucesso: ${themeId}`);

    // Verificar se o arquivo foi salvo corretamente
    if (fs.existsSync(configPath)) {
      const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      console.log(
        `Configuração lida após salvar: ${JSON.stringify(savedConfig)}`
      );
    } else {
      console.error(`Arquivo de configuração não foi criado: ${configPath}`);
    }
  } catch (error) {
    console.error("Erro ao salvar preferência de tema:", error);
  }
}

// Inicializar o tema atual a partir do arquivo de configuração
try {
  const configPath = path.join(__dirname, "../../config", "current_theme.json");
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.currentTheme) {
      currentThemeId = config.currentTheme;
    }
  }
} catch (error) {
  console.error("Erro ao ler preferência de tema:", error);
}

/**
 * Lista todos os temas válidos (que contenham theme.json e index.html)
 * @returns {Array} Lista de temas válidos
 */
function getValidThemes() {
  try {
    const themesDir = path.join(__dirname, "../../themes");

    if (!fs.existsSync(themesDir)) {
      console.error("Diretório de temas não encontrado:", themesDir);
      return [];
    }

    const themes = [];

    // Listar diretórios no diretório de temas
    const themeDirs = fs
      .readdirSync(themesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // Verificar cada diretório de tema
    for (const themeDir of themeDirs) {
      const themePath = path.join(themesDir, themeDir);
      const themeJsonPath = path.join(themePath, "theme.json");
      const indexHtmlPath = path.join(themePath, "index.html");

      // Verificar se o tema contém theme.json e index.html
      if (fs.existsSync(themeJsonPath) && fs.existsSync(indexHtmlPath)) {
        try {
          // Ler o arquivo theme.json
          const themeJsonContent = fs.readFileSync(themeJsonPath, "utf8");
          const themeJson = JSON.parse(themeJsonContent);

          // Adicionar o tema à lista com todas as configurações do theme.json
          themes.push({
            id: themeDir,
            name: themeJson.name || themeDir,
            description: themeJson.description || "",
            author: themeJson.author || "Desconhecido",
            version: themeJson.version || "1.0.0",
            settings: themeJson.settings || [],
            hasSettings:
              Array.isArray(themeJson.settings) &&
              themeJson.settings.length > 0,
            // Incluir todo o conteúdo do theme.json
            themeConfig: themeJson,
          });
        } catch (error) {
          console.error(
            `Erro ao ler theme.json para o tema ${themeDir}:`,
            error
          );
        }
      }
    }

    return themes;
  } catch (error) {
    console.error("Erro ao listar temas:", error);
    return [];
  }
}

/**
 * GET /api/frontend/settings/theme
 * Retorna configurações do tema atual
 */
router.get("/settings/theme", (req, res) => {
  const themeId = getCurrentThemeId();
  const themeJson = readThemeJson(themeId);

  if (!themeJson) {
    return res.status(404).json({
      success: false,
      message: `Tema ${themeId} não encontrado ou inválido`,
    });
  }

  // Extrair as configurações atuais do tema
  const settings = {};

  if (Array.isArray(themeJson.settings)) {
    themeJson.settings.forEach((setting) => {
      settings[setting.id] =
        setting.value !== undefined ? setting.value : setting.default;
    });
  }

  res.json({
    success: true,
    data: settings,
  });
});

/**
 * PATCH /api/frontend/settings/theme
 * Atualiza configurações do tema atual
 */
router.patch("/settings/theme", (req, res) => {
  const updates = req.body;

  if (!updates || Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Nenhuma atualização fornecida",
    });
  }

  const themeId = getCurrentThemeId();
  const themeJson = readThemeJson(themeId);

  if (!themeJson) {
    return res.status(404).json({
      success: false,
      message: `Tema ${themeId} não encontrado ou inválido`,
    });
  }

  // Garantir que a seção settings existe
  if (!Array.isArray(themeJson.settings)) {
    themeJson.settings = [];
  }

  // Aplicar atualizações
  let updated = false;

  for (const [key, value] of Object.entries(updates)) {
    // Procurar a configuração pelo ID
    const settingIndex = themeJson.settings.findIndex((s) => s.id === key);

    if (settingIndex >= 0) {
      // Atualizar o valor da configuração existente
      themeJson.settings[settingIndex].value = value;
      updated = true;
    } else {
      // Adicionar nova configuração
      themeJson.settings.push({
        id: key,
        value: value,
      });
      updated = true;
    }
  }

  if (!updated) {
    return res.json({
      success: true,
      message: "Nenhuma configuração foi alterada",
      data: themeJson.settings,
    });
  }

  // Salvar as alterações
  const success = writeThemeJson(themeId, themeJson);

  if (success) {
    res.json({
      success: true,
      message: "Configurações atualizadas com sucesso",
      data: themeJson.settings,
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Erro ao salvar configurações",
    });
  }
});

/**
 * GET /api/frontend/themes
 * Retorna a lista de temas válidos
 */
router.get("/themes", (req, res) => {
  const themes = getValidThemes();

  res.json({
    success: true,
    data: themes,
  });
});

/**
 * GET /api/frontend/themes/current
 * Retorna o tema atual
 */
router.get("/themes/current", (req, res) => {
  const themeId = getCurrentThemeId();

  // Buscar informações completas do tema atual
  const themes = getValidThemes();
  const currentTheme = themes.find((theme) => theme.id === themeId) || {
    id: "default",
    name: "Tema Padrão",
    settings: [],
  };

  // Adicionar as configurações atuais do tema
  const themeJson = readThemeJson(themeId);

  if (themeJson && Array.isArray(themeJson.settings)) {
    currentTheme.currentSettings = {};

    themeJson.settings.forEach((setting) => {
      currentTheme.currentSettings[setting.id] =
        setting.value !== undefined ? setting.value : setting.default;
    });
  } else {
    currentTheme.currentSettings = {};
  }

  res.json({
    success: true,
    data: currentTheme,
  });
});

/**
 * PUT /api/frontend/themes/current
 * Define o tema atual
 */
router.put("/themes/current", (req, res) => {
  const { themeId } = req.body;

  if (!themeId) {
    return res.status(400).json({
      success: false,
      message: "ID do tema não fornecido",
    });
  }

  // Verificar se o tema existe
  const themes = getValidThemes();
  const theme = themes.find((t) => t.id === themeId);

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: `Tema '${themeId}' não encontrado`,
    });
  }

  // Atualizar tema atual
  setCurrentThemeId(themeId);

  res.json({
    success: true,
    message: "Tema atual atualizado com sucesso",
    data: theme,
  });
});

/**
 * PATCH /api/frontend/settings/keys
 * Define configurações de teclas
 */
router.patch("/settings/keys", (req, res) => {
  const { configKey } = req.body;

  if (!configKey) {
    return res.status(400).json({
      success: false,
      message: "Tecla de configuração não fornecida",
    });
  }

  // Salvar a configuração de tecla em um arquivo separado
  try {
    const configPath = path.join(__dirname, "../../config", "keys.json");
    fs.ensureDirSync(path.dirname(configPath));
    fs.writeFileSync(
      configPath,
      JSON.stringify({ configKey }, null, 2),
      "utf8"
    );

    res.json({
      success: true,
      message: "Configuração de tecla atualizada com sucesso",
      data: { configKey },
    });
  } catch (error) {
    console.error("Erro ao salvar configuração de tecla:", error);
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar configuração de tecla",
    });
  }
});

/**
 * PATCH /api/frontend/themes/:themeId/settings
 * Atualiza configurações de um tema específico
 */
router.patch("/themes/:themeId/settings", (req, res) => {
  const { themeId } = req.params;
  const { settings } = req.body;

  console.log(`Atualizando configurações do tema ${themeId}:`, settings);

  if (!settings || !Array.isArray(settings) || settings.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Nenhuma configuração fornecida para atualização",
    });
  }

  const themeJson = readThemeJson(themeId);

  if (!themeJson) {
    return res.status(404).json({
      success: false,
      message: `Tema ${themeId} não encontrado ou inválido`,
    });
  }

  // Garantir que a seção settings existe
  if (!Array.isArray(themeJson.settings)) {
    themeJson.settings = [];
  }

  // Aplicar atualizações
  let updated = false;

  for (const setting of settings) {
    if (!setting.id) {
      console.warn("Configuração sem ID ignorada:", setting);
      continue;
    }

    // Procurar a configuração pelo ID
    const settingIndex = themeJson.settings.findIndex(
      (s) => s.id === setting.id
    );

    if (settingIndex >= 0) {
      // Atualizar o valor da configuração existente
      console.log(
        `Atualizando configuração ${setting.id} de ${themeJson.settings[settingIndex].value} para ${setting.value}`
      );
      themeJson.settings[settingIndex].value = setting.value;
      updated = true;
    } else {
      // Adicionar nova configuração
      console.log(
        `Adicionando nova configuração ${setting.id} = ${setting.value}`
      );
      themeJson.settings.push({
        id: setting.id,
        value: setting.value,
      });
      updated = true;
    }
  }

  if (!updated) {
    return res.json({
      success: true,
      message: "Nenhuma configuração foi alterada",
      data: themeJson.settings,
    });
  }

  // Salvar as alterações
  const success = writeThemeJson(themeId, themeJson);

  if (success) {
    res.json({
      success: true,
      message: "Configurações atualizadas com sucesso",
      data: themeJson.settings,
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Erro ao salvar configurações",
    });
  }
});

// Exportar o router
module.exports = router;
