/**
 * Systems Screen JavaScript for Default Theme
 * Handles the systems screen functionality
 */

class SystemsTheme {
  constructor(theme) {
    this.theme = theme;
    this.init();
  }

  init() {
    this.addSystemCardHoverEffects();
  }

  // Add hover effects to system cards
  addSystemCardHoverEffects() {
    const systemCards = document.querySelectorAll(".system-card");
    systemCards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        // Add custom hover animations
        card.style.transform = "translateY(-5px)";
        card.style.boxShadow = "0 10px 20px rgba(0, 0, 0, 0.3)";
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0)";
        card.style.boxShadow = "";
      });
    });
  }
}

export default SystemsTheme;
