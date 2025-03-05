/**
 * Arquivo de teste para a API local
 * Este arquivo contém funções para testar a API local
 */

// Função para testar a API de sistemas
async function testSystemsApi() {
  console.log("Testando API de sistemas...");

  try {
    // Obter todos os sistemas
    console.log("Obtendo todos os sistemas...");
    const systems = await window.api.localApi.systems.getAll();
    console.log("Sistemas encontrados:", systems);

    if (systems.error) {
      console.error("Erro ao obter sistemas:", systems.error);
      return;
    }

    // Se encontrou sistemas, testar outras funções com o primeiro sistema
    if (systems && systems.length > 0) {
      const firstSystem = systems[0];
      console.log("Testando com o sistema:", firstSystem.name);

      // Obter sistema por nome
      console.log("Obtendo sistema por nome...");
      const system = await window.api.localApi.systems.getByName(
        firstSystem.name
      );
      console.log("Sistema encontrado:", system);

      // Obter caminho de ROMs
      console.log("Obtendo caminho de ROMs...");
      const romPath = await window.api.localApi.systems.getRomPath(
        firstSystem.name
      );
      console.log("Caminho de ROMs:", romPath);

      // Obter configuração de lançamento
      console.log("Obtendo configuração de lançamento...");
      const launchConfig = await window.api.localApi.systems.getLaunchConfig(
        firstSystem.name
      );
      console.log("Configuração de lançamento:", launchConfig);
    }
  } catch (error) {
    console.error("Erro ao testar API de sistemas:", error);
  }
}

// Função para testar a API de jogos
async function testGamesApi() {
  console.log("Testando API de jogos...");

  try {
    // Obter todos os sistemas primeiro
    const systems = await window.api.localApi.systems.getAll();

    if (systems.error) {
      console.error("Erro ao obter sistemas:", systems.error);
      return;
    }

    // Se encontrou sistemas, testar com o primeiro sistema
    if (systems && systems.length > 0) {
      const firstSystem = systems[0];
      console.log("Testando com o sistema:", firstSystem.name);

      // Obter jogos por sistema
      console.log("Obtendo jogos por sistema...");
      const games = await window.api.localApi.games.getBySystem(
        firstSystem.name
      );
      console.log("Jogos encontrados:", games);

      // Se encontrou jogos, testar outras funções com o primeiro jogo
      if (
        games &&
        games.gameList &&
        games.gameList.game &&
        games.gameList.game.length > 0
      ) {
        const firstGame = games.gameList.game[0];
        console.log("Testando com o jogo:", firstGame.name || firstGame.path);

        // Obter jogo por ID
        console.log("Obtendo jogo por ID...");
        const game = await window.api.localApi.games.getById(
          firstSystem.name,
          firstGame.id
        );
        console.log("Jogo encontrado:", game);

        // Testar pesquisa
        console.log("Testando pesquisa...");
        const searchTerm = firstGame.name
          ? firstGame.name.substring(0, 3)
          : "test";
        const searchResults = await window.api.localApi.games.search(
          searchTerm
        );
        console.log(
          `Resultados da pesquisa por "${searchTerm}":`,
          searchResults
        );
      }
    }
  } catch (error) {
    console.error("Erro ao testar API de jogos:", error);
  }
}

// Função para testar a API de temas
async function testThemesApi() {
  console.log("Testando API de temas...");

  try {
    // Obter todos os temas
    console.log("Obtendo todos os temas...");
    const themes = await window.api.localApi.themes.getAll();
    console.log("Temas encontrados:", themes);

    if (themes.error) {
      console.error("Erro ao obter temas:", themes.error);
      return;
    }

    // Se encontrou temas, testar outras funções com o primeiro tema
    if (themes && themes.length > 0) {
      const firstTheme = themes[0];
      console.log("Testando com o tema:", firstTheme);

      // Obter tema por nome
      console.log("Obtendo tema por nome...");
      const theme = await window.api.localApi.themes.getByName(firstTheme);
      console.log("Tema encontrado:", theme);

      // Obter template do tema
      console.log("Obtendo template do tema...");
      const template = await window.api.localApi.themes.getTemplate(
        firstTheme,
        "system"
      );
      console.log("Template encontrado:", template);
    }
  } catch (error) {
    console.error("Erro ao testar API de temas:", error);
  }
}

// Função principal para testar todas as APIs
async function testAllApis() {
  console.log("Iniciando testes da API local...");

  // Testar API de sistemas
  await testSystemsApi();

  // Testar API de jogos
  await testGamesApi();

  // Testar API de temas
  await testThemesApi();

  console.log("Testes concluídos!");
}

// Inicializar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", function () {
  console.log("API Test script carregado!");

  // Exportar funções de teste para o objeto global
  window.testApiLocal = {
    testAllApis,
    testSystemsApi,
    testGamesApi,
    testThemesApi,
  };
});
