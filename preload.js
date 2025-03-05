// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Adicionar log para verificar se o preload está sendo executado
console.log("Preload script está sendo executado");

// Corrigir erro de "dragEvent is not defined"
window.dragEvent = null;

// Funcionalidades da API expostas ao processo de renderização
contextBridge.exposeInMainWorld("api", {
  // Métodos para configuração do sistema
  readSystemConfig: async () => {
    try {
      return await ipcRenderer.invoke("read-system-config");
    } catch (error) {
      console.error("Erro ao ler configuração do sistema:", error);
      return { error: error.message };
    }
  },

  readGameList: async (systemName) => {
    try {
      return await ipcRenderer.invoke("read-game-list", systemName);
    } catch (error) {
      console.error("Erro ao ler lista de jogos:", error);
      return { error: error.message };
    }
  },

  launchGame: (gameData) => {
    console.log("preload.js: Chamando launchGame com dados:", gameData);
    return ipcRenderer.invoke("launch-game", gameData);
  },

  // Métodos para temas
  getThemeData: async () => {
    try {
      return await ipcRenderer.invoke("get-theme-data");
    } catch (error) {
      console.error("Erro ao obter dados do tema:", error);
      return { error: error.message };
    }
  },

  getSystemThemeData: async (systemName) => {
    try {
      return await ipcRenderer.invoke("get-system-theme-data", systemName);
    } catch (error) {
      console.error("Erro ao obter dados do tema do sistema:", error);
      return { error: error.message };
    }
  },

  getAvailableThemes: async () => {
    try {
      return await ipcRenderer.invoke("get-available-themes");
    } catch (error) {
      console.error("Erro ao obter temas disponíveis:", error);
      return ["default"];
    }
  },

  // Utilitários
  resolveImagePath: (romPath, imagePath) => {
    try {
      return ipcRenderer.invoke("resolve-image-path", romPath, imagePath);
    } catch (error) {
      console.error("Erro ao resolver caminho da imagem:", error);
      return imagePath;
    }
  },

  // Configurações
  saveSettings: async (settings) => {
    try {
      return await ipcRenderer.invoke("save-settings", settings);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      return { success: false, error: error.message };
    }
  },

  getSettings: async () => {
    try {
      return await ipcRenderer.invoke("get-settings");
    } catch (error) {
      console.error("Erro ao obter configurações:", error);
      return null;
    }
  },

  browseDirectory: async (dirType) => {
    try {
      return await ipcRenderer.invoke("browse-directory", dirType);
    } catch (error) {
      console.error("Erro ao navegar pelo diretório:", error);
      return { error: error.message };
    }
  },

  // Métodos relacionados a temas externos
  checkExternalTheme: async (themeName) => {
    try {
      return await ipcRenderer.invoke("check-external-theme", themeName);
    } catch (error) {
      console.error("Erro ao verificar tema externo:", error);
      return false;
    }
  },

  // Método para ler arquivos (importante para o ThemeManager)
  readFile: async (filePath, isExternal = false) => {
    try {
      console.log(
        `Chamando read-file com caminho: ${filePath}, isExternal: ${isExternal}`
      );
      return await ipcRenderer.invoke("read-file", filePath, isExternal);
    } catch (error) {
      console.error("Erro ao ler arquivo:", error);
      return null;
    }
  },

  getThemeConfig: async (themeName, isExternal = false) => {
    try {
      return await ipcRenderer.invoke(
        "get-theme-config",
        themeName,
        isExternal
      );
    } catch (error) {
      console.error("Erro ao obter configuração do tema:", error);
      return null;
    }
  },

  getInternalThemes: async () => {
    try {
      return await ipcRenderer.invoke("get-internal-themes");
    } catch (error) {
      console.error("Erro ao obter temas internos:", error);
      return ["default"];
    }
  },

  getExternalThemes: async () => {
    try {
      return await ipcRenderer.invoke("get-external-themes");
    } catch (error) {
      console.error("Erro ao obter temas externos:", error);
      return [];
    }
  },

  installTheme: async (zipFilePath) => {
    try {
      return await ipcRenderer.invoke("install-theme", zipFilePath);
    } catch (error) {
      console.error("Erro ao instalar tema:", error);
      return false;
    }
  },

  removeTheme: async (themeName) => {
    try {
      return await ipcRenderer.invoke("remove-theme", themeName);
    } catch (error) {
      console.error("Erro ao remover tema:", error);
      return false;
    }
  },

  // Nova API Local
  localApi: {
    // API de Sistemas
    systems: {
      getAll: async () => {
        try {
          return await ipcRenderer.invoke("api:systems:getAll");
        } catch (error) {
          console.error("Erro ao obter sistemas:", error);
          return { error: error.message };
        }
      },

      getByName: async (systemName) => {
        try {
          return await ipcRenderer.invoke("api:systems:getByName", systemName);
        } catch (error) {
          console.error(`Erro ao obter sistema ${systemName}:`, error);
          return { error: error.message };
        }
      },

      getRomPath: async (systemName) => {
        try {
          return await ipcRenderer.invoke("api:systems:getRomPath", systemName);
        } catch (error) {
          console.error(
            `Erro ao obter caminho de ROMs para ${systemName}:`,
            error
          );
          return { error: error.message };
        }
      },

      getLaunchConfig: async (systemName) => {
        try {
          return await ipcRenderer.invoke(
            "api:systems:getLaunchConfig",
            systemName
          );
        } catch (error) {
          console.error(
            `Erro ao obter configuração de launch para ${systemName}:`,
            error
          );
          return { error: error.message };
        }
      },
    },

    // API de Jogos
    games: {
      getBySystem: async (systemName) => {
        try {
          return await ipcRenderer.invoke("api:games:getBySystem", systemName);
        } catch (error) {
          console.error(`Erro ao obter jogos para ${systemName}:`, error);
          return { error: error.message };
        }
      },

      getById: async (systemName, gameId) => {
        try {
          return await ipcRenderer.invoke(
            "api:games:getById",
            systemName,
            gameId
          );
        } catch (error) {
          console.error(
            `Erro ao obter jogo ${gameId} do sistema ${systemName}:`,
            error
          );
          return { error: error.message };
        }
      },

      updateFavorite: async (systemName, gameId, favorite) => {
        try {
          return await ipcRenderer.invoke(
            "api:games:updateFavorite",
            systemName,
            gameId,
            favorite
          );
        } catch (error) {
          console.error(`Erro ao atualizar favorito do jogo ${gameId}:`, error);
          return { error: error.message };
        }
      },

      search: async (query, systemName = null) => {
        try {
          return await ipcRenderer.invoke(
            "api:games:search",
            query,
            systemName
          );
        } catch (error) {
          console.error(`Erro ao pesquisar jogos:`, error);
          return { error: error.message };
        }
      },
    },

    // API de Temas
    themes: {
      getAll: async () => {
        try {
          return await ipcRenderer.invoke("api:themes:getAll");
        } catch (error) {
          console.error("Erro ao obter temas:", error);
          return { error: error.message };
        }
      },

      getByName: async (themeName, isExternal = false) => {
        try {
          return await ipcRenderer.invoke(
            "api:themes:getByName",
            themeName,
            isExternal
          );
        } catch (error) {
          console.error(`Erro ao obter tema ${themeName}:`, error);
          return { error: error.message };
        }
      },

      getTemplate: async (themeName, templateName, isExternal = false) => {
        try {
          return await ipcRenderer.invoke(
            "api:themes:getTemplate",
            themeName,
            templateName,
            isExternal
          );
        } catch (error) {
          console.error(
            `Erro ao obter template ${templateName} do tema ${themeName}:`,
            error
          );
          return { error: error.message };
        }
      },
    },
  },
});

// Log para confirmar que a API foi exposta
console.log("API exposta ao processo de renderização");
console.log(
  "Métodos API disponíveis:",
  Object.keys(window.api || {}).join(", ")
);
