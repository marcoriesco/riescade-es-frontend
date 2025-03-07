// Default Theme JavaScript
import SystemsTheme from "./systems.js";
import GameListTheme from "./gamelist.js";
import ThemeUtils from "./utils.js";

class DefaultTheme {
  constructor() {
    this.name = "default";
    this.description = "Default theme for RIESCADE";
    this.version = "1.0.0";
    this.author = "RIESCADE Team";

    this.systems = null;
    this.gameList = null;

    this.init();
  }

  init() {
    // Inicializar componentes do tema
    this.systems = new SystemsTheme(this);
    this.gameList = new GameListTheme(this);

    // Configurar carregamento preguiçoso (lazy loading) de imagens
    ThemeUtils.setupLazyLoading();

    // Adicionar animações personalizadas
    ThemeUtils.addCustomAnimations();
  }

  // Add hover effects to system cards
  addSystemCardHoverEffects() {
    const systemCards = document.querySelectorAll(".system-card");
    systemCards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        // Add any custom hover animations or effects
        card.style.transform = "translateY(-5px)";
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0)";
      });
    });
  }

  // Add hover effects to game cards
  addGameCardHoverEffects() {
    const gameCards = document.querySelectorAll(".game-card");
    gameCards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        // Show additional game info on hover
        const gameInfo = card.querySelector(".game-info");
        if (gameInfo) {
          gameInfo.style.height = "auto";
        }
      });

      card.addEventListener("mouseleave", () => {
        const gameInfo = card.querySelector(".game-info");
        if (gameInfo) {
          gameInfo.style.height = null;
        }
      });
    });
  }

  // Setup lazy loading for images
  setupLazyLoading() {
    const images = document.querySelectorAll("img[data-src]");
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute("data-src");
          observer.unobserve(img);
        }
      });
    });

    images.forEach((img) => imageObserver.observe(img));
  }

  // Add any custom animations or transitions
  addCustomAnimations() {
    // Example: Add fade-in animation to elements
    const elements = document.querySelectorAll(".fade-in");
    elements.forEach((element) => {
      element.style.opacity = "0";
      element.style.transition = "opacity 0.3s ease-in-out";
      setTimeout(() => {
        element.style.opacity = "1";
      }, 100);
    });
  }

  loadTheme() {
    // Implement theme loading logic here
  }
}

// Inicializar o tema quando o script for carregado
window.defaultTheme = new DefaultTheme();

// Exportar a classe do tema
export default DefaultTheme;
