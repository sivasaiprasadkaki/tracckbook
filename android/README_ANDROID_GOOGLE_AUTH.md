# TrackBook Android Native Google Sign-In & Supabase Integration

## Overview
This implementation eliminates external Chrome browser redirects during Google Sign-In. The user authenticates completely inside the TrackBook Android app using Android Credential Manager / Google Play Services bottom-sheet dialogs.

---

## Architecture Flow

```
+-------------------------------------------------------------+
| TrackBook React Web App (Inside WebView)                    |
| User clicks "Continue with Google"                         |
+------------------------------+------------------------------+
                               | calls
                               v
+-------------------------------------------------------------+
| window.TrackBookAndroid.signInWithGoogle()                  |
| (TrackBookBridge.kt)                                        |
+------------------------------+------------------------------+
                               | triggers
                               v
+-------------------------------------------------------------+
| Android Credential Manager (Native Google Bottom-Sheet)     |
| User selects Google Account natively without Chrome redirect|
+------------------------------+------------------------------+
                               | returns
                               v
+-------------------------------------------------------------+
| Google OpenID Connect ID Token (JWT)                        |
| Dispatched back to WebView via:                             |
| window.onNativeGoogleSignInResult({ success, idToken })     |
+------------------------------+------------------------------+
                               | calls
                               v
+-------------------------------------------------------------+
| supabase.auth.signInWithIdToken({                           |
|   provider: 'google',                                       |
|   token: idToken                                            |
| })                                                          |
+------------------------------+------------------------------+
                               | creates
                               v
+-------------------------------------------------------------+
| Supabase User Session & Profiles Row                        |
| Automatic redirect to TrackBook Dashboard (/cashbooks)     |
+-------------------------------------------------------------+
```

---

## 1. Google Cloud Console & Supabase Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**.
2. Ensure you have an **OAuth 2.0 Web Client ID**:
   - This **Web Client ID** is set as `googleWebClientId` in `TrackBookBridge.kt` and `MainActivity.kt`.
3. Create an **Android OAuth Client ID** in Google Cloud Console:
   - Package Name: `xyz.trackbook.app` (or your Android package name)
   - SHA-1 Certificate Fingerprint: Run `./gradlew signingReport` to copy your debug / release SHA-1 key.
4. In [Supabase Dashboard](https://supabase.com/dashboard) -> **Authentication** -> **Providers** -> **Google**:
   - Enable Google Provider.
   - Enter your **Google Client ID** and **Google Client Secret**.
   - Enable **"Skip nonce checks"** or use Supabase ID Token verification.

---

## 2. Updated File Locations

1. **React Authentication Service**: `/src/services/nativeGoogleAuthService.ts`
   - Detects Android bridge vs Web browser.
   - Communicates with native bridge.
   - Exchanges Google ID Token with `supabase.auth.signInWithIdToken()`.
   - Handles user cancellation, timeouts, and error states gracefully.

2. **React Auth Screen**: `/src/components/Auth.tsx`
   - Updated `handleGoogleLogin` to use `handleUniversalGoogleLogin`.
   - Automatically navigates to `/cashbooks` upon successful authentication.

3. **Android Bridge**: `/android/app/src/main/java/xyz/trackbook/app/TrackBookBridge.kt`
   - Implements `signInWithGoogle()` using `androidx.credentials.CredentialManager`.
   - Preserves Hardware BiometricPrompt and Keystore MPIN storage.

4. **Android MainActivity**: `/android/app/src/main/java/xyz/trackbook/app/MainActivity.kt`
   - Configures WebView with JavaScript interfaces, WebChromeClient file picker, DownloadListener, and Camera permissions.

5. **Android Dependencies**: `/android/app/build.gradle.kts`
   - Includes `androidx.credentials`, `googleid`, and `androidx.biometric`.
