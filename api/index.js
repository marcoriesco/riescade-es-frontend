/**
 * API Local do RIESCADE
 * Este módulo define a API local para acesso aos dados do EmulationStation
 */

const { ipcMain } = require("electron");

/**
 * Registra todos os endpoints da API nos handlers do IPC
 * @param {Object} endpoints - Objeto contendo os endpoints de sistemas, jogos e temas
 */
function registerApiEndpoints(endpoints) {
  const { systemEndpoints, gameEndpoints, themeEndpoints } = endpoints;

  // Registrar endpoints de sistemas
  Object.entries(systemEndpoints).forEach(([key, handler]) => {
    ipcMain.handle(`api:systems:${key}`, (event, ...args) => handler(...args));
  });

  // Registrar endpoints de jogos
  Object.entries(gameEndpoints).forEach(([key, handler]) => {
    ipcMain.handle(`api:games:${key}`, (event, ...args) => handler(...args));
  });

  // Registrar endpoints de temas
  Object.entries(themeEndpoints).forEach(([key, handler]) => {
    ipcMain.handle(`api:themes:${key}`, (event, ...args) => handler(...args));
  });

  console.log("API local registrada com sucesso!");
}

module.exports = {
  registerApiEndpoints,
};
