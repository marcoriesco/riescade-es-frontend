class ConfigManager {
  constructor() {
    // Diretório de configuração
    this.configDir = path.join(app.getPath("userData"), "config");

    // Garantir que o diretório de configuração existe
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // Garantir que o diretório de gamelists existe
    const gamelistsDir = path.join(this.configDir, "gamelists");
    if (!fs.existsSync(gamelistsDir)) {
      fs.mkdirSync(gamelistsDir, { recursive: true });
    }
  }

  // Método para ler a lista de jogos para um sistema
  async readGameList(systemName) {
    try {
      // Verificar se o sistema existe
      const systems = await this.readSystemConfig();
      const system = systems.systemList.system.find(
        (s) => s.name === systemName
      );

      if (!system) {
        throw new Error(`Sistema ${systemName} não encontrado`);
      }

      // Caminho para o arquivo gamelist.xml
      const gamelistPath = path.join(
        this.configDir,
        "gamelists",
        systemName,
        "gamelist.xml"
      );

      // Verificar se o arquivo existe
      if (!fs.existsSync(gamelistPath)) {
        console.warn(`Arquivo gamelist.xml não encontrado para ${systemName}`);
        return { gameList: { game: [] } };
      }

      // Ler e fazer parse do XML
      const xml = await fs.promises.readFile(gamelistPath, "utf8");
      const result = await this.parseXML(xml);

      return result;
    } catch (error) {
      console.error(`Erro ao ler lista de jogos para ${systemName}:`, error);
      throw error;
    }
  }

  // Método para atualizar o status de favorito de um jogo
  async updateGameFavorite(systemName, gameId, isFavorite) {
    try {
      // Caminho para o arquivo gamelist.xml
      const gamelistPath = path.join(
        this.configDir,
        "gamelists",
        systemName,
        "gamelist.xml"
      );

      // Verificar se o arquivo existe
      if (!fs.existsSync(gamelistPath)) {
        throw new Error(
          `Arquivo gamelist.xml não encontrado para ${systemName}`
        );
      }

      // Ler o arquivo XML
      const xml = await fs.promises.readFile(gamelistPath, "utf8");

      // Fazer parse do XML para objeto JavaScript
      const gameList = await this.parseXML(xml);

      // Verificar se temos jogos
      if (!gameList.gameList || !gameList.gameList.game) {
        throw new Error(`Nenhum jogo encontrado para ${systemName}`);
      }

      // Converter para array se for um único jogo
      const games = Array.isArray(gameList.gameList.game)
        ? gameList.gameList.game
        : [gameList.gameList.game];

      // Encontrar o jogo pelo ID
      const gameIndex = games.findIndex((game) => game.id === gameId);

      if (gameIndex === -1) {
        throw new Error(`Jogo com ID ${gameId} não encontrado`);
      }

      // Atualizar o status de favorito
      games[gameIndex].favorite = isFavorite;

      // Converter de volta para XML
      const builder = new xml2js.Builder();
      const updatedXml = builder.buildObject(gameList);

      // Salvar o arquivo atualizado
      await fs.promises.writeFile(gamelistPath, updatedXml, "utf8");

      console.log(`Status de favorito atualizado para jogo ${gameId}`);
      return true;
    } catch (error) {
      console.error(
        `Erro ao atualizar status de favorito para jogo ${gameId}:`,
        error
      );
      throw error;
    }
  }
}
