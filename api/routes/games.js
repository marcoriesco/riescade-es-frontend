/**
 * Rotas da API para jogos do EmulationStation
 */
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const { execFile } = require("child_process");
const configService = require("../services/configService");
const fileScanner = require("../utils/fileScanner");

const router = express.Router();

/**
 * GET /api/games
 * Retorna todos os jogos de todas as plataformas
 */
router.get("/", (req, res) => {
  const systems = configService.getSystems();
  const paths = configService.getPaths();

  if (!paths.romsDir) {
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  // Resultado
  const allGames = [];

  // Para cada sistema, escanear ROMs
  for (const system of systems) {
    const games = fileScanner.scanRoms(system, paths.romsDir);

    // Adicionar informação do sistema aos jogos
    games.forEach((game) => {
      game.platform = {
        id: system.id,
        name: system.fullName || system.name,
        shortName: system.name,
      };
    });

    allGames.push(...games);
  }

  res.json({
    success: true,
    data: allGames,
  });
});

/**
 * GET /api/games/:id
 * Retorna um jogo específico
 */
router.get("/:id", (req, res) => {
  console.log(`Requisição recebida para o jogo ${req.params.id}`);

  const gameId = req.params.id;
  const systems = configService.getSystems();
  const paths = configService.getPaths();

  // Extrair o ID do sistema a partir do ID do jogo (formato: sistema-índice ou sistema-gamelistId)
  const systemId = gameId.split("-")[0];
  console.log(`Sistema inferido a partir do ID do jogo: ${systemId}`);

  // Extrair o ID específico do jogo (parte após o primeiro hífen)
  const specificId = gameId.substring(systemId.length + 1);
  console.log(`ID específico do jogo: ${specificId}`);

  // Encontrar o sistema pelo ID
  const system = systems.find((s) => s.id === systemId);
  if (!system) {
    console.log(`Sistema ${systemId} não encontrado`);
    return res.status(404).json({
      success: false,
      message: "Sistema não encontrado",
    });
  }

  // Verificar se temos o diretório de ROMs
  if (!paths.romsDir) {
    console.log("Diretório de ROMs não encontrado");
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  // Determinar o diretório de ROMs para o sistema
  const platformRomsDir = path.join(paths.romsDir, system.id);
  console.log(`Diretório de ROMs para ${system.name}: ${platformRomsDir}`);

  // Verificar se o diretório existe
  if (!fs.existsSync(platformRomsDir)) {
    console.log(
      `Diretório de ROMs para ${system.name} não encontrado: ${platformRomsDir}`
    );
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  // Primeiro, tentar ler a gamelist.xml diretamente
  const gamelistPath = path.join(platformRomsDir, "gamelist.xml");
  console.log(`Tentando ler gamelist.xml em: ${gamelistPath}`);

  if (fs.existsSync(gamelistPath)) {
    try {
      // Ler e parsear o arquivo XML
      console.log("gamelist.xml encontrada, lendo conteúdo...");
      const xmlContent = fs.readFileSync(gamelistPath, "utf8");

      // Usar o XMLParser diretamente
      const { XMLParser } = require("fast-xml-parser");
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
      });

      const parsedXml = parser.parse(xmlContent);
      console.log("XML parseado com sucesso");

      if (parsedXml.gameList && parsedXml.gameList.game) {
        // Converter para array, caso seja um único jogo
        const games = Array.isArray(parsedXml.gameList.game)
          ? parsedXml.gameList.game
          : [parsedXml.gameList.game];

        console.log(`${games.length} jogos encontrados na gamelist.xml`);

        // Buscar o jogo pelo ID específico da gamelist
        let foundGame = null;

        // Primeiro, registramos todos os métodos que usaremos para identificar o jogo
        console.log(
          `Iniciando busca pelo jogo com ID específico: ${specificId} usando múltiplas estratégias`
        );

        // Método 1: Buscar pelo atributo ID na gamelist (se houver)
        if (/^\d+$/.test(specificId)) {
          // Procurar pelo atributo id na gamelist
          console.log(
            `Estratégia 1: Procurando jogo com ID ${specificId} na gamelist...`
          );
          foundGame = games.find(
            (game) => game["@_id"] && game["@_id"].toString() === specificId
          );

          if (foundGame) {
            console.log(
              `Jogo encontrado pelo atributo ID: ${
                foundGame.name || "sem nome"
              }`
            );
          }
        }

        // Método 2: Se não encontrou pelo ID, procurar pelo caminho do arquivo/nome
        if (!foundGame) {
          console.log(
            `Estratégia 2: Comparando pelo caminho e nome do arquivo...`
          );

          // Extrair o nome do arquivo sem extensão do specificId
          // (caso o specificId seja um nome de arquivo)
          const possibleFilename = specificId.includes(".")
            ? specificId.substring(0, specificId.lastIndexOf("."))
            : specificId;

          foundGame = games.find((game) => {
            if (!game.path) return false;

            // Extrair nome do arquivo do caminho
            const gamePath = game.path;
            const filename = path.basename(gamePath);
            const filenameNoExt = path.basename(
              filename,
              path.extname(filename)
            );

            // Verificar se o nome do arquivo corresponde ao specificId
            return (
              filenameNoExt === possibleFilename || filename === specificId
            );
          });

          if (foundGame) {
            console.log(
              `Jogo encontrado pela correspondência de nome de arquivo: ${
                foundGame.name || path.basename(foundGame.path)
              }`
            );
          }
        }

        // Método 3: Se ainda não encontrou, e o specificId é um número, tentar pelo índice
        if (!foundGame && /^\d+$/.test(specificId)) {
          console.log(
            `Estratégia 3: Tentando encontrar pelo índice ${specificId}...`
          );
          const index = parseInt(specificId);
          if (!isNaN(index) && index >= 0 && index < games.length) {
            foundGame = games[index];
            console.log(
              `Jogo encontrado pelo índice ${index}: ${
                foundGame.name || "sem nome"
              }`
            );
          }
        }

        // Método 4: Se ainda não encontrou e temos um formato de ID específico para arquivo
        if (!foundGame && specificId.startsWith("file-")) {
          // Formato sistema-file-X, precisa procurar pelos arquivos
          console.log(`Formato de ID file-X detectado: ${specificId}`);

          // Verificar os arquivos no diretório
          const files = fs
            .readdirSync(platformRomsDir)
            .filter(
              (f) =>
                !f.includes("gamelist.xml") &&
                !fs.statSync(path.join(platformRomsDir, f)).isDirectory()
            );

          // Extrair o índice do arquivo
          const fileIndex = parseInt(specificId.split("-")[1]);
          if (!isNaN(fileIndex) && fileIndex >= 0 && fileIndex < files.length) {
            const file = files[fileIndex];
            const filePath = path.join(platformRomsDir, file);
            const fileName = path.basename(file, path.extname(file));

            // Criar um objeto de jogo simples
            return res.json({
              success: true,
              data: {
                id: gameId,
                name: fileName,
                path: filePath,
                desc: `${fileName} para ${system.fullName || system.name}`,
                extension: path.extname(file).substring(1),
                platform: {
                  id: system.id,
                  name: system.fullName || system.name,
                  shortName: system.name,
                },
              },
            });
          }
        }

        // Se encontrou o jogo, processar e retornar
        if (foundGame) {
          console.log(
            `Jogo encontrado na gamelist: ${foundGame.name || "sem nome"}`
          );

          // Processar caminhos de mídia
          const processPath = (mediaPath) => {
            if (!mediaPath) return "";

            // Se já é uma URL, manter como está
            if (
              mediaPath.startsWith("http://") ||
              mediaPath.startsWith("https://")
            ) {
              return mediaPath;
            }

            // Converter caminho absoluto para URL
            if (path.isAbsolute(mediaPath)) {
              // Extrair a parte após romsDir
              const romsDir = paths.romsDir;
              if (mediaPath.startsWith(romsDir)) {
                const relativePath = mediaPath
                  .substring(romsDir.length + 1)
                  .replace(/\\/g, "/");
                return `/roms-media/${relativePath}`;
              }
              return mediaPath;
            }

            // Processar caminho relativo
            // Remover o ./ do início se existir
            const normalizedPath = mediaPath.startsWith("./")
              ? mediaPath.substring(2)
              : mediaPath;

            // Criar URL relativa ao diretório do sistema
            return `/roms-media/${system.id}/${normalizedPath.replace(
              /\\/g,
              "/"
            )}`;
          };

          // Extrair o nome do arquivo da ROM do caminho
          const gamePath = foundGame.path || "";
          const romFilename = path.basename(gamePath);

          // Criar o objeto do jogo com todos os dados da gamelist
          const gameData = {
            id: gameId,
            name:
              foundGame.name ||
              path.basename(romFilename, path.extname(romFilename)),
            path: path.join(platformRomsDir, romFilename),
            desc:
              foundGame.desc || `Jogo para ${system.fullName || system.name}`,
            image: processPath(foundGame.image),
            thumbnail: processPath(foundGame.thumbnail),
            video: processPath(foundGame.video),
            marquee: processPath(foundGame.marquee),
            fanart: processPath(foundGame.fanart),
            rating: parseFloat(foundGame.rating) || 0,
            releaseDate: foundGame.releasedate,
            developer: foundGame.developer || "",
            publisher: foundGame.publisher || "",
            genre: foundGame.genre || "",
            players: foundGame.players || "",
            family: foundGame.family || "",
            arcadeSystemName: foundGame.arcadesystemname || "",
            region: foundGame.region || "",
            lang: foundGame.lang || "",
            extension: path.extname(romFilename).substring(1),
            favorite:
              foundGame.favorite === "true" || foundGame.favorite === true,
            platform: {
              id: system.id,
              name: system.fullName || system.name,
              shortName: system.name,
            },
          };

          return res.json({
            success: true,
            data: gameData,
            source: "gamelist.xml",
          });
        } else {
          console.log(
            `Jogo com ID ${specificId} não encontrado na gamelist.xml`
          );
        }
      }
    } catch (err) {
      console.error("Erro ao processar gamelist.xml:", err);
    }
  }

  // Se chegamos aqui, não encontramos o jogo na gamelist, tentar o método tradicional
  try {
    console.log("Tentando método tradicional de escaneamento...");
    // Escanear ROMs para o sistema
    const games = fileScanner.scanRoms(system, paths.romsDir);
    console.log(`${games.length} jogos encontrados para ${system.name}`);

    // Encontrar o jogo pelo ID
    const foundGame = games.find((game) => game.id === gameId);

    if (!foundGame) {
      console.log(
        `Jogo ${gameId} não encontrado entre os ${games.length} jogos escaneados`
      );

      // Se não encontrou, tentar escanear diretamente o diretório
      if (fs.existsSync(platformRomsDir)) {
        console.log(
          `Tentando alternativa: escaneando diretamente o diretório ${platformRomsDir}`
        );

        // Verificar se o sistema tem extensões definidas
        if (!system.extension || system.extension.length === 0) {
          system.extension = [".zip", ".7z", ".rom"]; // Extensões padrão
        }

        // Normalizar extensões
        const supportedExtensions = system.extension.map((ext) =>
          ext.startsWith(".") ? ext.toLowerCase() : "." + ext.toLowerCase()
        );

        // Listar arquivos no diretório
        const files = fs.readdirSync(platformRomsDir);

        // Filtrar pelos arquivos com extensões suportadas
        const validFiles = files.filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return supportedExtensions.includes(ext);
        });

        console.log(`${validFiles.length} arquivos válidos encontrados`);

        // Tentar encontrar o jogo pelo índice no ID (formato: sistema-índice)
        const parts = gameId.split("-");
        if (parts.length > 1) {
          const index = parseInt(parts[1]);
          if (!isNaN(index) && index >= 0 && index < validFiles.length) {
            const file = validFiles[index];
            const filePath = path.join(platformRomsDir, file);
            const fileName = path.basename(file, path.extname(file));

            console.log(`Encontrado jogo pelo índice ${index}: ${fileName}`);

            // Criar objeto do jogo
            const game = {
              id: gameId,
              name: fileName,
              path: filePath,
              filename: file,
              extension: path.extname(file).substring(1),
              desc: `${fileName} para ${system.fullName || system.name}`,
              platform: {
                id: system.id,
                name: system.fullName || system.name,
                shortName: system.name,
              },
            };

            return res.json({
              success: true,
              data: game,
            });
          }
        }
      }

      return res.status(404).json({
        success: false,
        message: "Jogo não encontrado",
      });
    }

    // Adicionar informação do sistema ao jogo
    foundGame.platform = {
      id: system.id,
      name: system.fullName || system.name,
      shortName: system.name,
    };

    console.log(`Jogo encontrado: ${foundGame.name}`);
    res.json({
      success: true,
      data: foundGame,
    });
  } catch (err) {
    console.error(`Erro ao buscar detalhes do jogo ${gameId}:`, err);
    res.status(500).json({
      success: false,
      message: `Erro ao buscar detalhes do jogo: ${err.message}`,
    });
  }
});

/**
 * GET /api/games/:id/media/:mediaType
 * Retorna a mídia de um jogo específico (imagem, thumbnail, vídeo, etc)
 */
router.get("/:id/media/:mediaType", (req, res) => {
  console.log(
    `Requisição para mídia ${req.params.mediaType} do jogo ${req.params.id}`
  );

  const gameId = req.params.id;
  const mediaType = req.params.mediaType;

  // Extrair o ID do sistema a partir do ID do jogo (formato: sistema-índice)
  const systemId = gameId.split("-")[0];
  console.log(`Sistema inferido a partir do ID do jogo: ${systemId}`);

  // Carregar os sistemas
  const systems = configService.getSystems();
  const paths = configService.getPaths();
  const system = systems.find((s) => s.id === systemId);

  if (!system) {
    console.log(`Sistema ${systemId} não encontrado`);
    return res.status(404).json({
      success: false,
      message: `Sistema ${systemId} não encontrado`,
    });
  }

  if (!paths.romsDir) {
    console.log("Diretório de ROMs não encontrado");
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  try {
    // Obter os jogos do sistema
    const games = fileScanner.scanRoms(system, paths.romsDir);
    console.log(`Encontrados ${games.length} jogos para ${system.name}`);

    // Procurar o jogo pelo ID
    const game = games.find((g) => g.id === gameId);

    if (!game) {
      console.log(`Jogo ${gameId} não encontrado`);

      // Retornar um placeholder para jogos não encontrados
      const placeholderPath = path.join(
        __dirname,
        "../../themes/default/img/placeholder.png"
      );
      if (fs.existsSync(placeholderPath)) {
        console.log(
          `Retornando imagem placeholder para jogo não encontrado: ${gameId}`
        );
        return res.sendFile(placeholderPath);
      }

      return res.status(404).json({
        success: false,
        message: "Jogo não encontrado",
      });
    }

    // Verificar o tipo de mídia solicitado
    let mediaPath = null;

    switch (mediaType) {
      case "image":
        mediaPath = game.image;
        break;
      case "thumbnail":
        mediaPath = game.thumbnail;
        break;
      case "video":
        mediaPath = game.video;
        break;
      case "marquee":
        mediaPath = game.marquee;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: `Tipo de mídia desconhecido: ${mediaType}`,
        });
    }

    // Verificar se a mídia existe
    if (mediaPath && fs.existsSync(mediaPath)) {
      console.log(
        `Enviando ${mediaType} para o jogo ${game.name}: ${mediaPath}`
      );
      return res.sendFile(mediaPath);
    }

    // Se a mídia não existir diretamente, tentar encontrar na estrutura padrão de pastas
    if (mediaType === "image" || mediaType === "thumbnail") {
      // Tentar encontrar em caminhos padrão como images/<game>.png
      const platformDir = path.join(paths.romsDir, system.id);
      const possibleImagePaths = [
        path.join(platformDir, "images", `${game.name}.png`),
        path.join(platformDir, "images", `${game.name}.jpg`),
        path.join(platformDir, "boxart", `${game.name}.png`),
        path.join(platformDir, "boxart", `${game.name}.jpg`),
        path.join(platformDir, "screenshots", `${game.name}.png`),
        path.join(platformDir, "screenshots", `${game.name}.jpg`),
      ];

      console.log(
        `Tentando encontrar imagens alternativas para ${game.name}...`
      );

      for (const imgPath of possibleImagePaths) {
        if (fs.existsSync(imgPath)) {
          console.log(`Imagem alternativa encontrada: ${imgPath}`);
          return res.sendFile(imgPath);
        }
      }
    }

    // Se não encontrou imagem específica, procurar por uma imagem genérica para o sistema
    const systemLogoPath = path.join(
      __dirname,
      "../../themes/default/img/logos",
      `${system.id}.png`
    );
    if (fs.existsSync(systemLogoPath)) {
      console.log(
        `Enviando logo do sistema para ${game.name}: ${systemLogoPath}`
      );
      return res.sendFile(systemLogoPath);
    }

    // Se não encontrou mídia específica, retornar o placeholder
    const placeholderPath = path.join(
      __dirname,
      "../../themes/default/img/placeholder.png"
    );
    if (fs.existsSync(placeholderPath)) {
      console.log(
        `Retornando imagem placeholder para ${mediaType} do jogo ${game.name}`
      );
      return res.sendFile(placeholderPath);
    }

    // Se nem o placeholder existir, retornar 404
    res.status(404).json({
      success: false,
      message: `Mídia ${mediaType} não encontrada para o jogo ${gameId}`,
    });
  } catch (err) {
    console.error(`Erro ao buscar mídia para o jogo ${gameId}:`, err);
    res.status(500).json({
      success: false,
      message: `Erro ao buscar mídia: ${err.message}`,
    });
  }
});

/**
 * POST /api/games/:id/launch
 * Lança um jogo
 */
router.post("/:id/launch", (req, res) => {
  console.log(`Requisição para lançar o jogo ${req.params.id} recebida`);

  const gameId = req.params.id;
  const emulator = req.body.emulator; // Opcional: emulador específico
  const core = req.body.core; // Opcional: core específico
  const systems = configService.getSystems();
  const paths = configService.getPaths();

  if (!paths.romsDir) {
    console.log("Diretório de ROMs não encontrado");
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  // Extrair o ID do sistema a partir do ID do jogo (formato: sistema-índice)
  const systemId = gameId.split("-")[0];
  console.log(`Sistema inferido: ${systemId}`);

  // Encontrar o sistema pelo ID
  const system = systems.find((s) => s.id === systemId);
  if (!system) {
    console.log(`Sistema ${systemId} não encontrado`);
    return res.status(404).json({
      success: false,
      message: "Sistema não encontrado",
    });
  }

  // Processar a solicitação de lançamento
  try {
    // Primeiro, tentar encontrar o jogo pelo ID usando a mesma lógica da rota GET /:id
    const platformRomsDir = path.join(paths.romsDir, system.id);
    console.log(`Diretório de ROMs: ${platformRomsDir}`);

    // Verificar se o diretório existe
    if (!fs.existsSync(platformRomsDir)) {
      console.log(`Diretório de ROMs não encontrado: ${platformRomsDir}`);
      return res.status(404).json({
        success: false,
        message: "Diretório de ROMs não encontrado",
      });
    }

    // Variável para armazenar o caminho do ROM
    let romPath = null;
    let foundGameName = null;

    // Tentar ler a gamelist.xml se existir
    const gamelistPath = path.join(platformRomsDir, "gamelist.xml");
    if (fs.existsSync(gamelistPath)) {
      try {
        console.log("Lendo gamelist.xml...");
        const xmlContent = fs.readFileSync(gamelistPath, "utf8");

        // Usar o XMLParser
        const { XMLParser } = require("fast-xml-parser");
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
        });

        const parsedXml = parser.parse(xmlContent);

        if (parsedXml.gameList && parsedXml.gameList.game) {
          // Converter para array, caso seja um único jogo
          const games = Array.isArray(parsedXml.gameList.game)
            ? parsedXml.gameList.game
            : [parsedXml.gameList.game];

          console.log(`${games.length} jogos encontrados na gamelist.xml`);

          // Extrair o ID específico (parte após o hífen no gameId)
          const specificId = gameId.substring(systemId.length + 1);
          console.log(`Procurando jogo com ID específico: ${specificId}`);

          // Procurar o jogo na gamelist usando múltiplas estratégias
          let foundGame = null;

          // 1. Procurar pelo atributo ID
          if (/^\d+$/.test(specificId)) {
            console.log("Procurando pelo atributo ID...");
            foundGame = games.find(
              (game) => game["@_id"] && game["@_id"].toString() === specificId
            );
          }

          // 2. Procurar pelo nome do arquivo
          if (!foundGame) {
            console.log("Procurando pelo nome do arquivo...");
            foundGame = games.find((game) => {
              if (!game.path) return false;

              const gamePath = game.path;
              const filename = path.basename(gamePath);
              const filenameNoExt = path.basename(
                filename,
                path.extname(filename)
              );

              return filenameNoExt === specificId || filename === specificId;
            });
          }

          // 3. Procurar pelo índice
          if (!foundGame && /^\d+$/.test(specificId)) {
            console.log("Procurando pelo índice...");
            const index = parseInt(specificId);
            if (!isNaN(index) && index >= 0 && index < games.length) {
              foundGame = games[index];
            }
          }

          // Se encontrou o jogo na gamelist, usar seu caminho
          if (foundGame) {
            console.log(
              `Jogo encontrado na gamelist: ${foundGame.name || "sem nome"}`
            );

            // Normalmente, o caminho na gamelist é relativo ao diretório de ROMs
            const gamePath = foundGame.path || "";

            // Se for um caminho absoluto, usar diretamente
            if (path.isAbsolute(gamePath)) {
              romPath = gamePath;
            } else {
              // Remover ./ do início se existir
              const normalizedPath = gamePath.startsWith("./")
                ? gamePath.substring(2)
                : gamePath;

              romPath = path.join(platformRomsDir, normalizedPath);
            }

            foundGameName = foundGame.name || path.basename(romPath);
          }
        }
      } catch (err) {
        console.error("Erro ao processar gamelist.xml:", err);
      }
    }

    // Se não encontrou o jogo na gamelist, tentar o escaneamento tradicional
    if (!romPath) {
      console.log("Tentando escaneamento tradicional...");
      const games = fileScanner.scanRoms(system, paths.romsDir);
      const foundGame = games.find((game) => game.id === gameId);

      if (foundGame) {
        console.log(`Jogo encontrado pelo scanner: ${foundGame.name}`);
        romPath = foundGame.path;
        foundGameName = foundGame.name;
      } else {
        console.log("Jogo não encontrado pelo scanner");
        return res.status(404).json({
          success: false,
          message: "Jogo não encontrado",
        });
      }
    }

    // Verificar se temos um caminho de ROM válido
    if (!romPath) {
      console.log("Caminho da ROM não encontrado");
      return res.status(404).json({
        success: false,
        message: "ROM não encontrada",
      });
    }

    console.log(`Caminho da ROM: ${romPath}`);
    console.log(`Nome do jogo: ${foundGameName}`);

    // Construir comando para lançar o jogo
    let command = system.command;

    // Se um emulador específico foi solicitado
    if (emulator && system.emulators) {
      const selectedEmulator = system.emulators.find(
        (e) => e.name === emulator
      );

      if (selectedEmulator) {
        command = selectedEmulator.command;

        // Se um core específico foi solicitado
        if (core && selectedEmulator.cores) {
          const selectedCore = selectedEmulator.cores.find(
            (c) => c.name === core
          );

          if (selectedCore) {
            command = selectedCore.command;
          }
        }
      }
    }

    // Substituir variáveis no comando
    command = command
      .replace(/{rom}/gi, romPath)
      .replace(/{basename}/gi, path.basename(romPath, path.extname(romPath)))
      .replace(/{rom_raw}/gi, romPath.replace(/['"]/g, ""));

    console.log(`Comando de execução: ${command}`);

    // Dividir o comando em programa e argumentos
    const parts = command.split(" ");
    const program = parts[0];
    const args = parts.slice(1);

    // Lançar o jogo
    console.log(`Executando: ${program} ${args.join(" ")}`);
    execFile(program, args, (error, stdout, stderr) => {
      if (error) {
        console.error(`Erro na execução do jogo: ${error.message}`);
        // Mesmo com erro, consideramos como sucesso, pois o jogo pode ter sido lançado
      }

      if (stdout) console.log(`Saída padrão: ${stdout}`);
      if (stderr) console.log(`Erro padrão: ${stderr}`);
    });

    res.json({
      success: true,
      message: `Jogo "${foundGameName}" lançado com sucesso`,
      game: {
        name: foundGameName,
        path: romPath,
      },
    });
  } catch (err) {
    console.error(`Erro ao lançar jogo ${gameId}:`, err);

    res.status(500).json({
      success: false,
      message: `Erro ao lançar jogo: ${err.message || err}`,
    });
  }
});

/**
 * GET /api/games/debug/gamelist/:systemId
 * Rota de debug para ver o conteúdo bruto da gamelist.xml
 */
router.get("/debug/gamelist/:systemId", (req, res) => {
  const systemId = req.params.systemId;
  console.log(`Requisição de debug para gamelist do sistema ${systemId}`);

  const paths = configService.getPaths();

  if (!paths.romsDir) {
    return res.status(404).json({
      success: false,
      message: "Diretório de ROMs não encontrado",
    });
  }

  const gamelistPath = path.join(paths.romsDir, systemId, "gamelist.xml");
  console.log(`Procurando gamelist em: ${gamelistPath}`);

  if (!fs.existsSync(gamelistPath)) {
    return res.status(404).json({
      success: false,
      message: "Arquivo gamelist.xml não encontrado",
    });
  }

  try {
    // Ler o conteúdo bruto do arquivo
    const content = fs.readFileSync(gamelistPath, "utf8");

    // Tentar parsear o XML para verificar se é válido
    const { XMLParser } = require("fast-xml-parser");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });

    try {
      const parsedXml = parser.parse(content);
      console.log("Estrutura XML análisada com sucesso");

      // Retornar tanto o XML bruto quanto a versão parseada
      res.json({
        success: true,
        rawContentPreview: content.substring(0, 1000) + "...",
        parsedContent: parsedXml,
        gameCount:
          parsedXml.gameList && Array.isArray(parsedXml.gameList.game)
            ? parsedXml.gameList.game.length
            : parsedXml.gameList && parsedXml.gameList.game
            ? 1
            : 0,
      });
    } catch (parseErr) {
      console.error("Erro ao parsear XML:", parseErr);
      res.json({
        success: false,
        rawContent: content,
        error: `Erro ao parsear XML: ${parseErr.message}`,
      });
    }
  } catch (err) {
    console.error("Erro ao ler arquivo gamelist.xml:", err);
    res.status(500).json({
      success: false,
      message: `Erro ao ler arquivo: ${err.message}`,
    });
  }
});

module.exports = router;
