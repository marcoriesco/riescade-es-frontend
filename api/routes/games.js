/**
 * Rotas da API para jogos do EmulationStation
 */
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const { execFile, spawn } = require("child_process");
const configService = require("../services/configService");
const fileScanner = require("../utils/fileScanner");

const router = express.Router();

const runningGames = {};

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

        // Estratégia principal: buscar pelo atributo ID
        console.log(
          `Procurando jogo com ID específico: ${specificId} na gamelist...`
        );

        // Verificar se o ID específico é numérico
        if (/^\d+$/.test(specificId)) {
          // O ID é numérico, procurar diretamente pelo atributo ID
          foundGame = games.find(
            (game) => game["@_id"] && game["@_id"].toString() === specificId
          );

          if (foundGame) {
            console.log(
              `Jogo encontrado pelo atributo ID: ${
                foundGame.name || "sem nome"
              }`
            );
          } else {
            console.log(
              `Nenhum jogo encontrado com ID=${specificId}, recorrendo a métodos alternativos`
            );
          }
        } else {
          console.log(
            `ID específico '${specificId}' não é numérico, usando métodos alternativos`
          );
        }

        // Se não encontrou pelo ID, tentar métodos alternativos (só como fallback)
        if (!foundGame) {
          // Método alternativo: procurar pelo nome
          console.log(
            `Tentando encontrar jogo pelo nome ou caminho: ${specificId}`
          );

          foundGame = games.find((game) => {
            // Se tem nome, comparar
            if (game.name) {
              if (
                game.name === specificId ||
                game.name.toLowerCase() === specificId.toLowerCase()
              ) {
                return true;
              }
            }

            // Se tem path, comparar com o nome do arquivo
            if (game.path) {
              const filename = path.basename(game.path);
              const filenameNoExt = path.basename(
                filename,
                path.extname(filename)
              );

              if (filenameNoExt === specificId || filename === specificId) {
                return true;
              }
            }

            return false;
          });

          if (foundGame) {
            console.log(
              `Jogo encontrado por método alternativo: ${
                foundGame.name || path.basename(foundGame.path || "sem path")
              }`
            );
          } else {
            console.log(
              `Nenhum jogo encontrado para ${specificId} por nenhum método`
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
            thumbnail: processPath(
              getValidImagePath(
                foundGame.thumbnail,
                null, // sem fallback
                "/themes/default/img/placeholder.png"
              )
            ),
            marquee: processPath(
              getValidImagePath(
                foundGame.marquee,
                null, // sem fallback
                "/themes/default/img/placeholder.png"
              )
            ),
            video: processPath(foundGame.video),
            mix: processPath(
              getValidImagePath(
                foundGame.mix,
                null, // usar thumbnail como fallback para mix
                "/themes/default/img/placeholder.png"
              )
            ),
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
 * Função para enviar um arquivo como stream, com o tipo de conteúdo apropriado
 */
function sendFileAsStream(res, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Arquivo não encontrado: ${filePath}`);
    return false;
  }

  // Verificar o tipo de arquivo para definir o content-type
  const extname = path.extname(filePath).toLowerCase();
  const contentType =
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
    }[extname] || "application/octet-stream";

  console.log(`Enviando arquivo ${filePath} com content-type ${contentType}`);

  try {
    // Enviar o arquivo como uma stream
    const stream = fs.createReadStream(filePath);
    res.setHeader("Content-Type", contentType);

    stream.on("error", (error) => {
      console.error(`Erro na stream: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: `Erro ao ler arquivo: ${error.message}`,
        });
      }
    });

    stream.pipe(res);
    return true;
  } catch (error) {
    console.error(`Erro ao enviar arquivo: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: `Erro ao enviar arquivo: ${error.message}`,
      });
    }
    return false;
  }
}

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
        return sendFileAsStream(res, placeholderPath);
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
    if (mediaPath && mediaPath.startsWith("/roms-media/")) {
      // Já está no formato correto, redirecionar
      return res.redirect(301, mediaPath);
    } else if (
      mediaPath &&
      (mediaPath.startsWith("http://") || mediaPath.startsWith("https://"))
    ) {
      // URL externa, redirecionar
      return res.redirect(301, mediaPath);
    } else if (mediaPath) {
      // Caminho local, verificar se é absoluto
      const isAbsolute = path.isAbsolute(mediaPath);
      const absolutePath = isAbsolute
        ? mediaPath
        : path.join(paths.romsDir, system.id, mediaPath);

      console.log(`Tentando servir mídia de: ${absolutePath}`);

      if (fs.existsSync(absolutePath)) {
        return sendFileAsStream(res, absolutePath);
      }
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
          return sendFileAsStream(res, imgPath);
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
      return sendFileAsStream(res, systemLogoPath);
    }

    // Se não encontrou mídia específica, retornar o placeholder
    const placeholderPath = path.join(
      __dirname,
      "../../themes/default/img/placeholder.png"
    );
    if (fs.existsSync(placeholderPath)) {
      console.log(
        `Retornando imagem placeholder para jogo não encontrado: ${gameId}`
      );
      return sendFileAsStream(res, placeholderPath);
    }

    // Se nem o placeholder existir, retornar 404
    res.status(404).json({
      success: false,
      message: `Mídia ${mediaType} não encontrada para o jogo ${gameId}`,
    });
  } catch (err) {
    console.error(`Erro ao buscar mídia: ${err.message}`);
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
router.post("/:id/launch", async (req, res) => {
  try {
    const gameId = req.params.id;
    const { emulator, core } = req.body; // Opcional: emulador e core específicos

    console.log(`Requisição para lançar o jogo ${gameId} recebida`);
    console.log(`Emulador solicitado: ${emulator}, Core solicitado: ${core}`);

    // Extrair o ID do sistema a partir do ID do jogo (formato: sistema-índice)
    const systemId = gameId.split("-")[0];
    console.log(`Sistema inferido: ${systemId}`);

    // Obter sistemas e caminhos do configService
    const systems = configService.getSystems();
    const paths = configService.getPaths();

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

    // Variável para armazenar o caminho do ROM
    let romPath = null;
    let foundGameName = null;

    // Extrair o ID específico do jogo (parte após o primeiro hífen)
    const gameSpecificId = gameId.substring(systemId.length + 1);
    console.log(`ID específico do jogo: ${gameSpecificId}`);

    // Verificar se temos um ID específico
    if (!gameSpecificId) {
      console.log(`ID específico não encontrado no ID do jogo: ${gameId}`);
      return res.status(404).json({
        success: false,
        message: "ID do jogo inválido",
      });
    }

    // Estratégia 1: Tentar encontrar o jogo na gamelist.xml
    if (fs.existsSync(gamelistPath)) {
      try {
        console.log("Lendo gamelist.xml para encontrar o jogo...");
        const xmlContent = fs.readFileSync(gamelistPath, "utf8");

        // Usar o XMLParser para analisar o arquivo
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

          // Buscar o jogo pelo ID específico
          let foundGame = null;

          // Método prioritário: buscar pelo atributo ID na gamelist
          if (/^\d+$/.test(gameSpecificId)) {
            console.log(
              `Procurando jogo com ID ${gameSpecificId} na gamelist...`
            );
            foundGame = games.find(
              (game) =>
                game["@_id"] && game["@_id"].toString() === gameSpecificId
            );

            if (foundGame) {
              console.log(
                `Jogo encontrado pelo atributo ID: ${
                  foundGame.name || "sem nome"
                }`
              );
            } else {
              console.log(
                `Nenhum jogo encontrado com ID=${gameSpecificId}, recorrendo a métodos alternativos`
              );
            }
          } else {
            console.log(
              `ID específico '${gameSpecificId}' não é numérico, usando métodos alternativos`
            );
          }

          // Método alternativo (fallback): buscar pelo nome ou caminho
          if (!foundGame) {
            console.log(
              `Tentando encontrar jogo pelo nome ou caminho: ${gameSpecificId}`
            );

            foundGame = games.find((game) => {
              // Se tem nome, comparar
              if (game.name) {
                if (
                  game.name === gameSpecificId ||
                  game.name.toLowerCase() === gameSpecificId.toLowerCase()
                ) {
                  return true;
                }
              }

              // Se tem path, comparar com o nome do arquivo
              if (game.path) {
                const filename = path.basename(game.path);
                const filenameNoExt = path.basename(
                  filename,
                  path.extname(filename)
                );

                if (
                  filenameNoExt === gameSpecificId ||
                  filename === gameSpecificId
                ) {
                  return true;
                }
              }

              return false;
            });

            if (foundGame) {
              console.log(
                `Jogo encontrado por método alternativo: ${
                  foundGame.name || path.basename(foundGame.path || "sem path")
                }`
              );
            } else {
              console.log(
                `Nenhum jogo encontrado para ${gameSpecificId} por nenhum método`
              );
            }
          }

          // Se encontrou o jogo, usar seu caminho
          if (foundGame && foundGame.path) {
            foundGameName = foundGame.name || path.basename(foundGame.path);

            // Verificar se o caminho é absoluto ou relativo
            if (path.isAbsolute(foundGame.path)) {
              romPath = foundGame.path;
            } else {
              // Construir caminho completo
              romPath = path.join(platformRomsDir, foundGame.path);
            }

            console.log(`Caminho da ROM encontrado na gamelist: ${romPath}`);
          }
        }
      } catch (err) {
        console.error(`Erro ao ler gamelist.xml: ${err.message}`);
      }
    }

    // Estratégia 2: Se não encontrou na gamelist, procurar diretamente no diretório
    if (!romPath) {
      console.log(
        `Procurando ROM diretamente no diretório: ${platformRomsDir}`
      );

      try {
        // Listar todos os arquivos no diretório
        const files = fs.readdirSync(platformRomsDir);
        console.log(`${files.length} arquivos encontrados no diretório`);

        // Verificar extensões válidas para o sistema
        const validExtensions = system.extension || [".zip", ".7z"];
        console.log(`Extensões válidas: ${validExtensions.join(", ")}`);

        // Procurar por um arquivo que corresponda ao gameSpecificId
        const matchingFile = files.find((file) => {
          const fileNoExt = path.basename(file, path.extname(file));
          const fileExt = path.extname(file).toLowerCase();

          // Verificar se a extensão é válida
          const isValidExtension = validExtensions.some(
            (ext) => fileExt === ext || fileExt === ext.toLowerCase()
          );

          // Verificar se o nome do arquivo corresponde ao gameSpecificId
          return (
            isValidExtension &&
            (fileNoExt === gameSpecificId ||
              fileNoExt.toLowerCase() === gameSpecificId.toLowerCase() ||
              file === gameSpecificId)
          );
        });

        if (matchingFile) {
          romPath = path.join(platformRomsDir, matchingFile);
          foundGameName = path.basename(
            matchingFile,
            path.extname(matchingFile)
          );
          console.log(`ROM encontrada diretamente no diretório: ${romPath}`);
        }
      } catch (err) {
        console.error(`Erro ao listar arquivos no diretório: ${err.message}`);
      }
    }

    // Estratégia 3: Se o gameSpecificId parece ser um caminho de arquivo, usar diretamente
    if (
      !romPath &&
      (gameSpecificId.includes(".") || gameSpecificId.includes("/"))
    ) {
      console.log(
        `Tentando usar gameSpecificId como caminho direto: ${gameSpecificId}`
      );

      // Verificar se é um caminho absoluto
      if (path.isAbsolute(gameSpecificId)) {
        romPath = gameSpecificId;
      } else {
        // Construir caminho completo
        romPath = path.join(platformRomsDir, gameSpecificId);
      }

      foundGameName = path.basename(romPath, path.extname(romPath));
      console.log(`Usando gameSpecificId como caminho direto: ${romPath}`);
    }

    // Verificar se o arquivo ROM existe
    if (!fs.existsSync(romPath)) {
      console.log(`Arquivo ROM não encontrado: ${romPath}`);
      return res.status(404).json({
        success: false,
        message: "Arquivo ROM não encontrado",
      });
    }

    console.log(`Caminho da ROM: ${romPath}`);
    console.log(`Nome do jogo: ${foundGameName}`);

    // Preparar comando para o emulatorLauncher
    const args = [];

    // Determinar o emulador e core a serem usados
    let selectedEmulator = null;
    let selectedCore = null;

    console.log(`Verificando emuladores para o sistema ${system.id}`);
    console.log(
      `Emuladores disponíveis:`,
      JSON.stringify(system.emulators || [], null, 2)
    );

    // Verificar se o emulador foi especificado na requisição
    if (emulator) {
      selectedEmulator = emulator;
      console.log(
        `Usando emulador especificado na requisição: ${selectedEmulator}`
      );

      // Se um emulador específico foi solicitado, procurar pelo core correspondente
      if (core) {
        selectedCore = core;
        console.log(`Usando core especificado na requisição: ${selectedCore}`);
      } else if (system.emulators && system.emulators.length > 0) {
        // Procurar o emulador solicitado
        const emulatorObj = system.emulators.find((e) => e.name === emulator);
        if (emulatorObj && emulatorObj.cores && emulatorObj.cores.length > 0) {
          // Usar o primeiro core deste emulador
          selectedCore = emulatorObj.cores[0].name;
          console.log(
            `Usando o primeiro core (${selectedCore}) do emulador ${emulator}`
          );
        }
      }
    } else if (system.emulators && system.emulators.length > 0) {
      // Se nenhum emulador foi especificado, usar o primeiro com seu primeiro core
      selectedEmulator = system.emulators[0].name;
      console.log(`Usando o primeiro emulador disponível: ${selectedEmulator}`);

      // Verificar se o emulador tem cores
      if (system.emulators[0].cores && system.emulators[0].cores.length > 0) {
        // Verificar se há um core padrão
        const defaultCore = system.emulators[0].cores.find(
          (c) => c.default === true
        );

        if (defaultCore) {
          selectedCore = defaultCore.name;
          console.log(`Usando core padrão: ${selectedCore}`);
        } else {
          // Se não há core padrão, usar o primeiro
          selectedCore = system.emulators[0].cores[0].name;
          console.log(`Usando o primeiro core disponível: ${selectedCore}`);
        }
      } else {
        console.log(`O emulador ${selectedEmulator} não tem cores definidos`);
      }
    } else {
      console.log(`Sistema ${system.id} não tem emuladores definidos`);
    }

    // Adicionar parâmetros do sistema (essencial)
    args.push("-system", system.id);

    // Adicionar emulador aos argumentos, se disponível
    if (selectedEmulator) {
      args.push("-emulator", selectedEmulator);
      console.log(`Adicionando parâmetro -emulator ${selectedEmulator}`);
    }

    // Adicionar core aos argumentos, se disponível
    if (selectedCore) {
      args.push("-core", selectedCore);
      console.log(`Adicionando parâmetro -core ${selectedCore}`);
    }

    // Adicionar o caminho da ROM (essencial)
    // Usar o caminho absoluto da ROM
    console.log(`Caminho original da ROM: ${romPath}`);

    // Garantir que o caminho da ROM seja absoluto
    if (!path.isAbsolute(romPath)) {
      console.log(`Convertendo caminho relativo para absoluto: ${romPath}`);
      romPath = path.resolve(romPath);
    }

    // Remover qualquer referência a caminhos relativos como '..'
    if (romPath.includes("..")) {
      console.log(
        `Removendo referências a caminhos relativos '..' do caminho da ROM`
      );
      romPath = path.normalize(romPath);
    }

    console.log(`Caminho final da ROM: ${romPath}`);

    // Adicionar aspas ao caminho da ROM se ele não já estiver entre aspas
    if (!romPath.startsWith('"') && !romPath.endsWith('"')) {
      romPath = `"${romPath}"`;
      console.log(`Caminho da ROM com aspas: ${romPath}`);
    }

    // Adicionar o caminho do arquivo game.xml (completo)
    const romGameInfo = path.join("%TEMP%", "emulationstation.tmp", "game.xml");
    args.push("-gameinfo", `"${romGameInfo}"`);

    // Adicionar informações do controle (completas)
    args.push("-p1index", "0");
    args.push("-p1guid", "030000005e0400008e02000000007200"); // GUID padrão do controle Xbox 360
    args.push("-p1path", '"USB\\VID_045E&PID_028E&IG_00\\2&DEE0F28&0&00"');
    args.push("-p1name", '"Xbox 360 Controller"');
    args.push("-p1nbbuttons", "11");
    args.push("-p1nbhats", "1");
    args.push("-p1nbaxes", "6");

    // Adicionar o caminho da ROM (essencial)
    args.push("-rom", romPath);

    // Procurar pelo emulatorLauncher.exe
    const launcherPath = path.join(
      paths.rootDir,
      "emulationstation",
      "emulatorLauncher.exe"
    );

    if (!fs.existsSync(launcherPath)) {
      return res.status(500).json({
        success: false,
        message: "emulatorLauncher.exe não encontrado",
      });
    }

    // Criar string do comando completo para log
    // Montar o comando completo com todos os argumentos
    const fullCommand = `"${launcherPath}" ${args.join(" ")}`;

    console.log("==================================================");
    console.log("COMANDO COMPLETO /:ID/LAUNCH:");
    console.log("COMANDO COMPLETO:");
    console.log(fullCommand);
    console.log("==================================================");
    console.log("DETALHES:");
    console.log(`Executável: ${launcherPath}`);
    console.log(`Sistema: ${system.id}`);
    console.log(`Emulador: ${selectedEmulator}`);
    console.log(`Core: ${selectedCore}`);
    console.log(`ROM: ${romPath}`);
    console.log(`Argumentos completos: ${JSON.stringify(args, null, 2)}`);
    console.log("==================================================");

    // Executar o emulatorLauncher
    // Vamos usar spawn em vez de execFile para ter mais controle sobre os argumentos
    console.log(
      `Executando: "${launcherPath}" com argumentos: ${JSON.stringify(
        args,
        null,
        2
      )}`
    );

    // Encontrar o índice do argumento -rom
    const romIndex = args.indexOf("-rom");
    if (romIndex !== -1 && romIndex + 1 < args.length) {
      // Garantir que o caminho da ROM seja absoluto
      const romPath = args[romIndex + 1];
      console.log(`Caminho da ROM a ser usado: ${romPath}`);
    }

    const child = spawn(launcherPath, args, {
      shell: true, // Usar shell para lidar com aspas e caracteres especiais
      windowsVerbatimArguments: true, // Preservar aspas em argumentos no Windows
    });

    child.stdout.on("data", (data) => {
      console.log(`emulatorLauncher stdout: ${data}`);
    });

    child.stderr.on("data", (data) => {
      console.error(`emulatorLauncher stderr: ${data}`);
    });

    child.on("error", (error) => {
      console.error(`Erro ao executar emulatorLauncher: ${error.message}`);

      // Marcar o jogo como encerrado com erro
      runningGames[gameId] = {
        running: false,
        closedAt: new Date(),
        exitCode: -1,
        error: error.message,
      };

      return res.status(500).json({
        success: false,
        message: `Erro ao executar emulatorLauncher: ${error.message}`,
      });
    });

    child.on("close", (code) => {
      console.log(`emulatorLauncher encerrado com código: ${code}`);

      // Marcar o jogo como encerrado
      runningGames[gameId] = {
        running: false,
        closedAt: new Date(),
        exitCode: code,
      };
    });

    // Quando o jogo é iniciado
    runningGames[gameId] = {
      running: true,
      startedAt: new Date(),
    };

    // Retornar sucesso imediatamente
    return res.json({
      success: true,
      message: "Jogo iniciado com sucesso",
      data: {
        game: {
          id: gameId,
          name: foundGameName,
          path: romPath,
        },
        system: {
          id: system.id,
          name: system.name,
          emulator: selectedEmulator,
          core: selectedCore,
        },
        command: {
          launcher: launcherPath,
          args: args,
          fullCommand: fullCommand,
        },
      },
    });
  } catch (err) {
    console.error(`Erro ao lançar jogo ${req.params.id}:`, err);
    return res.status(500).json({
      success: false,
      message: `Erro ao iniciar o jogo: ${err.message}`,
    });
  }
});

/**
 * GET /api/games/:id/status
 * Verifica o status de um jogo (se está em execução ou não)
 */
router.get("/:id/status", (req, res) => {
  const gameId = req.params.id;

  // Buscar o status do jogo no objeto runningGames
  const status = runningGames[gameId] || { running: false };

  // Adicionar timestamp para ajudar no debugging
  const now = new Date();
  status.checkedAt = now.toISOString();

  // Adicionar mais detalhes ao log para facilitar a depuração
  console.log(
    `[${now.toISOString()}] Verificação de status para jogo ${gameId}: ${
      status.running ? "em execução" : "não está rodando"
    }`
  );

  // Se o jogo terminou recentemente, incluir essa informação
  if (status.closedAt) {
    console.log(
      `Jogo ${gameId} foi encerrado em ${status.closedAt.toISOString()} com código ${
        status.exitCode || "desconhecido"
      }`
    );
  }

  res.json({
    success: true,
    data: status,
  });
});

// Esta função deve ficar no seu servidor Node.js (no routes/games.js ou services)
/**
 * Verifica a existência de um arquivo de imagem e retorna o caminho válido
 * @param {string} primaryPath - Caminho primário da imagem
 * @param {string} fallbackPath - Caminho alternativo caso a primária não exista
 * @param {string} placeholderPath - Caminho do placeholder caso nenhuma imagem exista
 * @returns {string} - Caminho da imagem que existe
 */
function getValidImagePath(primaryPath, fallbackPath, placeholderPath) {
  const configService = require("../services/configService");
  const paths = configService.getPaths();

  // Remover o prefixo de URL, se houver (como /roms-media/)
  const getAbsolutePath = (urlPath) => {
    if (!urlPath) return null;

    // Se é uma URL completa externa, retornar como está
    if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
      return urlPath;
    }

    // Se começa com /roms-media/, converter para caminho absoluto
    if (urlPath.startsWith("/roms-media/")) {
      const relativePath = urlPath.replace(/^\/roms-media\//, "");
      return path.join(paths.romsDir, relativePath);
    }

    // Se já é um caminho absoluto, retornar como está
    if (path.isAbsolute(urlPath)) {
      return urlPath;
    }

    // Caso contrário, assumir caminho relativo ao rootDir
    return path.join(paths.rootDir, urlPath);
  };

  // Verificar a imagem primária
  const primaryAbsPath = getAbsolutePath(primaryPath);
  if (primaryAbsPath && fs.existsSync(primaryAbsPath)) {
    return primaryPath; // Retorna o caminho original (URL), não o absoluto
  }

  // Verificar a imagem de fallback
  const fallbackAbsPath = getAbsolutePath(fallbackPath);
  if (fallbackAbsPath && fs.existsSync(fallbackAbsPath)) {
    return fallbackPath; // Retorna o caminho original (URL)
  }

  // Se nenhuma existir, retornar o placeholder
  return placeholderPath;
}

// Exportar o router
module.exports = router;
