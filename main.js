const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");
const { exec } = require("child_process");
const AdmZip = require("adm-zip");

// Importar a API local
const { registerApiEndpoints } = require("./api/index");
const systemEndpoints = require("./api/endpoints/systems");
const gameEndpoints = require("./api/endpoints/games");
const themeEndpoints = require("./api/endpoints/themes");

// Definir caminhos principais como constantes
// Usar o diretório onde o executável está em produção ou o diretório atual em desenvolvimento
const isProduction = app.isPackaged;
let rootDir = isProduction
  ? path.dirname(app.getPath("exe")) // Diretório onde está o executável em produção
  : process.cwd(); // Diretório atual em desenvolvimento

// Em produção, o diretório raiz do EmulationStation é um nível acima do executável
// Em desenvolvimento, é um nível acima do _riescade
const emulationStationRootDir = path.dirname(rootDir);
console.log("Diretório do projeto:", rootDir);
console.log("Diretório raiz do EmulationStation:", emulationStationRootDir);

const PATHS = {
  ROOT: rootDir,
  EMULATIONSTATION_ROOT: emulationStationRootDir,
  EMULATIONSTATION: path.join(emulationStationRootDir, "emulationstation"),
  EMULATIONSTATION_CONFIG: path.join(
    emulationStationRootDir,
    "emulationstation/.emulationstation"
  ),
  ROMS: path.join(emulationStationRootDir, "roms"),
  EMULATORS: path.join(emulationStationRootDir, "emulators"),
  BIOS: path.join(emulationStationRootDir, "bios"),
  SAVES: path.join(emulationStationRootDir, "saves"),
  SCREENSHOTS: path.join(emulationStationRootDir, "screenshots"),
};

// Função auxiliar para obter o caminho de ROMs de um sistema específico
PATHS.getSystemRomsPath = function (systemName) {
  return path.join(this.ROMS, systemName);
};

// NÃO criar diretórios automaticamente, apenas verificar se existem
function checkRequiredDirectories() {
  // Verificar os diretórios essenciais e logar se não existirem
  const essentialDirs = [PATHS.EMULATIONSTATION, PATHS.ROMS];
  const missingDirs = essentialDirs.filter((dir) => !fs.existsSync(dir));

  if (missingDirs.length > 0) {
    console.warn("Diretórios essenciais não encontrados:");
    missingDirs.forEach((dir) => console.warn(`- ${dir}`));
    return false;
  }

  return true;
}

let mainWindow;

function createWindow() {
  // Apenas verificar os diretórios, não criar
  const dirsExist = checkRequiredDirectories();
  if (!dirsExist) {
    console.warn(
      "Alguns diretórios essenciais não foram encontrados. O aplicativo pode não funcionar corretamente."
    );
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    fullscreen: true,
  });

  mainWindow.loadFile("index.html");

  // Remover menu na produção
  if (isProduction) {
    mainWindow.setMenuBarVisibility(false);
  } else {
    mainWindow.setMenuBarVisibility(true);
  }

  // Registrar endpoints da API local
  // Inicializar endpoints com os caminhos
  systemEndpoints.initialize(PATHS);
  gameEndpoints.initialize(PATHS);
  themeEndpoints.initialize(PATHS);

  // Registrar endpoints
  registerApiEndpoints({
    systemEndpoints,
    gameEndpoints,
    themeEndpoints,
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// Handlers para comunicação IPC
ipcMain.handle("read-system-config", async () => {
  try {
    // Caminho para o arquivo de configuração principal
    let configPath = path.join(PATHS.EMULATIONSTATION_CONFIG, "es_systems.cfg");
    console.log("Tentando caminho do arquivo de configuração:", configPath);

    if (!fs.existsSync(configPath)) {
      console.error("Arquivo de configuração não encontrado.");
      return { error: "Arquivo de configuração não encontrado" };
    }

    const configData = fs.readFileSync(configPath, "utf8");

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "value",
    });

    const systems = parser.parse(configData);

    // Procurar por configurações customizadas para cada sistema
    if (systems.systemList && systems.systemList.system) {
      const systemArray = Array.isArray(systems.systemList.system)
        ? systems.systemList.system
        : [systems.systemList.system];

      for (const system of systemArray) {
        // Verificar configurações customizadas em vários locais possíveis
        const customConfigPaths = [
          path.join(
            PATHS.EMULATIONSTATION_CONFIG,
            `es_system_${system.name}.cfg`
          ),
          path.join(path.dirname(configPath), `es_system_${system.name}.cfg`),
        ];

        for (const customPath of customConfigPaths) {
          if (fs.existsSync(customPath)) {
            const customData = fs.readFileSync(customPath, "utf8");
            const customConfig = parser.parse(customData);

            // Sobrescrever configurações com valores customizados
            Object.assign(system, customConfig.system);
            break;
          }
        }

        // Substituir o caminho para as ROMs pelo caminho constante
        system.path = PATHS.getSystemRomsPath(system.name);
      }
    }

    return systems;
  } catch (error) {
    console.error("Erro ao ler configuração:", error);
    return { error: error.message };
  }
});

ipcMain.handle("read-game-list", async (event, systemName) => {
  try {
    // Primeiro, obter o caminho dos ROMs do sistema a partir do es_systems.cfg
    let configPath = path.join(PATHS.EMULATIONSTATION_CONFIG, "es_systems.cfg");

    // Verificar caminhos alternativos se necessário
    if (!fs.existsSync(configPath)) {
      console.error("Arquivo de configuração não encontrado.");
      return { error: "Arquivo de configuração não encontrado" };
    }

    const configData = fs.readFileSync(configPath, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "value",
    });

    const systems = parser.parse(configData);
    let extensions = [];

    // Caminho das ROMs é baseado em nossas constantes predefinidas
    const romPath = PATHS.getSystemRomsPath(systemName);
    console.log(`Caminho das ROMs para ${systemName}:`, romPath);

    if (systems.systemList && systems.systemList.system) {
      const systemArray = Array.isArray(systems.systemList.system)
        ? systems.systemList.system
        : [systems.systemList.system];

      const system = systemArray.find((s) => s.name === systemName);
      if (system) {
        extensions = system.extension
          .split(" ")
          .map((ext) => ext.toLowerCase());
      }
    }

    if (!fs.existsSync(romPath)) {
      console.error(`Diretório de ROMs não encontrado: ${romPath}`);
      return { error: `Diretório de ROMs não encontrado: ${romPath}` };
    }

    // Verificar se existe um gamelist.xml
    const gamelistPath = path.join(romPath, "gamelist.xml");

    if (fs.existsSync(gamelistPath)) {
      // Usar o gamelist.xml se existir
      const gamelistData = fs.readFileSync(gamelistPath, "utf8");
      const games = parser.parse(gamelistData);

      // Se houver imagens com caminhos relativos, resolvê-los
      if (games.gameList && games.gameList.game) {
        const gameArray = Array.isArray(games.gameList.game)
          ? games.gameList.game
          : [games.gameList.game];

        for (let i = 0; i < gameArray.length; i++) {
          const game = gameArray[i];

          // Garantir que cada jogo tenha um ID
          if (!game.id) {
            game.id = `game_${systemName}_${i}`;
            console.log(`ID gerado para jogo ${i}: ${game.id}`);
          }

          // Garantir que cada jogo tenha um path
          if (!game.path) {
            console.log(`Jogo ${game.id} não tem path definido!`);
            // Se não tiver path, tentar usar o nome do arquivo como path
            if (game.name) {
              game.path = path.join(romPath, `${game.name}.rom`);
              console.log(`Path gerado para jogo ${game.id}: ${game.path}`);
            } else {
              game.path = path.join(romPath, `game_${i}.rom`);
              console.log(
                `Path genérico gerado para jogo ${game.id}: ${game.path}`
              );
            }
          }

          // Processar imagem
          if (
            game.image &&
            (game.image.startsWith("./") || game.image.startsWith("../"))
          ) {
            // Converter caminho relativo para absoluto
            game.image = path.resolve(romPath, game.image);
          }
        }
      }

      return games;
    } else {
      // Caso contrário, escanear a pasta por ROMs com as extensões corretas
      const files = fs.readdirSync(romPath);
      const games = files
        .filter((file) => {
          const ext = path.extname(file).toLowerCase().substring(1);
          return extensions.includes(`.${ext}`);
        })
        .map((file, index) => {
          const fileName = path.basename(file, path.extname(file));
          return {
            id: `game_${systemName}_${index}`,
            name: fileName,
            path: path.join(romPath, file),
          };
        });

      console.log(
        `Jogos escaneados do diretório:`,
        games.length > 0 ? games[0] : "Nenhum jogo"
      );
      return { gameList: { game: games } };
    }
  } catch (error) {
    console.error("Erro ao ler lista de jogos:", error);
    return { error: error.message };
  }
});

// Handler para lançar jogos
ipcMain.handle("launch-game", async (event, gameInfo) => {
  try {
    console.log("Recebido pedido para lançar jogo:", gameInfo);

    // Extrair informações do jogo
    let systemName, gamePath;

    // Compatibilidade com interface antiga e nova
    if (typeof gameInfo === "string") {
      // Formato antigo: apenas o caminho do jogo
      gamePath = gameInfo;
      // Tentar extrair o sistema do caminho (assumindo formato padrão)
      const pathParts = gamePath.split("/");
      if (pathParts.length > 1) {
        systemName = pathParts[pathParts.length - 2];
      }
    } else {
      // Formato novo: objeto com sistema e caminho
      console.log(`Recebido gameInfo:`, JSON.stringify(gameInfo, null, 2));

      // Verificar se systemName está diretamente no objeto ou em gameInfo.system
      systemName = gameInfo.systemName || gameInfo.system;
      console.log(`systemName inicial:`, systemName);

      // Se systemName for um objeto, extrair o nome
      if (systemName && typeof systemName === "object") {
        console.log(
          `systemName é um objeto:`,
          JSON.stringify(systemName, null, 2)
        );
        if (systemName.name) {
          systemName = systemName.name;
        } else {
          // Tentar extrair o nome de outras propriedades possíveis
          systemName =
            systemName.id || systemName.value || systemName.toString();
        }
        console.log(`systemName extraído do objeto:`, systemName);
      }

      gamePath = gameInfo.gamePath || gameInfo.path;
      console.log(`Lançando jogo: ${gamePath} do sistema: ${systemName}`);
    }

    if (!systemName) {
      throw new Error("Nome do sistema não especificado ou inválido");
    }

    // Verificar se o caminho é relativo (começa com ./)
    if (gamePath.startsWith("./") || !path.isAbsolute(gamePath)) {
      // Construir caminho completo
      const systemRomPath = PATHS.getSystemRomsPath(systemName);
      gamePath = path.join(systemRomPath, gamePath.replace("./", ""));
      console.log(`Caminho completo do jogo: ${gamePath}`);
    }

    // Obter a configuração do sistema para encontrar o comando
    let configPath = path.join(PATHS.EMULATIONSTATION_CONFIG, "es_systems.cfg");

    if (!fs.existsSync(configPath)) {
      throw new Error("Arquivo de configuração não encontrado");
    }

    const configData = fs.readFileSync(configPath, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "value",
    });

    const systems = parser.parse(configData);

    // Encontrar o sistema correto
    if (!systems.systemList || !systems.systemList.system) {
      throw new Error("Configuração de sistemas inválida");
    }

    const systemArray = Array.isArray(systems.systemList.system)
      ? systems.systemList.system
      : [systems.systemList.system];

    const system = systemArray.find((s) => s.name === systemName);

    if (!system) {
      throw new Error(`Sistema '${systemName}' não encontrado na configuração`);
    }

    // Obter o comando de lançamento
    if (!system.command) {
      throw new Error(
        `Comando de lançamento não definido para o sistema ${systemName}`
      );
    }

    // Obter primeiro emulador e core da lista
    let emulator = "",
      core = "";

    // Verificar se o sistema tem emuladores
    if (system.emulators && system.emulators.emulator) {
      const emulatorsArray = Array.isArray(system.emulators.emulator)
        ? system.emulators.emulator
        : [system.emulators.emulator];

      if (emulatorsArray.length > 0) {
        // Usar o primeiro emulador
        const firstEmulator = emulatorsArray[0];

        // Extrair o nome do emulador - pode estar em diferentes formatos dependendo do parser XML
        if (typeof firstEmulator === "string") {
          emulator = firstEmulator;
        } else if (firstEmulator._name) {
          emulator = firstEmulator._name;
        } else if (firstEmulator.name) {
          emulator = firstEmulator.name;
        } else if (firstEmulator.value) {
          emulator = firstEmulator.value;
        } else {
          // Se não conseguir extrair, usar um valor padrão
          emulator = "libretro";
        }

        // Verificar se o emulador tem cores
        if (firstEmulator.cores && firstEmulator.cores.core) {
          const coresArray = Array.isArray(firstEmulator.cores.core)
            ? firstEmulator.cores.core
            : [firstEmulator.cores.core];

          if (coresArray.length > 0) {
            // Extrair o nome do core - também pode estar em diferentes formatos
            const firstCore = coresArray[0];

            if (typeof firstCore === "string") {
              core = firstCore;
            } else if (firstCore._name) {
              core = firstCore._name;
            } else if (firstCore.name) {
              core = firstCore.name;
            } else if (firstCore.value) {
              core = firstCore.value;
            } else {
              // Se não encontrar em nenhum formato conhecido, converter para string
              // e fazer uma limpeza básica
              core = String(firstCore).replace("[object Object]", "").trim();
              // Se ainda estiver vazio, usar um valor padrão baseado no sistema
              if (!core) {
                // Mapear alguns sistemas comuns para seus cores padrão
                const defaultCores = {
                  cps3: "fbalpha2012_cps3",
                  mame: "mame2003_plus",
                  arcade: "fbneo",
                  nes: "nestopia",
                  snes: "snes9x",
                  n64: "mupen64plus_next",
                  gba: "mgba",
                  genesis: "genesis_plus_gx",
                  psx: "beetle_psx",
                };

                core = defaultCores[systemName] || "fbneo";
              }
            }
          }
        }
      }
    }

    // Adicionando logs detalhados
    console.log(`Emulador detectado: ${emulator}`);
    console.log(`Core detectado: ${core}`);

    // Adicione este código logo após ler os dados do sistema
    console.log("Estrutura do sistema:", JSON.stringify(system, null, 2));
    if (system.emulators) {
      console.log(
        "Estrutura de emuladores:",
        JSON.stringify(system.emulators, null, 2)
      );
    }

    // Processar o comando para usar o caminho correto do emulatorLauncher
    let command = system.command;

    // Substituir %HOME% pelo caminho real do EmulationStation
    command = command.replace(
      /%HOME%\\emulatorLauncher\.exe/i,
      path.join(PATHS.EMULATIONSTATION, "emulatorLauncher.exe")
    );

    // Substituir as outras variáveis
    command = command
      .replace(/%ROM%/g, `"${gamePath}"`)
      .replace(/%SYSTEM%/g, systemName)
      .replace(/%EMULATOR%/g, emulator)
      .replace(/%CORE%/g, core);

    // Criar diretório temporário para o gameinfo.xml se não existir
    const tempDir = path.join(app.getPath("temp"), "emulationstation.tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Caminho para o arquivo game.xml
    const gameInfoPath = path.join(tempDir, "game.xml");
    console.log(`Caminho do gameinfo.xml: ${gameInfoPath}`);

    // Para %GAMEINFOXML% e %CONTROLLERSCONFIG%, usamos valores dinâmicos
    command = command
      .replace(/%GAMEINFOXML%/g, gameInfoPath)
      .replace(
        /%CONTROLLERSCONFIG%/g,
        `-p1index 0 -p1guid 030000005e0400008e02000000007200 -p1path "USB\\VID_045E&PID_028E&IG_00\\2&DEE0F28&0&00" -p1name "Xbox 360 Controller" -p1nbbuttons 11 -p1nbhats 1 -p1nbaxes 6`
      );

    console.log(`Comando de lançamento: ${command}`);

    const process = exec(command, {
      cwd: PATHS.EMULATIONSTATION,
      windowsHide: false,
    });

    process.unref();

    return { success: true, message: "Jogo iniciado com sucesso" };
  } catch (error) {
    console.error("Erro ao lançar jogo:", error);
    return { success: false, error: error.message };
  }
});

// Função para obter o emulador apropriado para um sistema
function getEmulatorForSystem(systemName) {
  // Caminho para o arquivo de configuração de emuladores
  const emulatorsConfigPath = path.join(
    PATHS.EMULATIONSTATION_CONFIG,
    "es_systems.cfg"
  );

  // Verificar se o arquivo existe
  if (!fs.existsSync(emulatorsConfigPath)) {
    console.error(
      `Arquivo de configuração de emuladores não encontrado: ${emulatorsConfigPath}`
    );
    return null;
  }

  try {
    // Ler o arquivo de configuração
    const configData = fs.readFileSync(emulatorsConfigPath, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "value",
    });

    const systems = parser.parse(configData);

    // Encontrar o sistema correspondente
    if (systems.systemList && systems.systemList.system) {
      const systemArray = Array.isArray(systems.systemList.system)
        ? systems.systemList.system
        : [systems.systemList.system];

      const system = systemArray.find((s) => s.name === systemName);

      if (system && system.command) {
        // Extrair o comando e argumentos
        const commandParts = system.command.split(" ");
        const emulatorPath = commandParts[0];

        // Verificar se o emulador existe
        let fullEmulatorPath = emulatorPath;

        // Se o caminho for relativo, tentar resolver
        if (!path.isAbsolute(emulatorPath)) {
          // Tentar várias possibilidades para o caminho do emulador
          const possiblePaths = [
            path.join(PATHS.EMULATORS, emulatorPath),
            path.join(PATHS.EMULATIONSTATION_ROOT, emulatorPath),
            path.join(PATHS.EMULATIONSTATION, emulatorPath),
          ];

          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              fullEmulatorPath = possiblePath;
              break;
            }
          }
        }

        // Verificar se o emulador existe
        if (!fs.existsSync(fullEmulatorPath)) {
          console.error(`Emulador não encontrado: ${fullEmulatorPath}`);

          // Tentar encontrar retroarch.exe como fallback
          const retroarchPath = path.join(
            PATHS.EMULATORS,
            "retroarch",
            "retroarch.exe"
          );
          if (fs.existsSync(retroarchPath)) {
            console.log(`Usando RetroArch como fallback: ${retroarchPath}`);
            return {
              path: retroarchPath,
              args: ["-L", "cores\\core_para_" + systemName + ".dll", "{rom}"],
            };
          }

          return null;
        }

        // Extrair argumentos do comando
        const args = commandParts.slice(1);

        return {
          path: fullEmulatorPath,
          args: args,
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`Erro ao obter emulador para sistema ${systemName}:`, error);
    return null;
  }
}

ipcMain.handle("get-theme-data", async () => {
  try {
    // Estratégia para localizar os temas, em ordem de prioridade:
    // 1. resources/themes (em produção)
    // 2. ./themes no diretório raiz do EmulationStation
    // 3. ./themes no diretório do projeto
    let themesBasePath;

    if (isProduction && process.resourcesPath) {
      themesBasePath = path.join(process.resourcesPath, "themes");
      if (!fs.existsSync(themesBasePath)) {
        themesBasePath = null;
      }
    }

    if (!themesBasePath) {
      themesBasePath = path.join(emulationStationRootDir, "themes");
      if (!fs.existsSync(themesBasePath)) {
        themesBasePath = path.join(rootDir, "themes");
      }
    }

    const themePath = path.join(themesBasePath, "default", "theme.xml");
    console.log("Caminho do tema:", themePath);

    if (!fs.existsSync(themePath)) {
      return { error: "Tema não encontrado" };
    }

    const themeData = fs.readFileSync(themePath, "utf8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "_",
      textNodeName: "value",
    });

    return parser.parse(themeData);
  } catch (error) {
    console.error("Erro ao ler tema:", error);
    return { error: error.message };
  }
});

// Novo handler para obter dados de tema específicos para um sistema
ipcMain.handle("get-system-theme-data", async (event, systemName) => {
  try {
    // Estratégia para localizar os temas, em ordem de prioridade:
    // 1. resources/themes (em produção)
    // 2. ./themes no diretório raiz do EmulationStation
    // 3. ./themes no diretório do projeto
    let themesBasePath;

    if (isProduction && process.resourcesPath) {
      themesBasePath = path.join(process.resourcesPath, "themes");
      if (!fs.existsSync(themesBasePath)) {
        themesBasePath = null;
      }
    }

    if (!themesBasePath) {
      themesBasePath = path.join(emulationStationRootDir, "themes");
      if (!fs.existsSync(themesBasePath)) {
        themesBasePath = path.join(rootDir, "themes");
      }
    }

    // Verificar tema específico do sistema
    const systemThemePath = path.join(
      themesBasePath,
      "default",
      "systems",
      `${systemName}.xml`
    );

    if (fs.existsSync(systemThemePath)) {
      const themeData = fs.readFileSync(systemThemePath, "utf8");
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "_",
        textNodeName: "value",
      });

      // Obter dados do tema
      const themeConfig = parser.parse(themeData);

      // Adicionar caminhos de mídia para esse sistema
      const mediaPath = {
        logo: path.join(
          themesBasePath,
          "default",
          "logos",
          `${systemName}.png`
        ),
        background: path.join(
          themesBasePath,
          "default",
          "backgrounds",
          `${systemName}.jpg`
        ),
        fanart: path.join(
          themesBasePath,
          "default",
          "fanart",
          `${systemName}.jpg`
        ),
      };

      // Verificar que arquivos existem e converter para caminhos relativos
      Object.keys(mediaPath).forEach((key) => {
        if (fs.existsSync(mediaPath[key])) {
          // Converter para caminho relativo para a aplicação
          mediaPath[key] = path
            .relative(rootDir, mediaPath[key])
            .replace(/\\/g, "/");
        } else {
          delete mediaPath[key];
        }
      });

      return {
        ...themeConfig,
        ...mediaPath,
      };
    }

    // Se não existir um tema específico, retornar pelo menos os caminhos de mídia
    const themePaths = {
      logo: path.join(
        themesBasePath,
        "default",
        "assets/logos",
        `${systemName}.png`
      ),
      background: path.join(
        themesBasePath,
        "default",
        "backgrounds",
        `${systemName}.jpg`
      ),
      fanart: path.join(
        themesBasePath,
        "default",
        "fanart",
        `${systemName}.jpg`
      ),
    };

    // Converter para caminhos relativos que funcionarão no frontend
    const systemMediaPaths = {};

    // Verificar quais arquivos realmente existem
    Object.keys(themePaths).forEach((key) => {
      if (fs.existsSync(themePaths[key])) {
        // Converter para caminho relativo para a aplicação
        systemMediaPaths[key] = path
          .relative(rootDir, themePaths[key])
          .replace(/\\/g, "/");
      }
    });

    return systemMediaPaths;
  } catch (error) {
    console.error(`Erro ao ler tema para sistema ${systemName}:`, error);
    return { error: error.message };
  }
});

// Handler para obter lista de temas disponíveis
ipcMain.handle("get-available-themes", async () => {
  try {
    // Estratégia para localizar os temas, em ordem de prioridade:
    // 1. resources/themes (em produção)
    // 2. ./themes no diretório raiz do EmulationStation
    // 3. ./themes no diretório do projeto
    let themesBasePath;

    if (isProduction && process.resourcesPath) {
      themesBasePath = path.join(process.resourcesPath, "themes");
      if (!fs.existsSync(themesBasePath)) {
        themesBasePath = null;
      }
    }

    if (!themesBasePath) {
      themesBasePath = path.join(emulationStationRootDir, "themes");
      if (!fs.existsSync(themesBasePath)) {
        themesBasePath = path.join(rootDir, "themes");
      }
    }

    if (!fs.existsSync(themesBasePath)) {
      console.warn(`Diretório de temas não encontrado: ${themesBasePath}`);
      return ["default"];
    }

    const themes = fs.readdirSync(themesBasePath).filter((dir) => {
      // Verificar se é um diretório e se contém um arquivo theme.xml
      const dirPath = path.join(themesBasePath, dir);
      const themeFile = path.join(dirPath, "theme.xml");
      return fs.statSync(dirPath).isDirectory() && fs.existsSync(themeFile);
    });

    return themes.length > 0 ? themes : ["default"];
  } catch (error) {
    console.error("Erro ao obter temas disponíveis:", error);
    return ["default"];
  }
});

// Função para resolver caminhos relativos
ipcMain.handle("resolve-image-path", (event, romPath, imagePath) => {
  return path.resolve(romPath, imagePath);
});

// Handler para salvar configurações
ipcMain.handle("save-settings", async (event, settings) => {
  try {
    const settingsPath = path.join(rootDir, "riescade_settings.json");

    // Caminhos recebidos do frontend
    if (settings.paths) {
      // Atualize os caminhos sem criar diretórios
      Object.keys(settings.paths).forEach((dirType) => {
        if (dirType === "emulationstation") {
          // O diretório selecionado é o emulationstation/
          PATHS.EMULATIONSTATION = settings.paths[dirType];
          // O diretório raiz é um nível acima
          PATHS.EMULATIONSTATION_ROOT = path.dirname(settings.paths[dirType]);
          // O diretório de configuração é emulationstation/.emulationstation
          PATHS.EMULATIONSTATION_CONFIG = path.join(
            settings.paths[dirType],
            ".emulationstation"
          );
        } else if (dirType === "roms") {
          PATHS.ROMS = settings.paths[dirType];
        } else if (dirType === "emulators") {
          PATHS.EMULATORS = settings.paths[dirType];
        }
      });
    }

    // Salvar configurações no arquivo
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    // Aplicar configurações
    if (settings.fullscreen !== undefined && mainWindow) {
      mainWindow.setFullScreen(settings.fullscreen);
    }

    return { success: true };
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    return { success: false, error: error.message };
  }
});

// Handler para obter configurações
ipcMain.handle("get-settings", async () => {
  try {
    const settingsPath = path.join(rootDir, "riescade_settings.json");

    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, "utf8");
      const settings = JSON.parse(settingsData);

      // Se não houver caminhos definidos, preencher com os padrões
      if (!settings.paths) {
        settings.paths = {
          roms: PATHS.ROMS,
          emulationstation: PATHS.EMULATIONSTATION,
          emulators: PATHS.EMULATORS,
        };
      }

      return settings;
    } else {
      // Retornar configurações padrão
      return {
        paths: {
          roms: PATHS.ROMS,
          emulationstation: PATHS.EMULATIONSTATION,
          emulators: PATHS.EMULATORS,
        },
        fullscreen: false,
        theme: "default",
      };
    }
  } catch (error) {
    console.error("Erro ao obter configurações:", error);
    return null;
  }
});

// Handler para selecionar diretório
ipcMain.handle("browse-directory", async (event, dirType) => {
  try {
    const options = {
      properties: ["openDirectory"],
    };

    // Título diferente para cada tipo de diretório
    switch (dirType) {
      case "roms":
        options.title = "Selecione o diretório de ROMs";
        break;
      case "emulationstation":
        options.title = "Selecione o diretório do EmulationStation";
        break;
      case "emulators":
        options.title = "Selecione o diretório de Emuladores";
        break;
      default:
        options.title = "Selecione um diretório";
    }

    const result = await dialog.showOpenDialog(mainWindow, options);

    if (!result.canceled && result.filePaths.length > 0) {
      return { path: result.filePaths[0] };
    }

    return { canceled: true };
  } catch (error) {
    console.error("Erro ao selecionar diretório:", error);
    return { error: error.message };
  }
});

ipcMain.handle("read-file", async (event, filePath, isExternal = false) => {
  try {
    console.log(
      `Handler read-file chamado com caminho: ${filePath}, isExternal: ${isExternal}`
    );

    // Determine o caminho completo com base em se é um tema externo
    let fullPath;
    if (isExternal) {
      // Para temas externos
      const themesDir = isProduction
        ? path.join(app.getPath("userData"), "themes")
        : path.join(rootDir, "themes");
      fullPath = path.join(
        themesDir,
        filePath.replace("riescade://external-themes/", "")
      );
    } else {
      // Para arquivos internos relativos ao diretório do projeto
      fullPath = path.join(rootDir, filePath);
    }

    console.log(`Lendo arquivo de: ${fullPath}`);

    // Verificar se o arquivo existe
    if (!fs.existsSync(fullPath)) {
      console.error(`Arquivo não encontrado: ${fullPath}`);
      return null;
    }

    // Ler o arquivo de forma síncrona já que estamos em um ambiente Node.js
    const content = fs.readFileSync(fullPath, "utf8");
    return content;
  } catch (error) {
    console.error("Erro ao ler arquivo:", error);
    return null;
  }
});

// Função auxiliar para obter o diretório de temas
function getThemesDirectory() {
  if (isProduction) {
    // Em produção, usamos o diretório de dados do usuário
    return path.join(app.getPath("userData"), "themes");
  } else {
    // Em desenvolvimento, procuramos em várias localizações
    const possiblePaths = [
      path.join(rootDir, "themes"),
      path.join(__dirname, "themes"),
      path.join(process.cwd(), "themes"),
      path.join(path.dirname(process.cwd()), "themes"),
    ];

    for (const themePath of possiblePaths) {
      if (fs.existsSync(themePath)) {
        return themePath;
      }
    }

    // Se nenhum diretório for encontrado, usamos o diretório do projeto
    return path.join(rootDir, "themes");
  }
}

// Função para garantir que o diretório de temas exista
async function ensureThemesDirectory() {
  const themesDir = getThemesDirectory();
  if (!fs.existsSync(themesDir)) {
    try {
      fs.mkdirSync(themesDir, { recursive: true });
    } catch (error) {
      console.error("Erro ao criar diretório de temas:", error);
    }
  }
  return themesDir;
}

// Handler para obter temas internos (embutidos no aplicativo)
ipcMain.handle("get-internal-themes", async () => {
  try {
    // Os temas internos podem estar em vários locais
    const possiblePaths = [
      path.join(process.resourcesPath, "themes"),
      path.join(__dirname, "themes"),
      path.join(rootDir, "themes"),
      path.join(process.cwd(), "themes"),
    ];

    let themesPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        themesPath = p;
        break;
      }
    }

    if (!themesPath) {
      console.warn("Nenhum diretório de temas internos encontrado");
      return ["default"];
    }

    const themes = fs.readdirSync(themesPath).filter((dir) => {
      // Verificar se é um diretório
      const dirPath = path.join(themesPath, dir);
      return fs.statSync(dirPath).isDirectory();
    });

    return themes.length > 0 ? themes : ["default"];
  } catch (error) {
    console.error("Erro ao obter temas internos:", error);
    return ["default"];
  }
});

// Handler para obter temas externos (instalados pelo usuário)
ipcMain.handle("get-external-themes", async () => {
  try {
    const themesDir = await ensureThemesDirectory();

    if (!fs.existsSync(themesDir)) {
      console.warn("Diretório de temas externos não existe:", themesDir);
      return [];
    }

    const themes = fs.readdirSync(themesDir).filter((dir) => {
      // Verificar se é um diretório
      const dirPath = path.join(themesDir, dir);
      return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
    });

    return themes;
  } catch (error) {
    console.error("Erro ao obter temas externos:", error);
    return [];
  }
});

// Handler para verificar se um tema externo existe
ipcMain.handle("check-external-theme", async (event, themeName) => {
  try {
    const themesDir = getThemesDirectory();
    const themePath = path.join(themesDir, themeName);
    return fs.existsSync(themePath) && fs.statSync(themePath).isDirectory();
  } catch (error) {
    console.error("Erro ao verificar tema externo:", error);
    return false;
  }
});

// Handler para obter configuração do tema
ipcMain.handle(
  "get-theme-config",
  async (event, themeName, isExternal = false) => {
    try {
      let themePath;

      if (isExternal) {
        // Tema externo está no diretório de temas do usuário
        themePath = path.join(getThemesDirectory(), themeName);
      } else {
        // Tema interno pode estar em vários locais possíveis
        const possiblePaths = [
          path.join(process.resourcesPath, "themes", themeName),
          path.join(__dirname, "themes", themeName),
          path.join(rootDir, "themes", themeName),
          path.join(process.cwd(), "themes", themeName),
        ];

        themePath = null;
        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            themePath = p;
            break;
          }
        }

        if (!themePath) {
          throw new Error(`Tema interno '${themeName}' não encontrado`);
        }
      }

      // Verificar se o diretório existe
      if (!fs.existsSync(themePath)) {
        throw new Error(`Diretório do tema '${themeName}' não encontrado`);
      }

      // Verificar ambos JSON e XML para configuração
      const jsonPath = path.join(themePath, "theme.json");
      const xmlPath = path.join(themePath, "theme.xml");

      let config = {};

      // Tentar JSON primeiro
      if (fs.existsSync(jsonPath)) {
        const jsonData = fs.readFileSync(jsonPath, "utf8");
        config = JSON.parse(jsonData);
      }
      // Depois tentar XML
      else if (fs.existsSync(xmlPath)) {
        const xmlData = fs.readFileSync(xmlPath, "utf8");
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "_",
          textNodeName: "value",
        });
        config = parser.parse(xmlData);
      } else {
        // Se nenhum arquivo de configuração for encontrado, criar um padrão
        config = {
          theme: {
            name: themeName,
            primaryColor: "#1a88ff",
            backgroundColor: "#121212",
            textColor: "#ffffff",
            cardColor: "#1e1e1e",
          },
        };
      }

      return config;
    } catch (error) {
      console.error(`Erro ao ler configuração do tema ${themeName}:`, error);
      // Retornar configuração padrão em caso de erro
      return {
        theme: {
          name: themeName || "default",
          primaryColor: "#1a88ff",
          backgroundColor: "#121212",
          textColor: "#ffffff",
          cardColor: "#1e1e1e",
        },
      };
    }
  }
);

// Handler para recarregar o aplicativo
ipcMain.handle("reload-app", () => {
  if (mainWindow) {
    mainWindow.reload();
  }
});

// Exportar os caminhos para que outros módulos possam acessá-los
module.exports = { PATHS };
