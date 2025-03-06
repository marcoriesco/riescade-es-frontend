/**
 * Utility functions for Default Theme
 */

class ThemeUtils {
  // Setup lazy loading for images
  static setupLazyLoading() {
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
  static addCustomAnimations() {
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

export default ThemeUtils;
