// Configurar handlers IPC
ipcMain.handle("read-system-config", async () => {
  try {
    return await configManager.readSystemConfig();
  } catch (error) {
    console.error("Erro ao ler configuração do sistema:", error);
    return { error: error.message };
  }
});

ipcMain.handle("read-game-list", async (event, systemName) => {
  try {
    return await configManager.readGameList(systemName);
  } catch (error) {
    console.error(`Erro ao ler lista de jogos para ${systemName}:`, error);
    return { error: error.message };
  }
});

// Handler para atualizar status de favorito de um jogo
ipcMain.handle(
  "update-game-favorite",
  async (event, { systemName, gameId, isFavorite }) => {
    try {
      await configManager.updateGameFavorite(systemName, gameId, isFavorite);
      return { success: true };
    } catch (error) {
      console.error("Erro ao atualizar status de favorito:", error);
      return { error: error.message };
    }
  }
);

// Handler para lançar jogos - DESATIVADO
// Este handler foi movido para o arquivo main.js principal
/*
ipcMain.handle("launch-game", async (event, gameData) => {
  console.log(`=== MAIN PROCESS: RECEBIDO PEDIDO PARA LANÇAR JOGO ===`);
  console.log(`Dados recebidos:`, gameData);

  try {
    // Verificar se temos os dados necessários
    if (!gameData || !gameData.systemName || !gameData.gamePath) {
      const errorMsg = "Dados insuficientes para lançar o jogo";
      console.error(errorMsg, gameData);
      return { success: false, error: errorMsg };
    }

    const { systemName, gamePath, gameId } = gameData;
    console.log(
      `Preparando para lançar: Sistema=${systemName}, Jogo=${gameId}, Caminho=${gamePath}`
    );

    // Verificar se o caminho existe
    if (!fs.existsSync(gamePath)) {
      const errorMsg = `Caminho do jogo não encontrado: ${gamePath}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log(`Caminho do jogo verificado e existe`);

    // Verificar se é uma URL ou um arquivo
    if (gamePath.startsWith("http://") || gamePath.startsWith("https://")) {
      console.log(`Abrindo URL: ${gamePath}`);
      shell.openExternal(gamePath);
      return { success: true, message: "URL aberta com sucesso" };
    }

    // Lançar o jogo usando child_process
    console.log(`Lançando aplicativo: ${gamePath}`);
    const child = child_process.spawn(gamePath, [], {
      detached: true,
      stdio: "ignore",
    });

    child.on("error", (err) => {
      console.error(`Erro ao lançar processo: ${err.message}`);
    });

    // Desvincula o processo filho para que ele continue rodando independentemente
    child.unref();

    console.log(`Processo iniciado com sucesso`);
    return { success: true, message: "Jogo lançado com sucesso" };
  } catch (error) {
    console.error(`Erro ao lançar jogo:`, error);
    return { success: false, error: error.message };
  }
});
*/
