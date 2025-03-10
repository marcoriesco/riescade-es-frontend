/**
 * Rotas da API para temas do EmulationStation
 */
const express = require("express");
const path = require("path");
const fs = require("fs-extra");
const multer = require("multer");
const AdmZip = require("adm-zip");
const configService = require("../services/configService");

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Armazenamento temporário
    const tempDir = path.join(__dirname, "..", "..", "temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Nome do arquivo temporário
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

/**
 * GET /api/themes
 * Retorna todos os temas
 */
router.get("/", (req, res) => {
  const themes = configService.getThemes(req.query.refresh === "true");

  res.json({
    success: true,
    data: themes,
  });
});

/**
 * GET /api/themes/current
 * Retorna o tema atual
 */
router.get("/current", (req, res) => {
  const theme = configService.getCurrentTheme();

  res.json({
    success: true,
    data: theme,
  });
});

/**
 * GET /api/themes/:id
 * Retorna um tema específico
 */
router.get("/:id", (req, res) => {
  const themeId = req.params.id;
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  res.json({
    success: true,
    data: theme,
  });
});

/**
 * PUT /api/themes/current
 * Define o tema atual
 */
router.put("/current", (req, res) => {
  const { themeId } = req.body;

  if (!themeId) {
    return res.status(400).json({
      success: false,
      message: "ID do tema não especificado",
    });
  }

  // Verificar se o tema existe
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  // Definir como tema atual
  const success = configService.setCurrentTheme(themeId);

  if (!success) {
    return res.status(500).json({
      success: false,
      message: "Erro ao definir tema atual",
    });
  }

  res.json({
    success: true,
    message: "Tema atual definido com sucesso",
    data: theme,
  });
});

/**
 * POST /api/themes
 * Adiciona um novo tema
 */
router.post("/", upload.single("theme"), (req, res) => {
  // Verificar se foi enviado um arquivo
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Nenhum arquivo enviado",
    });
  }

  try {
    const themeZipPath = req.file.path;
    const { themeName } = req.body;

    if (!themeName) {
      return res.status(400).json({
        success: false,
        message: "Nome do tema não especificado",
      });
    }

    // Obter caminhos
    const paths = configService.getPaths();

    if (!paths.themesDir) {
      return res.status(404).json({
        success: false,
        message: "Diretório de temas não encontrado",
      });
    }

    // Extrair o tema
    const themePath = path.join(paths.themesDir, themeName);

    // Remover pasta se já existir
    if (fs.existsSync(themePath)) {
      fs.removeSync(themePath);
    }

    // Criar diretório
    fs.mkdirSync(themePath, { recursive: true });

    // Extrair o zip
    const zip = new AdmZip(themeZipPath);
    zip.extractAllTo(themePath, true);

    // Remover arquivo temporário
    fs.removeSync(themeZipPath);

    // Atualizar cache de temas
    configService.getThemes(true);

    res.json({
      success: true,
      message: "Tema adicionado com sucesso",
      data: {
        id: themeName.toLowerCase(),
        name: themeName,
        path: themePath,
      },
    });
  } catch (err) {
    console.error("Erro ao adicionar tema:", err);

    res.status(500).json({
      success: false,
      message: "Erro ao adicionar tema",
    });
  }
});

/**
 * DELETE /api/themes/:id
 * Remove um tema
 */
router.delete("/:id", (req, res) => {
  const themeId = req.params.id;

  // Verificar se é o tema padrão
  if (themeId.toLowerCase() === "default") {
    return res.status(400).json({
      success: false,
      message: "Não é possível remover o tema padrão",
    });
  }

  // Verificar se o tema existe
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  // Verificar se é o tema atual
  const currentTheme = configService.getCurrentTheme();

  if (currentTheme.id === themeId.toLowerCase()) {
    // Mudar para o tema padrão antes de remover
    configService.setCurrentTheme("default");
  }

  // Remover o tema
  const success = configService.removeTheme(themeId);

  if (!success) {
    return res.status(500).json({
      success: false,
      message: "Erro ao remover tema",
    });
  }

  res.json({
    success: true,
    message: "Tema removido com sucesso",
  });
});

/**
 * GET /api/themes/:id/files
 * Retorna os arquivos de um tema
 */
router.get("/:id/files", (req, res) => {
  const themeId = req.params.id;
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  // Verificar se o tema existe
  if (!fs.existsSync(theme.path)) {
    return res.status(404).json({
      success: false,
      message: "Diretório do tema não encontrado",
    });
  }

  try {
    // Listar arquivos
    const files = listThemeFiles(theme.path);

    res.json({
      success: true,
      data: files,
    });
  } catch (err) {
    console.error(`Erro ao listar arquivos do tema ${themeId}:`, err);

    res.status(500).json({
      success: false,
      message: "Erro ao listar arquivos do tema",
    });
  }
});

/**
 * GET /api/themes/:id/files/:path
 * Retorna um arquivo específico de um tema
 */
router.get("/:id/files/*", (req, res) => {
  const themeId = req.params.id;
  const filePath = req.params[0]; // Caminho do arquivo (vem depois de /files/)

  // Verificar se o tema existe
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  // Caminho completo do arquivo
  const fullPath = path.join(theme.path, filePath);

  // Verificar se o arquivo existe
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({
      success: false,
      message: "Arquivo não encontrado",
    });
  }

  // Verificar se é um diretório
  if (fs.statSync(fullPath).isDirectory()) {
    try {
      // Listar arquivos do diretório
      const files = listThemeFiles(fullPath, theme.path);

      res.json({
        success: true,
        data: files,
      });
    } catch (err) {
      console.error(`Erro ao listar arquivos do diretório ${filePath}:`, err);

      res.status(500).json({
        success: false,
        message: "Erro ao listar arquivos do diretório",
      });
    }
  } else {
    // Enviar o arquivo
    res.sendFile(fullPath);
  }
});

/**
 * PUT /api/themes/:id/files/*
 * Atualiza um arquivo específico de um tema
 */
router.put("/:id/files/*", (req, res) => {
  const themeId = req.params.id;
  const filePath = req.params[0]; // Caminho do arquivo (vem depois de /files/)
  const fileContent = req.body.content;

  // Verificar se o conteúdo foi especificado
  if (fileContent === undefined) {
    return res.status(400).json({
      success: false,
      message: "Conteúdo do arquivo não especificado",
    });
  }

  // Verificar se o tema existe
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  // Caminho completo do arquivo
  const fullPath = path.join(theme.path, filePath);

  // Garantir que o diretório pai exista
  const parentDir = path.dirname(fullPath);

  try {
    // Criar diretório pai se não existir
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Escrever arquivo
    fs.writeFileSync(fullPath, fileContent);

    res.json({
      success: true,
      message: "Arquivo atualizado com sucesso",
    });
  } catch (err) {
    console.error(`Erro ao atualizar arquivo ${filePath}:`, err);

    res.status(500).json({
      success: false,
      message: "Erro ao atualizar arquivo",
    });
  }
});

/**
 * DELETE /api/themes/:id/files/*
 * Remove um arquivo específico de um tema
 */
router.delete("/:id/files/*", (req, res) => {
  const themeId = req.params.id;
  const filePath = req.params[0]; // Caminho do arquivo (vem depois de /files/)

  // Verificar se o tema existe
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  // Caminho completo do arquivo
  const fullPath = path.join(theme.path, filePath);

  // Verificar se o arquivo existe
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({
      success: false,
      message: "Arquivo não encontrado",
    });
  }

  try {
    // Remover arquivo ou diretório
    fs.removeSync(fullPath);

    res.json({
      success: true,
      message: "Arquivo removido com sucesso",
    });
  } catch (err) {
    console.error(`Erro ao remover arquivo ${filePath}:`, err);

    res.status(500).json({
      success: false,
      message: "Erro ao remover arquivo",
    });
  }
});

/**
 * POST /api/themes/:id/files/*
 * Adiciona um novo arquivo a um tema
 */
router.post("/:id/files/*", upload.single("file"), (req, res) => {
  const themeId = req.params.id;
  const destPath = req.params[0]; // Caminho de destino (vem depois de /files/)

  // Verificar se foi enviado um arquivo
  if (!req.file && !req.body.content) {
    return res.status(400).json({
      success: false,
      message: "Nenhum arquivo ou conteúdo enviado",
    });
  }

  // Verificar se o tema existe
  const themes = configService.getThemes();
  const theme = themes.find((t) => t.id === themeId.toLowerCase());

  if (!theme) {
    return res.status(404).json({
      success: false,
      message: "Tema não encontrado",
    });
  }

  try {
    // Caminho de destino completo
    const fullDestPath = path.join(theme.path, destPath);

    // Garantir que o diretório pai exista
    const parentDir = path.dirname(fullDestPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Se foi enviado um arquivo
    if (req.file) {
      // Mover o arquivo para o destino
      fs.moveSync(req.file.path, fullDestPath, { overwrite: true });
    } else {
      // Escrever conteúdo no arquivo
      fs.writeFileSync(fullDestPath, req.body.content);
    }

    res.json({
      success: true,
      message: "Arquivo adicionado com sucesso",
    });
  } catch (err) {
    console.error(`Erro ao adicionar arquivo ${destPath}:`, err);

    // Remover arquivo temporário se existir
    if (req.file && fs.existsSync(req.file.path)) {
      fs.removeSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Erro ao adicionar arquivo",
    });
  }
});

/**
 * Lista recursivamente os arquivos de um tema
 * @param {string} dir - Diretório a ser listado
 * @param {string} baseDir - Diretório base para caminhos relativos
 * @returns {Array} Lista de arquivos
 */
function listThemeFiles(dir, baseDir = dir) {
  const result = [];

  // Listar arquivos no diretório
  const items = fs.readdirSync(dir);

  // Para cada item
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    // Caminho relativo
    const relativePath = path.relative(baseDir, itemPath);

    if (stat.isDirectory()) {
      // Se for um diretório, adicionar à lista
      result.push({
        name: item,
        path: relativePath,
        type: "directory",
        children: listThemeFiles(itemPath, baseDir),
      });
    } else {
      // Se for um arquivo, adicionar à lista
      result.push({
        name: item,
        path: relativePath,
        type: "file",
        size: stat.size,
        modified: stat.mtime,
      });
    }
  }

  return result;
}

module.exports = router;
