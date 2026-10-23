# bioOasis Android app

A small native wrapper that bundles the whole web app and runs it offline in a
WebView. Label reading, the classifier, the evidence pages, the mix check and
Dew chat all work with no backend and no internet. Internet is only needed for
the optional weather check and the first OCR model download.

## Build the APK

You need: JDK 17+, the Android SDK (platform 34 + build-tools), and Gradle 8.5+.

```bash
cd android
ANDROID_HOME=/path/to/sdk gradle :app:assembleDebug
```

The debug APK lands at `app/build/outputs/apk/debug/app-debug.apk`. Copy it to
your phone, allow "install from this source" when Android asks, and open
bioOasis. The debug APK is signed with the standard debug key - fine for your
own phone and demos, not for publishing.

## How it works

- `app/build.gradle` copies `../frontend` into the APK's assets on every build,
  so the app and the website can never drift apart.
- `MainActivity.java` serves those assets over a trusted https origin with
  `WebViewAssetLoader` (ES modules and fetch() need a real origin), handles the
  camera/gallery picker for label photos, asks for location only when the
  weather check needs it, and opens external source links in the real browser.
- The web app detects there is no backend and runs in "static mode": the
  same classifier and evidence logic, in JavaScript, on the device.

## Speech input (Dew's microphone)

Dew's microphone button uses the phone's built-in speech recognizer through a
small bridge (`window.BioDewSpeech`) that only bundled app pages can reach -
every external link is pushed out to the real browser, so no third-party page
can call it. Listening starts only when the button is tapped; the app never
listens on its own. The microphone permission is requested at that first tap
and can be revoked like any other. The recognized text is placed into the
chat, nothing else is done with it.

Note: the OS recognizer is the phone's own service (often Google's), and on
many phones it processes audio over the network - speech may not stay on the
device. Typing to Dew always works fully offline. If the recognizer or a
requested language (English/Hindi/Marathi) is unavailable, Dew says so and
typing still works.

## Notes

- Camera and location permissions are asked only when used, and both are
  optional (`uses-feature required="false"`).
- Adding a label photo always asks "camera or gallery" first; neither opens by itself, and no camera permission is requested until you pick the camera.
- Label photos never leave the phone: OCR runs on-device.
- For a Play Store release you would need a release keystore and a privacy
  policy; neither is included here.
