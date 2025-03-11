/**
 * Utilitário para encontrar os caminhos do EmulationStation em instalações RetroBat
 */
const path = require("path");
const fs = require("fs");

/**
 * Encontra os diretórios relacionados ao EmulationStation
 * @returns {Object} Objeto com os caminhos encontrados
 */
function findEmulationStationPaths() {
  console.log("Diretório de trabalho atual:", process.cwd());
  console.log("Diretório do executável:", process.execPath);
  console.log("ES_PORTABLE_MODE:", process.env.ES_PORTABLE_MODE);
  console.log("ES_ROOT_PATH:", process.env.ES_ROOT_PATH);

  const result = {
    rootDir: null,
    emulationStationDir: null,
    configDir: null,
    romsDir: null,
    biosDir: null,
    emulatorsDir: null,
    themesDir: null,
  };

  const rootPathDev = "..";
  const rootPathBuild = process.env.ES_ROOT_PATH;

  result.rootDir = process.env.ES_PORTABLE_MODE ? rootPathBuild : rootPathDev;

  result.emulationStationDir = path.join(result.rootDir, "emulationstation");
  result.configDir = path.join(result.emulationStationDir, ".emulationstation");
  result.romsDir = path.join(result.rootDir, "roms");
  result.emulatorsDir = path.join(result.rootDir, "emulators");
  result.biosDir = path.join(result.rootDir, "bios");
  result.themesDir = path.join(result.configDir, "themes");

  // Log dos caminhos encontrados
  console.log("Caminhos do EmulationStation encontrados:");
  console.log(JSON.stringify(result, null, 2));

  return result;
}

module.exports = {
  findEmulationStationPaths,
};
