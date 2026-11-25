# Google Play release pack

This folder contains the editable store copy, privacy-policy draft, and required artwork prepared for SkyCast 1.0.0.

## Artwork

- `icon-512.png`: Play Store app icon (512 × 512 PNG)
- `feature-graphic-1024x500.png`: Play Store feature graphic (1024 × 500 PNG)

At least two phone screenshots still need to be captured from the final signed or preview build. Recommended coverage: the current-weather hero, hourly forecast, weekly forecast, city search, and settings.

## Items that must be completed in Play Console

- Create the app with package name `com.invotyx.skycast`.
- Host `privacy-policy.md` at a stable public HTTPS URL and replace its contact placeholder.
- Complete App access, Ads, Content rating, Target audience, News apps, Data safety, and Government apps declarations.
- Review the Data safety answers against the final build. The current code uses optional precise/approximate location for app functionality and sends coordinates or search text to weather/geocoding providers.
- Upload the production Android App Bundle (`.aab`) to internal testing first.
- Add phone screenshots, the app icon, and feature graphic.
- Test the internal release on physical phones before promoting it to production.

Do not change the package name after the first Play release; Google Play treats a different package name as a different app.
