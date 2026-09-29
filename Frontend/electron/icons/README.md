This directory should contain the application icon files for the Windows build.

Required files:
  icon.ico  - Windows icon (multi-resolution .ico, minimum 256x256)
  icon.png  - PNG fallback (512x512 recommended)

If these files are missing, electron-builder will use the default Electron icon.

To convert an existing PNG to ICO format, you can use:
  - https://www.icoconverter.com/
  - ImageMagick: convert icon.png -resize 256x256 icon.ico
  - The 'png-to-ico' npm package

Recommended sizes in the .ico file: 16, 32, 48, 64, 128, 256 pixels.
