# Release: signed APK for Aisha

Debug builds are signed with a throwaway key. Every version sent to Aisha must be
signed with **the same release key**, or Android refuses to install the update
over the old app, and uninstalling erases her data.

## Once: create the release key

Run in a terminal (PowerShell). `keytool` comes with the JDK:

```
mkdir $HOME\AndroidKeys
& "C:\Program Files\Java\jdk-24\bin\keytool.exe" -genkeypair -v -keystore $HOME\AndroidKeys\sabaah-al-wuruud.jks -alias sabaah -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` asks for a password and a few name questions (any answers are fine).
Then copy `keystore.properties.example` to `keystore.properties` in the repo
root and fill in the path and password. The file is git-ignored.

**Back up** the `.jks` file and the password, for example in a password manager
and on a USB stick. If the key is lost, no future update can be installed over
the app. Never commit the key or the password.

## Every release

1. In `android/app/build.gradle`, raise `versionCode` by 1 and set `versionName`
   (for example `1.0.1`). Skip this only for the very first release (1 / "1.0").
2. Build (see `docs/android.md` for the JDK and SDK paths):
   ```
   npm run cap:sync
   cd android
   ./gradlew assembleRelease
   ```
3. The APK is `android/app/build/outputs/apk/release/app-release.apk`.
4. Send it to Aisha on WhatsApp. She opens it and taps **Update**. She should
   never uninstall the old app first.

The first time, Android asks her to allow WhatsApp to install unknown apps
(see `docs/Installationsguide.pdf`).

## If the debug version is already installed

The debug APK and the release APK have different keys, so the release cannot be
installed over a debug install. Uninstall the debug app once (its test data is
lost), then install the release. From then on, only install release builds.
