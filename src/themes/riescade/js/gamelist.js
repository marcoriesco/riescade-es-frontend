/**
 * Game List Screen JavaScript for Default Theme
 * Handles the game list screen functionality
 */

class GameListTheme {
  constructor(theme) {
    this.theme = theme;
    this.init();
  }

  init() {
    this.addGameCardHoverEffects();
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

        // Add hover animation
        const gameImage = card.querySelector(".game-image img");
        if (gameImage) {
          gameImage.style.transform = "scale(1.05)";
        }
      });

      card.addEventListener("mouseleave", () => {
        const gameInfo = card.querySelector(".game-info");
        if (gameInfo) {
          gameInfo.style.height = null;
        }

        // Remove hover animation
        const gameImage = card.querySelector(".game-image img");
        if (gameImage) {
          gameImage.style.transform = "";
        }
      });
    });
  }
}

export default GameListTheme;
