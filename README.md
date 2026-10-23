# Tiling Assistant + Rounded Corners

An experimental GNOME Shell extension that combines **Tiling Assistant v55**
with the current **Rounded Window Corners Reborn** effect.

The project keeps both features in one extension lifecycle, avoiding the
competing window-shader implementations that can cause square artifacts during
tiling and resizing.

## Features

- Tiling Assistant layouts, shortcuts, popup tiling and resize handling.
- Rounded corners and shadows for normal windows.
- Rounded-corner refreshes driven by the same window resize events used by
  GNOME Shell and Tiling Assistant.
- Separate enable/disable lifecycle for the combined extension.
- Existing Rounded Window Corners settings are preserved through the original
  GSettings schema.
- Corrected the upstream maximum-radius calculation that accessed `bounds[4]`
  even though the bounds array contains indexes `0` through `3`.

## Compatibility

- GNOME Shell 48, 49, 50 and 51.
- Wayland and X11 are supported by the bundled rounded-corner effect.
- The extension uses the UUID `tiling-assistant-rounded@nilocnt` so it does not
  overwrite the official Tiling Assistant installation.

This is an initial release. Runtime testing must be performed on a real GNOME
Shell session because GNOME Shell, Mutter and GJS are not available in the
build environment.

## Installation

Download the release archive and install it into the GNOME Shell extensions
directory:

```bash
UUID="tiling-rounded@nilocnt"
DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DIR"
unzip -o tiling-rounded@nilocnt.zip -d "$DIR"
glib-compile-schemas "$DIR/schemas"
gnome-extensions enable "$UUID"
```

On Wayland, log out and back in if GNOME Shell does not reload the extension
immediately.

## Important: Disable Conflicting Extensions

Before enabling this extension, disable:

- `tiling-assistant@leleat-on-github`
- `rounded-window-corners@fxgn`

Do not run the official Tiling Assistant or Rounded Window Corners Reborn at
the same time as this combined extension. Running both copies can create
duplicate tiling handlers, duplicate effects or visual artifacts.

## Preferences

The combined package exposes the Tiling Assistant preferences page. Rounded
Window Corners settings continue to use:

```text
org.gnome.shell.extensions.rounded-window-corners-reborn
```

If the standalone Rounded Window Corners Reborn extension was previously
installed, its saved settings remain available to the combined effect. The
current initial package does not yet merge the standalone rounded-corners
preferences UI into the Tiling Assistant preferences page.

## Architecture

Tiling Assistant remains responsible for window placement, layouts, tiling
groups and animations. Rounded Window Corners is attached to the same
extension lifecycle and listens to compositor actor size, texture size,
fullscreen, focus and workspace changes.

The integration does not add a second tiling shader or patch Tiling Assistant's
layout calculations. On disable, all rounded effects, shadow actors and signal
connections are removed before the tiling extension is torn down.

## Credits

This project combines code from:

- [Ubuntu Tiling Assistant](https://github.com/ubuntu/Tiling-Assistant)
- [Rounded Window Corners Reborn](https://github.com/flexagoon/rounded-window-corners)

Please refer to the included license files for the individual component
licenses. Tiling Assistant is distributed under GPL-2.0-or-later. Rounded
Window Corners Reborn is distributed under GPL-3.0-or-later.

## Status

This is an independent integration project and is not an official release of
either upstream project. Bug reports should include:

- GNOME Shell version;
- Wayland or X11 session;
- whether the official Tiling Assistant or Rounded Window Corners extensions
  are disabled;
- the steps that reproduce the issue;
- relevant GNOME Shell logs.
