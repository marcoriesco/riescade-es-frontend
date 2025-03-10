/**
 * Utilitário para encontrar os caminhos do EmulationStation em instalações RetroBat
 */
const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * Encontra os diretórios relacionados ao EmulationStation
 * @returns {Object} Objeto com os caminhos encontrados
 */
function findEmulationStationPaths() {
  console.log(
    "Iniciando busca por caminhos do EmulationStation (Modo Portable)..."
  );
  console.log("Diretório de trabalho atual:", process.cwd());
  console.log("Diretório do executável:", process.execPath);

  // No modo portable, sempre usamos o diretório atual como raiz
  const rootPath = process.cwd();
  console.log("Usando caminho raiz:", rootPath);

  // Definir todos os caminhos diretamente
  const result = {
    rootDir: rootPath,
    emulationStationDir: path.join(rootPath, "emulationstation"),
    configDir: path.join(rootPath, "emulationstation", ".emulationstation"),
    romsDir: path.join(rootPath, "roms"),
    biosDir: path.join(rootPath, "bios"),
    emulatorsDir: path.join(rootPath, "emulators"),
    themesDir: path.join(
      rootPath,
      "emulationstation",
      ".emulationstation",
      "themes"
    ),
  };

  // Definir variáveis de ambiente para garantir consistência
  process.env.ES_PORTABLE_MODE = "true";
  process.env.ES_ROOT_PATH = rootPath;

  // Log dos caminhos encontrados
  console.log("Caminhos do EmulationStation (Modo Portable):");
  Object.entries(result).forEach(([key, value]) => {
    const exists = value ? fs.existsSync(value) : false;
    console.log(`${key}: ${value} (Existe: ${exists})`);
  });

  return result;
}

module.exports = {
  findEmulationStationPaths,
};
