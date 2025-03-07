const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");
const fsPromises = fs.promises;
const AdmZip = require("adm-zip");

// Get user's themes directory
function getThemesDirectory() {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "themes");
}

// Ensure themes directory exists
async function ensureThemesDirectory() {
  const themesDir = getThemesDirectory();
  try {
    await fsPromises.access(themesDir);
  } catch {
    await fsPromises.mkdir(themesDir, { recursive: true });
  }
  return themesDir;
}

// Register custom protocol for external themes
function registerThemeProtocol() {
  protocol.handle("riescade", (request, callback) => {
    const url = request.url.substr(11); // Remove 'riescade://'
    console.log(`Riescade protocol request: ${url}`);

    if (url.startsWith("external-themes/")) {
      // Handle external themes
      const themePath = url.replace("external-themes/", "");
      const themesDir = getThemesDirectory();
      callback({ path: path.join(themesDir, themePath) });
    } else if (url.startsWith("media/images/")) {
      // Handle media images
      const imagePath = url.replace("media/images/", "");
      const mediaDir = path.join(app.getPath("userData"), "media", "images");
      console.log(`Looking for image: ${imagePath} in ${mediaDir}`);

      // Ensure the media directory exists
      try {
        if (!fs.existsSync(mediaDir)) {
          fs.mkdirSync(mediaDir, { recursive: true });
          console.log(`Created media directory: ${mediaDir}`);
        }
      } catch (err) {
        console.error(`Error creating media directory: ${err.message}`);
      }

      // First check if file exists in user media directory
      const filePath = path.join(mediaDir, imagePath);

      // Try all possible extensions if no extension in the path
      const tryExtensions = async (basePath) => {
        const extensions = [".png", ".jpg", ".jpeg", ".webp"];

        // If path already has extension, try it first
        if (path.extname(basePath)) {
          try {
            await fsPromises.access(basePath);
            console.log(`Found image at: ${basePath}`);
            return basePath;
          } catch (err) {
            // Continue to try other locations
          }
        } else {
          // Try each extension
          for (const ext of extensions) {
            try {
              const pathWithExt = `${basePath}${ext}`;
              await fsPromises.access(pathWithExt);
              console.log(`Found image at: ${pathWithExt}`);
              return pathWithExt;
            } catch (err) {
              // Continue to next extension
            }
          }
        }

        // If we get here, no file was found with any extension
        return null;
      };

      // Try to find the image with various extensions
      tryExtensions(filePath)
        .then((foundPath) => {
          if (foundPath) {
            callback({ path: foundPath });
            return;
          }

          // If not found in user media, try EmulationStation media directory
          const esMediaPath = path.join(
            emulationStationRootDir,
            "downloaded_media",
            "images",
            imagePath
          );

          return tryExtensions(esMediaPath);
        })
        .then((foundPath) => {
          if (foundPath) {
            callback({ path: foundPath });
            return;
          }

          // If still not found, return default image
          const defaultPath = path.join(
            rootDir,
            "assets",
            "icons",
            "default-game.png"
          );
          console.log(`Image not found, using default: ${defaultPath}`);
          callback({ path: defaultPath });
        })
        .catch((err) => {
          console.error(`Error accessing image file: ${err.message}`);
          callback({
            path: path.join(rootDir, "assets", "icons", "default-game.png"),
          });
        });
    } else {
      // Other riescade:// URLs
      callback({ path: path.join(rootDir, url) });
    }
  });
}

// Setup IPC handlers for theme management
function setupThemeHandlers() {
  // Check if theme exists in external directory
  ipcMain.handle("check-external-theme", async (event, themeName) => {
    const themesDir = getThemesDirectory();
    const themePath = path.join(themesDir, themeName);
    try {
      await fsPromises.access(themePath);
      return true;
    } catch {
      return false;
    }
  });

  // Read theme file
  ipcMain.handle("read-file", async (event, filePath, isExternal) => {
    try {
      const fullPath = isExternal
        ? path.join(
            getThemesDirectory(),
            filePath.replace("riescade://external-themes/", "")
          )
        : path.join(__dirname, filePath);

      const content = await fsPromises.readFile(fullPath, "utf8");
      return content;
    } catch (error) {
      console.error("Error reading file:", error);
      return null;
    }
  });

  // Get theme configuration
  ipcMain.handle("get-theme-config", async (event, themeName, isExternal) => {
    try {
      const themePath = isExternal
        ? path.join(getThemesDirectory(), themeName)
        : path.join(__dirname, "themes", themeName);

      const configPath = path.join(themePath, "theme.json");
      const configData = await fsPromises.readFile(configPath, "utf8");
      return JSON.parse(configData);
    } catch (error) {
      console.error("Error reading theme config:", error);
      return null;
    }
  });

  // Get internal themes
  ipcMain.handle("get-internal-themes", async () => {
    try {
      const themesPath = path.join(__dirname, "themes");
      const themes = await fsPromises.readdir(themesPath);
      return themes.filter(async (theme) => {
        const stats = await fsPromises.stat(path.join(themesPath, theme));
        return stats.isDirectory();
      });
    } catch (error) {
      console.error("Error getting internal themes:", error);
      return ["default"];
    }
  });

  // Get external themes
  ipcMain.handle("get-external-themes", async () => {
    try {
      const themesDir = await ensureThemesDirectory();
      const themes = await fsPromises.readdir(themesDir);
      return themes.filter(async (theme) => {
        const stats = await fsPromises.stat(path.join(themesDir, theme));
        return stats.isDirectory();
      });
    } catch (error) {
      console.error("Error getting external themes:", error);
      return [];
    }
  });

  // Install theme from zip file
  ipcMain.handle("install-theme", async (event, zipFilePath) => {
    try {
      const themesDir = await ensureThemesDirectory();
      const zip = new AdmZip(zipFilePath);

      // Validate theme structure
      const zipEntries = zip.getEntries();
      const hasRequiredFiles = zipEntries.some(
        (entry) =>
          entry.entryName.includes("/templates/") ||
          entry.entryName.includes("/css/") ||
          entry.entryName.includes("/js/")
      );

      if (!hasRequiredFiles) {
        throw new Error("Invalid theme structure");
      }

      // Extract theme
      zip.extractAllTo(themesDir, true);
      return true;
    } catch (error) {
      console.error("Error installing theme:", error);
      return false;
    }
  });

  // Remove installed theme
  ipcMain.handle("remove-theme", async (event, themeName) => {
    try {
      const themesDir = getThemesDirectory();
      const themePath = path.join(themesDir, themeName);
      await fsPromises.rm(themePath, { recursive: true });
      return true;
    } catch (error) {
      console.error("Error removing theme:", error);
      return false;
    }
  });
}

app.whenReady().then(() => {
  registerThemeProtocol();
  setupThemeHandlers();
  createWindow();
});
