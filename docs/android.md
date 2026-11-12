# Android setup

The app is a Vite web app wrapped with [Capacitor](https://capacitorjs.com). The Android project lives in `android/` and is committed.

**App ID:** `io.github.delucagit.sabaahalwuruud` — never change it, or installed copies can no longer be updated in place (and Aisha's data would be lost).

## One-time setup (Windows)

1. Install [Android Studio](https://developer.android.com/studio).
2. Open it once and finish the setup wizard (**Standard**). This downloads the Android SDK to `%LOCALAPPDATA%\Android\Sdk`.
3. Accept the SDK licences (the wizard does this; otherwise *Settings → Android SDK → SDK Tools*).

## Build and run

```sh
npm run cap:sync   # vite build + copy web assets/plugins into android/
npm run cap:open   # open android/ in Android Studio
```

In Android Studio, pick a device (a phone with USB debugging, or an emulator) and press **Run ▶**.

Command line alternative (debug APK):

```sh
cd android
./gradlew assembleDebug   # → android/app/build/outputs/apk/debug/app-debug.apk
```

Notes for the command-line build:

- Gradle 8.14 cannot run on Java 25, which newer Android Studio versions bundle. Point `JAVA_HOME` at a JDK 17 to 24 before running `gradlew`.
- The plugins compile with a Java 21 toolchain. Gradle downloads it automatically through the foojay resolver plugin in `android/settings.gradle`.
- `ANDROID_HOME` must point at the SDK (`%LOCALAPPDATA%\Android\Sdk`).

## Permissions

`AndroidManifest.xml` declares `POST_NOTIFICATIONS` (Android 13+ asks the user), `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` (reminders at exact times), `RECEIVE_BOOT_COMPLETED` (reminders survive a reboot) and `VIBRATE` (counter haptics).

## Manual checks (#11)

- The debug app launches on a phone and shows the home screen.
- A notification scheduled ~1 minute ahead fires in airplane mode, and tapping it opens the right section.
