# Orion AquaMate 8000 UV-Vis Training Simulator

Offline, browser-based training simulator focused on the Orion AquaMate 8000 UV-Vis workflow. The source guide also describes the 7000 Vis; the simulator implements the 8000 workflows and holder options only. The interface is available in English and Spanish. It produces illustrative measurements and does not control a physical spectrophotometer.

## Run

Open `index.html` in a current desktop browser. The project uses plain HTML, CSS, and classic JavaScript files, so it has no build step, package installation, server, or network dependency.

## Included workflows

- A-%T-C, advanced A-%T-C, wavelength scans, kinetics, multiwavelength, ratio, difference, and three-point net measurements.
- Water-analysis methods, standard curves, performance verification, and configured cell correction for Auto 6 / Auto 3 holders. Scan correction covers a selected range; discrete correction supports up to 31 wavelengths and applies measured offsets to later readings in that test.
- Instrument keypad and keyboard input, bilingual interface, guided walkthroughs, sample carousel, event log, and simulated printer output.
- Saved test parameters, SmartStart selections, correction settings, and measurement data persist in browser storage. Results can be exported as CSV.

The sample spectra, noise, timing, and several instrument checks are teaching models. They are intentionally simplified and do not reproduce validated instrument firmware or certified test data.

## File map

- `index.html` provides the simulator layout and loads the scripts.
- `style.css` contains the responsive visual design.
- `js/i18n.js` holds interface translations.
- `js/data.js` defines methods, sample spectra, cell holders, and demo tests.
- `js/engine.js` owns application state and measurement calculations.
- `js/lcd.js` draws the instrument display.
- `js/screens.js` and `js/screens2.js` implement instrument screens and measurement flows.
- `js/tutorial.js` defines the guided walkthroughs.
- `js/app.js` wires controls, keyboard input, and the side panels.

## Current scope

The browser's local storage stands in for instrument test/data directories. Reset returns the live instrument state to its startup screen and preserves saved tests/data. The printer, USB device, cell changer, optical offsets, and performance verification values are simulations; the app does not connect to instrument hardware or a physical printer. If browser storage is unavailable for a local file, saved items last only for the current page session.
