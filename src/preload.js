// Theme related IPC handlers
contextBridge.exposeInMainWorld("api", {
  // ... existing api methods ...

  // Check if theme exists in external directory
  checkExternalTheme: async (themeName) => {
    try {
      return await ipcRenderer.invoke("check-external-theme", themeName);
    } catch (error) {
      console.error("Error checking external theme:", error);
      return false;
    }
  },

  // Read theme file (from internal or external directory)
  readFile: async (filePath, isExternal = false) => {
    try {
      return await ipcRenderer.invoke("read-file", filePath, isExternal);
    } catch (error) {
      console.error("Error reading file:", error);
      return null;
    }
  },

  // Get theme configuration
  getThemeConfig: async (themeName, isExternal = false) => {
    try {
      return await ipcRenderer.invoke(
        "get-theme-config",
        themeName,
        isExternal
      );
    } catch (error) {
      console.error("Error getting theme config:", error);
      return null;
    }
  },

  // Get internal (bundled) themes
  getInternalThemes: async () => {
    try {
      return await ipcRenderer.invoke("get-internal-themes");
    } catch (error) {
      console.error("Error getting internal themes:", error);
      return ["default"];
    }
  },

  // Get external themes
  getExternalThemes: async () => {
    try {
      return await ipcRenderer.invoke("get-external-themes");
    } catch (error) {
      console.error("Error getting external themes:", error);
      return [];
    }
  },

  // Install new theme from zip file
  installTheme: async (zipFilePath) => {
    try {
      return await ipcRenderer.invoke("install-theme", zipFilePath);
    } catch (error) {
      console.error("Error installing theme:", error);
      return false;
    }
  },

  // Remove installed theme
  removeTheme: async (themeName) => {
    try {
      return await ipcRenderer.invoke("remove-theme", themeName);
    } catch (error) {
      console.error("Error removing theme:", error);
      return false;
    }
  },
});
