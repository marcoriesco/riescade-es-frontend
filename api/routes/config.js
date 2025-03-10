/**
 * Rotas da API para configurações do EmulationStation
 */
const express = require("express");
const configService = require("../services/configService");

const router = express.Router();

/**
 * GET /api/config/paths
 * Retorna os caminhos do EmulationStation
 */
router.get("/paths", (req, res) => {
  const refresh = req.query.refresh === "true";
  const paths = configService.getPaths(refresh);

  res.json({
    success: true,
    data: paths,
  });
});

/**
 * GET /api/config/settings
 * Retorna as configurações do EmulationStation
 */
router.get("/settings", (req, res) => {
  const refresh = req.query.refresh === "true";
  const settings = configService.getSettings(refresh);

  if (!settings) {
    return res.status(404).json({
      success: false,
      message: "Configurações não encontradas",
    });
  }

  res.json({
    success: true,
    data: settings,
  });
});

/**
 * PATCH /api/config/settings
 * Atualiza uma configuração específica
 */
router.patch("/settings", (req, res) => {
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({
      success: false,
      message: "Chave de configuração não especificada",
    });
  }

  const success = configService.updateSetting(key, value);

  if (!success) {
    return res.status(500).json({
      success: false,
      message: "Erro ao atualizar configuração",
    });
  }

  res.json({
    success: true,
    message: "Configuração atualizada com sucesso",
  });
});

/**
 * GET /api/config/systems
 * Retorna os sistemas configurados
 */
router.get("/systems", (req, res) => {
  const refresh = req.query.refresh === "true";
  const systems = configService.getSystems(refresh);

  res.json({
    success: true,
    data: systems,
  });
});

/**
 * GET /api/config/themes
 * Retorna os temas disponíveis
 */
router.get("/themes", (req, res) => {
  const refresh = req.query.refresh === "true";
  const themes = configService.getThemes(refresh);

  res.json({
    success: true,
    data: themes,
  });
});

/**
 * GET /api/config/themes/current
 * Retorna o tema atual
 */
router.get("/themes/current", (req, res) => {
  const theme = configService.getCurrentTheme();

  res.json({
    success: true,
    data: theme,
  });
});

/**
 * PUT /api/config/themes/current
 * Define o tema atual
 */
router.put("/themes/current", (req, res) => {
  const { themeId } = req.body;

  if (!themeId) {
    return res.status(400).json({
      success: false,
      message: "ID do tema não especificado",
    });
  }

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
  });
});

/**
 * GET /api/config/bios
 * Retorna os arquivos BIOS disponíveis
 */
router.get("/bios", (req, res) => {
  const refresh = req.query.refresh === "true";
  const bios = configService.getBios(refresh);

  res.json({
    success: true,
    data: bios,
  });
});

/**
 * POST /api/config/cache/clear
 * Limpa o cache
 */
router.post("/cache/clear", (req, res) => {
  configService.clearCache();

  res.json({
    success: true,
    message: "Cache limpo com sucesso",
  });
});

module.exports = router;
