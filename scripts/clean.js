/**
 * Script para limpar os diretórios de build e dist
 */
const fs = require("fs-extra");
const path = require("path");
const { execSync } = require("child_process");

// Diretório raiz do projeto
const rootDir = path.join(__dirname, "..");

// Diretório para build temporário
const buildDir = path.join(rootDir, "build");

// Diretório para distribuição
const distDir = path.join(rootDir, "dist");

console.log("Tentando encerrar processos relacionados...");
try {
  // No Windows, tente encerrar processos que possam estar bloqueando arquivos
  if (process.platform === "win32") {
    try {
      execSync('taskkill /F /IM "ES Theme Engine.exe" /T', { stdio: "ignore" });
    } catch (e) {
      // Ignorar erros se o processo não estiver em execução
    }

    try {
      execSync('taskkill /F /IM "electron.exe" /T', { stdio: "ignore" });
    } catch (e) {
      // Ignorar erros se o processo não estiver em execução
    }
  }
} catch (err) {
  console.warn("Aviso ao tentar encerrar processos:", err.message);
}

// Aguardar um momento para garantir que os processos foram encerrados
setTimeout(() => {
  console.log("Limpando diretórios de build e dist...");

  // Limpar diretório de build
  if (fs.existsSync(buildDir)) {
    try {
      fs.removeSync(buildDir);
      console.log("Diretório build removido com sucesso");
    } catch (err) {
      console.error("Erro ao remover diretório build:", err.message);
    }
  } else {
    console.log("Diretório build não existe, nada a fazer");
  }

  // Limpar diretório de dist
  if (fs.existsSync(distDir)) {
    try {
      fs.removeSync(distDir);
      console.log("Diretório dist removido com sucesso");
    } catch (err) {
      console.error("Erro ao remover diretório dist:", err.message);

      // Tentar remover arquivos individualmente
      console.log("Tentando remover arquivos individualmente...");
      try {
        const files = fs.readdirSync(distDir);
        for (const file of files) {
          try {
            const filePath = path.join(distDir, file);
            const stat = fs.lstatSync(filePath);

            if (stat.isDirectory()) {
              fs.removeSync(filePath);
              console.log(`Subdiretório ${file} removido`);
            } else {
              fs.unlinkSync(filePath);
              console.log(`Arquivo ${file} removido`);
            }
          } catch (fileErr) {
            console.warn(
              `Não foi possível remover ${file}: ${fileErr.message}`
            );
          }
        }
      } catch (listErr) {
        console.error("Erro ao listar arquivos:", listErr.message);
      }
    }
  } else {
    console.log("Diretório dist não existe, nada a fazer");
  }

  console.log("Limpeza concluída");
}, 1000); // Aguardar 1 segundo
