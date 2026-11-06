# Malstrom Engine

Malstrom Engine is an early desktop launcher and 2D game-making prototype. It creates `.msg` project manifests and `.msc` VScript files, includes a canvas scene editor and keyboard-controlled play mode, and stores starter `.msm` asset metadata packages in the local app data folder. The AI game builder currently uses a small offline template generator.

## Run the launcher

Requires Node.js 20 or newer.

```sh
npm install
npm start
```

Run the VScript checks with `npm test`.

## First project

Create a project from the launcher or open a folder containing a `.msg` file. The starter scene includes a player, a platform, and a collectible star. Select objects in the scene list or canvas, drag them to reposition, and edit their name, type, size, and color in the inspector. Use the plus button to add objects. Save with the toolbar button or Ctrl+S / Cmd+S. Press Play to move with the arrow keys or A/D and jump with Space, Up, or W.

The VScript panel supports `on_start:`, `on_collect "star":`, `on_key "space":`, and `on_win:` events with `say "text"`, `set score to 0`, `add 1 to score`, and `win` actions. The interpreter reports unsupported lines before Play.

## Build the Windows installer

On Windows, run `npm ci` followed by `npm run dist:win`. The installer is written to `release/`. The GitHub Actions workflow also builds it on tag pushes (`v*`) or a manual workflow run.

## Current limitations

The 2D runtime is an early preview, not a production engine; it currently supports basic platform collision, movement, jumping, and star collection. There is no 3D renderer, model importer, real AI service, or hosted community marketplace. The starter asset catalog saves metadata packages rather than model/audio binaries. The engine install action writes a version manifest and VScript guide; it does not download a separate engine binary. The `.msg`, `.msm`, and `.msc` structures are initial conventions and may change before a production release.
