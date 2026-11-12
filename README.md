# Sabaah Al-Wuruud (صباح الورود)

A personal, ad-free, fully offline Adhkar app for Android — built as a small web app (Vite + vanilla JS) and packaged with Capacitor.

- Morning, Evening and Before-Sleep adhkar (Hisn al-Muslim, Arabic)
- Istikhara du'a
- Quran memorization tracker (Madinah mushaf, per page) with a random verse + At-Tafsir al-Muyassar from the last memorized page
- Local reminders based on Cairo prayer times (Egyptian General Authority of Survey method)

The full spec and the build plan live in the GitHub issues (see the issue labelled `spec`).

## Development

Requires Node 20+.

```sh
npm install      # install dependencies
npm run dev      # start the dev server (open the printed URL)
npm test         # run the core test suite (Vitest)
npm run build    # production build into dist/
npm run cap:sync # build and copy into the Android project (needs Android Studio, see docs/android.md)
npm run cap:open # open the Android project in Android Studio
```

## Docs

- [Android setup](docs/android.md)
- [Release, signing and updates](docs/release.md)
- [Credits: Quran text and tafsir](docs/credits/quran.md)
- [Credits: Adhkar (Hisn al-Muslim)](docs/credits/adhkar.md)
