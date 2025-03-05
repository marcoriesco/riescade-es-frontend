# RIESCADE Theme Documentation

## Overview

RIESCADE themes are built using modern web technologies (HTML, CSS, and JavaScript). Each theme consists of templates that use interpolation tags to display dynamic content, similar to modern frameworks like Angular.

## Theme Structure

```
theme-name/
  ├── templates/          # HTML templates
  │   ├── systems.html    # Systems view template
  │   └── gamelist.html   # Game list template
  ├── css/
  │   └── theme.css      # Theme styles
  ├── js/
  │   └── theme.js       # Theme behaviors (optional)
  └── theme.json         # Theme configuration
```

## Available Tags

### System View Tags

These tags are available in the `systems.html` template:

#### Application Info

- `{{app.title}}` - Application name (RIESCADE)

#### Statistics

- `{{stats.totalGames}}` - Total number of games across all systems
- `{{stats.totalSystems}}` - Total number of systems

#### System Information (Inside system loop)

- `{{system.id}}` - System unique identifier
- `{{system.name}}` - System name (e.g., "Nintendo Entertainment System")
- `{{system.logoPath}}` - Path to system logo image
- `{{system.gameCount}}` - Number of games in the system
- `{{system.background}}` - Path to system background image

### Game List Tags

These tags are available in the `gamelist.html` template:

#### System Header

- `{{system.name}}` - Current system name
- `{{system.logoPath}}` - Path to system logo
- `{{system.gameCount}}` - Number of games in the system

#### Game Information (Inside game loop)

- `{{game.id}}` - Game unique identifier
- `{{game.title}}` - Game title
- `{{game.image}}` - Path to game cover/screenshot
- `{{game.developer}}` - Game developer
- `{{game.releaseDate}}` - Game release date
- `{{game.genre}}` - Game genre
- `{{game.description}}` - Game description
- `{{game.fanart}}` - Path to game fanart
- `{{game.video}}` - Path to game video (if available)
- `{{game.screenshot}}` - Path to game screenshot

## Theme Configuration

The `theme.json` file defines theme metadata and default values:

```json
{
  "name": "Theme Name",
  "version": "1.0.0",
  "author": "Author Name",
  "description": "Theme description",
  "preview": "preview.jpg",
  "compatibility": "1.0.0",
  "variables": {
    "primaryColor": "#1a88ff",
    "backgroundColor": "#121212",
    "textColor": "#ffffff",
    "cardColor": "#1e1e1e"
  }
}
```

## CSS Variables

The following CSS variables are available for styling:

```css
:root {
  /* Colors */
  --primary-color: #1a88ff;
  --background-color: #121212;
  --surface-color: #1e1e1e;
  --text-color: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --card-background: #242424;
  --card-hover: #2a2a2a;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Border Radius */
  --border-radius-sm: 4px;
  --border-radius-md: 8px;
  --border-radius-lg: 12px;
}
```

## Creating a Theme

1. Create a new directory with the structure shown above
2. Create your HTML templates using the available tags
3. Style your theme using CSS
4. Add custom behaviors with JavaScript (optional)
5. Create a theme.json file with your theme's metadata
6. Package everything into a ZIP file

## Installing Themes

Themes can be installed in two ways:

1. **Development**: Place the theme folder in the `src/themes` directory
2. **Production**: Install through RIESCADE's theme manager using a ZIP file

Production themes are stored in:

- Windows: `%APPDATA%/riescade/themes/`
- Linux: `~/.config/riescade/themes/`
- macOS: `~/Library/Application Support/riescade/themes/`

## Example Theme Template

### systems.html

```html
<div class="systems-container">
  <header class="systems-header">
    <h1>{{app.title}}</h1>
    <div class="system-info">
      <span class="total-games">{{stats.totalGames}} Games</span>
      <span class="total-systems">{{stats.totalSystems}} Systems</span>
    </div>
  </header>

  <div class="systems-grid">
    <div class="system-card" data-system-id="{{system.id}}">
      <div class="system-logo">
        <img src="{{system.logoPath}}" alt="{{system.name}}" />
      </div>
      <div class="system-info">
        <h2>{{system.name}}</h2>
        <span>{{system.gameCount}} games</span>
      </div>
    </div>
  </div>
</div>
```

### gamelist.html

```html
<div class="gamelist-container">
  <header class="gamelist-header">
    <div class="system-info">
      <img src="{{system.logoPath}}" alt="{{system.name}}" />
      <h1>{{system.name}}</h1>
    </div>
  </header>

  <div class="games-grid">
    <div class="game-card" data-game-id="{{game.id}}">
      <div class="game-image">
        <img src="{{game.image}}" alt="{{game.title}}" />
      </div>
      <div class="game-info">
        <h2>{{game.title}}</h2>
        <div class="game-metadata">
          <span>{{game.developer}}</span>
          <span>{{game.releaseDate}}</span>
          <span>{{game.genre}}</span>
        </div>
        <p>{{game.description}}</p>
      </div>
    </div>
  </div>
</div>
```
