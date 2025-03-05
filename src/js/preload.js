// Expor APIs para o renderer process
contextBridge.exposeInMainWorld("api", {
  // Métodos para leitura de configurações
  readSystemConfig: () => ipcRenderer.invoke("read-system-config"),
  readGameList: (systemName) =>
    ipcRenderer.invoke("read-game-list", systemName),

  // API IPC para jogos
  invoke: (channel, ...args) => {
    if (channel.startsWith("api:")) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error("Access to this IPC channel is restricted");
  },

  // Método para atualizar status de favorito de um jogo
  updateGameFavorite: (systemName, gameId, isFavorite) =>
    ipcRenderer.invoke("update-game-favorite", {
      systemName,
      gameId,
      isFavorite,
    }),

  // Método para lançar jogos
  launchGame: (gameData) => {
    console.log(`=== PRELOAD: CHAMANDO API PARA LANÇAR JOGO ===`);
    console.log(`Dados do jogo:`, gameData);

    if (!gameData || !gameData.systemName || !gameData.gamePath) {
      console.error(`Dados inválidos para lançamento:`, gameData);
      return Promise.resolve({
        success: false,
        error: "Dados inválidos para lançamento do jogo",
      });
    }

    console.log(`Enviando pedido para main process via IPC...`);
    return ipcRenderer
      .invoke("launch-game", gameData)
      .then((result) => {
        console.log(`Resposta do main process:`, result);
        return result;
      })
      .catch((error) => {
        console.error(`Erro na comunicação IPC:`, error);
        return {
          success: false,
          error:
            error.message || "Erro na comunicação com o processo principal",
        };
      });
  },

  // Métodos para temas
  getThemeConfig: (themeName, isExternal) =>
    ipcRenderer.invoke("get-theme-config", { themeName, isExternal }),
  checkExternalTheme: (themeName) =>
    ipcRenderer.invoke("check-external-theme", themeName),
  getInternalThemes: () => ipcRenderer.invoke("get-internal-themes"),
  getExternalThemes: () => ipcRenderer.invoke("get-external-themes"),

  // ... existing code ...
});
