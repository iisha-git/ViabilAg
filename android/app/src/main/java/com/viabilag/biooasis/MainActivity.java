package com.viabilag.biooasis;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;

/** bioOasis: the whole web app bundled in a WebView. Label OCR and the
 *  classifier run on the device; photos never leave the phone.
 *  WebViewAssetLoader serves the bundled site over a trusted https origin so
 *  ES modules, fetch() and geolocation behave exactly as on the website. */
public class MainActivity extends Activity {

    private static final String APP_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;
    private SpeechRecognizer recognizer;
    private String pendingSpeechLang;
    private Uri cameraUri;
    private JavaScriptReplyProxy speechReply;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);          // pages come from WebViewAssetLoader only
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Speech bridge for Dew's microphone button, exposed as a WebMessageListener
        // (never addJavascriptInterface): WebView itself drops messages from any
        // frame whose origin is not exactly our bundled origin, and we additionally
        // ignore anything that does not come from the main frame. So no iframe,
        // subframe, or third-party page can reach the recognizer - only the top
        // bundled page. On WebViews without WEB_MESSAGE_LISTENER support the
        // object simply never exists and Dew falls back to typing.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "BioDewSpeech",
                    Collections.singleton("https://appassets.androidplatform.net"),
                    (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                        if (!isMainFrame) return;
                        String data = message.getData() == null ? "" : message.getData();
                        String[] parts = data.split("\t", 2);
                        if ("start".equals(parts[0])) {
                            speechReply = replyProxy;
                            String lang = parts.length > 1 ? parts[1] : "en-IN";
                            runOnUiThread(() -> startListening(lang));
                        } else if ("stop".equals(parts[0])) {
                            runOnUiThread(this::stopListening);
                        }
                    });
        }
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("https://appassets.androidplatform.net/")) {
                    return false;   // our own pages stay inside
                }
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));  // sources open in the browser
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                fileCallback = null;
                cameraUri = null;
                // The user always chooses: camera or gallery. Neither opens alone.
                // Any failure anywhere must degrade to a plainer picker, never a dead tap.
                Intent contentIntent;
                try {
                    contentIntent = params.createIntent();
                } catch (Exception e) {
                    contentIntent = galleryIntent();
                }
                // Explicit ACTION_CHOOSER (Google sample pattern): gallery as the base
                // intent, camera offered through EXTRA_INITIAL_INTENTS.
                Intent chooser = new Intent(Intent.ACTION_CHOOSER)
                        .putExtra(Intent.EXTRA_INTENT, contentIntent)
                        .putExtra(Intent.EXTRA_TITLE, "Add a label photo");
                if (getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
                    try {
                        File dir = new File(getCacheDir(), "cam");
                        //noinspection ResultOfMethodCallIgnored
                        dir.mkdirs();
                        File photo = File.createTempFile("label", ".jpg", dir);
                        cameraUri = FileProvider.getUriForFile(
                                MainActivity.this, getPackageName() + ".fileprovider", photo);
                        Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                                .putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                                .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                        | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                    } catch (Throwable t) {
                        // Not just IOException: a bad FileProvider paths config throws
                        // IllegalArgumentException (unchecked), which used to kill the
                        // whole chooser silently. Camera drops out; gallery stays.
                        cameraUri = null;
                    }
                }
                try {
                    fileCallback = callback;
                    startActivityForResult(chooser, 1);
                } catch (Exception e) {
                    // Last resort: a plain gallery picker, so the tap never does nothing.
                    try {
                        startActivityForResult(galleryIntent(), 1);
                    } catch (Exception e2) {
                        fileCallback = null;
                        cameraUri = null;
                        callback.onReceiveValue(null);
                        return true;
                    }
                }
                return true;
            }

            private Intent galleryIntent() {
                return new Intent(Intent.ACTION_GET_CONTENT)
                        .addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                                                           GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    geoCallback = callback;
                    geoOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                                                    Manifest.permission.ACCESS_COARSE_LOCATION}, 2);
                }
            }
        });
        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(APP_URL);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == 1 && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                // camera results usually arrive with no data - use the file we made
                if (data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                } else if (cameraUri != null) {
                    result = new Uri[]{cameraUri};
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            cameraUri = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 2 && geoCallback != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            geoCallback.invoke(geoOrigin, granted, false);
            geoCallback = null;
            geoOrigin = null;
        }
        if (requestCode == 3) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted && pendingSpeechLang != null) {
                beginListening(pendingSpeechLang);
            } else {
                jsSpeech("onError", "no-mic-permission");
            }
            pendingSpeechLang = null;
        }
    }

    /* ---- Dew speech input: OS recognizer behind a tiny JS bridge ----
     * Listening starts only when the user taps the microphone button in Dew
     * chat; the app never listens on its own. Audio is handled by the
     * device's speech recognizer, which may use its provider's network
     * service depending on the phone. The transcript is handed back to the
     * chat input - nothing else leaves this callback. */
    private void startListening(String lang) {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            jsSpeech("onError", "unsupported");
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            pendingSpeechLang = lang;   // asked only because the user tapped the mic
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 3);
            return;
        }
        beginListening(lang);
    }

    private void beginListening(String lang) {
        stopListening();
        try {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        } catch (Exception e) {
            jsSpeech("onError", "unsupported");
            return;
        }
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                jsSpeech("onResult", matches != null && !matches.isEmpty() ? matches.get(0) : "");
            }
            @Override public void onError(int error) {
                String code;
                switch (error) {
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: code = "no-mic-permission"; break;
                    case SpeechRecognizer.ERROR_NO_MATCH:
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: code = "no-match"; break;
                    case SpeechRecognizer.ERROR_NETWORK:
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: code = "network"; break;
                    case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE: code = "unsupported-locale"; break;
                    default: code = "error";
                }
                jsSpeech("onError", code);
            }
            @Override public void onReadyForSpeech(Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onPartialResults(Bundle partialResults) {}
            @Override public void onEvent(int eventType, Bundle params) {}
        });
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            recognizer.startListening(intent);
        } catch (Exception e) {
            stopListening();
            jsSpeech("onError", "unsupported");
        }
    }

    private void stopListening() {
        if (recognizer != null) {
            try { recognizer.stopListening(); } catch (Exception ignored) {}
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    private void jsSpeech(String kind, String value) {
        if (web == null) return;
        web.post(() -> {
            if (speechReply != null) {
                try { speechReply.postMessage(kind + "\t" + value); } catch (Exception ignored) {}
            }
        });
    }

    @Override
    protected void onPause() {
        // backgrounding the app always stops the microphone
        stopListening();
        jsSpeech("cancelled", "");
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        stopListening();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
