# Reddit Privacy & Posting Safety Extension

A powerful browser extension designed to enhance your Reddit experience by giving you granular control over content visibility, auto-revealing natively blurred content, and providing an intuitive set of privacy options.

## Features

- **Custom Content Blurring:** Toggle blurs for NSFW and Spoiler posts individually.
- **Auto-Reveal Native Blurs:** Automatically unblur Reddit's native NSFW and Spoiler images as you scroll (bypasses Reddit's strict click blocks!).
- **User Account Detection:** Automatically detects and displays your account age and Karma for quick reference.
- **Posting Safety:** Warns you before posting in a subreddit if you don't meet their Karma or Account Age requirements.

## Credits & Acknowledgements

Special thanks to [andradeatdev's Reddit-NSFW-Unblur](https://github.com/andradeatdev/Reddit-NSFW-Unblur) repository! 
Their brilliant discovery of manipulating Lit Web Component reactive properties (such as `.blurred = false`) was the key to bypassing Reddit's strict native click requirements and making the Auto-Reveal feature robust and smooth.

## Installation Instructions

### For Chrome / Edge / Brave

1. Download or clone this repository to your computer.
2. Open your browser and navigate to the Extensions page:
   - **Chrome:** `chrome://extensions/`
   - **Edge:** `edge://extensions/`
   - **Brave:** `brave://extensions/`
3. Enable **Developer Mode** (usually a toggle switch in the top-right corner).
4. Click the **"Load unpacked"** button.
5. Select the folder containing the extension files (the root folder where `manifest.json` is located).
6. The extension is now installed! You can pin it to your toolbar for easy access.

### For Firefox

1. Download or clone this repository to your computer.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click on the **"Load Temporary Add-on..."** button.
4. Navigate to the extension folder and select the `manifest.json` file.
5. The extension is now temporarily loaded and will remain active until you restart Firefox.

## Contributing
Feel free to open issues or submit pull requests for bug fixes and feature enhancements!
