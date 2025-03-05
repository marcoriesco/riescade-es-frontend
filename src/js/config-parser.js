// Classe para lidar com o parsing e manipulação de configurações
export class ConfigParser {
  constructor() {
    // Cache para configurações já carregadas
    this.systemsCache = null;
  }

  // Carregar e processar configurações de sistemas
  async getSystems() {
    try {
      // Usar cache se disponível
      if (this.systemsCache) {
        return this.systemsCache;
      }

      const result = await window.api.readSystemConfig();
      if (result.error) {
        throw new Error(result.error);
      }

      // Processar dados do sistema para formato mais fácil de usar
      let systems = [];
      if (result.systemList && result.systemList.system) {
        systems = Array.isArray(result.systemList.system)
          ? result.systemList.system
          : [result.systemList.system];

        // Adicionar dados adicionais para cada sistema
        systems = systems.map((system) => {
          return {
            ...system,
            // Extrair as extensões como array
            extensions: system.extension ? system.extension.split(" ") : [],
            // Determinar caminho do logo
            logoPath:
              system.logo ||
              `src/themes/default/assets/logos/${system.name}.png`,
            // Definir cores padrão se não especificadas
            color: system.color || "#1a88ff",
          };
        });
      }

      // Guardar no cache
      this.systemsCache = systems;
      return systems;
    } catch (error) {
      console.error("Erro ao carregar sistemas:", error);
      return [];
    }
  }

  // Carregar e processar lista de jogos para um sistema
  async getGames(systemName) {
    try {
      console.log(`Obtendo jogos para o sistema: ${systemName}`);
      const result = await window.api.readGameList(systemName);
      if (result.error) {
        throw new Error(result.error);
      }

      let games = [];
      if (result.gameList && result.gameList.game) {
        // Obter o caminho das ROMs para este sistema
        const systems = await this.getSystems();
        const system = systems.find((s) => s.name === systemName);
        const romPath = system ? system.path : "";
        console.log(`Caminho das ROMs para ${systemName}: ${romPath}`);

        games = Array.isArray(result.gameList.game)
          ? result.gameList.game
          : [result.gameList.game];

        console.log(`Número de jogos encontrados: ${games.length}`);
        console.log(
          `Exemplo de jogo (bruto):`,
          JSON.stringify(games[0], null, 2)
        );

        // Adicionar dados adicionais para cada jogo
        games = games.map((game, index) => {
          // Garantir que cada jogo tenha um ID
          if (!game.id) {
            game.id = `game_${systemName}_${index}`;
            console.log(`ID gerado para jogo ${index}: ${game.id}`);
          }

          // Garantir que cada jogo tenha um path
          if (!game.path) {
            console.log(`Jogo ${game.id || index} não tem path definido!`);
            // Se não tiver path, tentar usar o nome do arquivo como path
            if (game.name) {
              game.path = `${romPath}/${game.name}`;
              console.log(`Path gerado para jogo ${game.id}: ${game.path}`);
            }
          }

          // Resolver caminho da imagem em relação ao caminho das ROMs
          let resolvedImagePath = "assets/icons/default-game.png";

          if (game.image) {
            // Como não temos acesso ao path.isAbsolute no navegador,
            // precisamos usar a API que criamos no preload.js para resolver caminhos
            if (game.image.startsWith("./") || game.image.startsWith("../")) {
              // Caminhos relativos explícitos
              resolvedImagePath = window.api.resolveImagePath(
                romPath,
                game.image
              );
            } else if (!this.isAbsolutePath(game.image)) {
              // Se não for absoluto e não começar com ./ ou ../, assumir que é relativo ao romPath
              resolvedImagePath = window.api.resolveImagePath(
                romPath,
                game.image
              );
            } else {
              // Caminho absoluto
              resolvedImagePath = game.image;
            }
          }

          const processedGame = {
            ...game,
            id: game.id,
            path: game.path,
            imagePath: resolvedImagePath,
            description: game.desc || `Jogo ${game.name}`,
          };

          console.log(`Jogo ${index} processado:`, {
            id: processedGame.id,
            name: processedGame.name,
            path: processedGame.path,
            imagePath: processedGame.imagePath,
          });

          return processedGame;
        });

        console.log(
          `Exemplo de jogo (processado):`,
          JSON.stringify(games[0], null, 2)
        );
      }

      return games;
    } catch (error) {
      console.error(`Erro ao carregar jogos para ${systemName}:`, error);
      return [];
    }
  }

  // Método auxiliar para verificar se um caminho é absoluto
  // Uma implementação simplificada, já que não temos acesso ao path.isAbsolute do Node
  isAbsolutePath(path) {
    // No Windows, caminhos absolutos começam com letra seguida de ":"
    // ou com "\\" (caminhos de rede)
    if (/^[a-zA-Z]:\\/.test(path) || path.startsWith("\\\\")) {
      return true;
    }

    // No Unix/Linux/macOS, caminhos absolutos começam com "/"
    if (path.startsWith("/")) {
      return true;
    }

    return false;
  }

  // Obter a contagem de jogos para um sistema específico
  async getSystemGameCount(systemName) {
    try {
      const result = await window.api.readGameList(systemName);
      if (result.error) {
        console.warn(
          `Erro ao obter contagem de jogos para ${systemName}:`,
          result.error
        );
        return 0;
      }

      if (result.gameList && result.gameList.game) {
        const games = Array.isArray(result.gameList.game)
          ? result.gameList.game
          : [result.gameList.game];
        return games.length;
      }

      return 0;
    } catch (error) {
      console.error(
        `Erro ao obter contagem de jogos para ${systemName}:`,
        error
      );
      return 0;
    }
  }

  // Método para atualizar o status de favorito de um jogo
  async updateGameFavorite(systemName, gameId, isFavorite) {
    try {
      console.log(
        `Atualizando status de favorito para jogo ${gameId} do sistema ${systemName}: ${isFavorite}`
      );

      // Chamar a API para atualizar o status de favorito
      const result = await window.api.updateGameFavorite(
        systemName,
        gameId,
        isFavorite
      );

      if (result.error) {
        throw new Error(result.error);
      }

      console.log(
        `Status de favorito atualizado com sucesso: ${result.success}`
      );
      return result.success;
    } catch (error) {
      console.error(
        `Erro ao atualizar status de favorito para jogo ${gameId}:`,
        error
      );
      throw error;
    }
  }
}

// Classe para lidar com o parsing e aplicação de temas
export class ThemeParser {
  constructor() {
    this.themeCache = null;
    this.systemThemeCache = {};
  }

  // Obter dados do tema global
  async getThemeData() {
    try {
      // Tentar várias localizações possíveis para o arquivo de tema
      let themeData = null;

      // Caminho direto via API
      if (window.api && window.api.getThemeData) {
        themeData = await window.api.getThemeData();
        if (themeData && !themeData.error) {
          console.log("Tema carregado via API");
          return themeData;
        }
      }

      // Tema hardcoded de fallback se não conseguir carregar
      console.log("Usando tema de fallback");
      return {
        theme: {
          name: "default",
          primaryColor: "#1a88ff",
          backgroundColor: "#121212",
          textColor: "#ffffff",
          cardColor: "#1e1e1e",
          systemsScreen: {
            layout: "grid",
            backgroundColor: "rgba(0,0,0,0.7)",
          },
          gameListScreen: {
            layout: "grid",
            backgroundColor: "rgba(0,0,0,0.7)",
          },
        },
      };
    } catch (error) {
      console.error("Erro ao carregar dados do tema:", error);
      // Retornar um tema padrão em caso de erro
      return {
        theme: {
          name: "default",
          primaryColor: "#1a88ff",
          backgroundColor: "#121212",
          textColor: "#ffffff",
          cardColor: "#1e1e1e",
        },
      };
    }
  }

  // Obter dados de tema específicos para um sistema
  async getSystemTheme(systemName) {
    try {
      // Verificar cache
      if (this.systemThemeCache[systemName]) {
        return this.systemThemeCache[systemName];
      }

      const result = await window.api.getSystemThemeData(systemName);

      // Combinar com tema base
      const baseTheme = await this.getThemeData();

      // Adicionar propriedades específicas do sistema
      const systemTheme = {
        ...baseTheme,
        system: {
          name: systemName,
          logo: result.logo || null,
          background: result.background || null,
          fanart: result.fanart || null,
          sound: result.sound || null,
        },
      };

      // Guardar no cache
      this.systemThemeCache[systemName] = systemTheme;
      return systemTheme;
    } catch (error) {
      console.error(`Erro ao obter tema para sistema ${systemName}:`, error);

      // Em caso de erro, retornar o tema base
      return this.getThemeData();
    }
  }

  // Aplicar configurações específicas de uma visualização
  applyViewTheme(viewConfig, viewName) {
    if (!viewConfig) return;

    const viewElement = document.getElementById(`${viewName}-view`);
    if (!viewElement) return;

    // Aplicar configurações visuais ao elemento da visualização
    if (viewConfig.backgroundColor) {
      viewElement.style.backgroundColor = viewConfig.backgroundColor;
    }

    // Aplicar background específico, se disponível
    if (viewConfig.background) {
      const backgroundElement = document.createElement("div");
      backgroundElement.className = "theme-background";
      backgroundElement.id = `${viewName}-background`;
      backgroundElement.style.backgroundImage = `url(${viewConfig.background})`;

      // Remover background existente, se houver
      const existingBackground = document.getElementById(
        `${viewName}-background`
      );
      if (existingBackground) {
        existingBackground.remove();
      }

      // Adicionar novo background
      viewElement.appendChild(backgroundElement);
    }
  }

  // Obter lista de temas disponíveis
  async getAvailableThemes() {
    try {
      return await window.api.getAvailableThemes();
    } catch (error) {
      console.error("Erro ao obter temas disponíveis:", error);
      return ["default"];
    }
  }
}
