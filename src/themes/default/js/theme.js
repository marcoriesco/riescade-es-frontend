// Default Theme JavaScript
class DefaultTheme {
  constructor() {
    this.init();
  }

  init() {
    // Add event listeners when theme is loaded
    this.addSystemCardHoverEffects();
    this.addGameCardHoverEffects();
    this.setupLazyLoading();
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
}

// Initialize theme when script loads
window.defaultTheme = new DefaultTheme();
