# Mobile follow-up issues

Implemented after user approval. Verified with iPhone-sized browser layouts and emulated touch input.

- [x] **Momentary throttle end zones for Mirage controls.** Add a small slider
      zone below 0% that activates the airbrake while held and a zone above 100%
      that activates afterburner (110% thrust) while held. Releasing the slider
      returns it to 0% or 100%, respectively, and retracts the airbrake or stops
      afterburner. Touch cancellation must also release these temporary controls.
- [x] **Accessible landing gear button.** The user could not find a working
      way to retract/deploy gear on mobile. Provide a clearly visible toggle for
      aircraft with retractable gear, showing the current state; check whether
      existing controls are hidden or clipped on the affected screen size.
- [x] **Scenario selection fits the viewport.** The Saint-Cyr/Luxeuil selection
      screen requires scrolling in the iPhone 15 simulator. Both scenario cards
      and their selection actions must fit on screen without scrolling. Verify
      portrait and landscape layouts, including safe-area insets and browser chrome.
