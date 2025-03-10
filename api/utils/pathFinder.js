/**
 * Utilitário para encontrar os caminhos do EmulationStation em instalações RetroBat
 */
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

/**
 * Encontra os diretórios relacionados ao EmulationStation
 * @returns {Object} Objeto com os caminhos encontrados
 */
function findEmulationStationPaths() {
  console.log("Iniciando busca por caminhos do EmulationStation...");
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
    themesDir: null,
  };

  // Verificar se estamos no modo portátil
  if (process.env.ES_PORTABLE_MODE === "true") {
    console.log("Modo portátil confirmado via variável de ambiente");

    // Usar o caminho raiz definido ou o diretório atual
    const rootPath = process.env.ES_ROOT_PATH || process.cwd();
    console.log("Usando caminho raiz:", rootPath);

    // Definir caminhos relativos ao diretório raiz
    result.rootDir = rootPath;
    result.emulationStationDir = path.join(rootPath, "emulationstation");
    result.romsDir = path.join(rootPath, "roms");
    result.biosDir = path.join(rootPath, "bios");

    // Definir diretório de configuração (caminho padrão)
    result.configDir = path.join(
      rootPath,
      "emulationstation",
      ".emulationstation"
    );
    result.themesDir = path.join(result.configDir, "themes");

    // Verificar se existe es_systems.cfg
    const systemsFile = path.join(result.configDir, "es_systems.cfg");
    console.log(`Verificando arquivo de sistemas em: ${systemsFile}`);
    console.log(`Arquivo existe: ${fs.existsSync(systemsFile)}`);

    // Log final dos caminhos encontrados
    console.log("Caminhos finais no modo portable:");
    Object.entries(result).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
      if (value) {
        console.log(`Existe: ${fs.existsSync(value)}`);
      }
    });

    return result;
  }

  // Se não estiver em modo portable, usar o mesmo padrão de diretórios
  // result.rootDir = process.cwd();
  result.rootDir = "..";
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
