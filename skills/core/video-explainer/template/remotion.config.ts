import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// The downloaded chrome-headless-shell hung on "Waiting for root component" on this Mac.
// Installed Chrome works. CHROME overrides the path (contact.mjs reads the same variable).
Config.setBrowserExecutable(process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
Config.setChromeMode('chrome-for-testing');
