# TrackBook Android Native Google Sign-In & Supabase Integration Guide

## 1. Overview & Architecture

TrackBook Android uses **Android Credential Manager** (`androidx.credentials` + `com.google.android.libraries.identity.googleid:googleid`) to perform Google Authentication completely inside the Android app. No external Chrome browser popups or redirects are used.

```
+-------------------------------------------------------------------------+
| TrackBook Android App (Native MainActivity + WebView)                   |
| 1. User taps "Continue with Google" / "Login with Google"               |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| JavaScript Bridge (TrackBookBridge.kt)                                  |
| 2. performGoogleSignIn() generates secure nonce & triggers              |
|    androidx.credentials.CredentialManager.getCredential()               |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Android Credential Manager (Native System UI)                           |
| 3. System bottom sheet displays Google accounts. User taps account      |
| 4. Google Play Services issues an OpenID Connect ID Token (JWT)         |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Supabase Authentication (In-App)                                        |
| 5. Token is dispatched to WebView via window.onNativeGoogleSignInResult |
| 6. supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })|
| 7. Supabase issues auth session + user profile record                   |
+-----------------------------------+-------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
| Authenticated TrackBook Dashboard                                       |
| 8. React auth state detects SIGNED_IN event and routes to /cashbooks    |
+-------------------------------------------------------------------------+
```

---

## 2. Google Cloud & Supabase Configuration

### Step A: Google Cloud Console Setup
1. Open [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials).
2. Ensure you have an **OAuth 2.0 Web Client ID**:
   - Application type: **Web application**
   - Name: `TrackBook Web Client`
   - Copy the Client ID (e.g. `1234567890-abcdef.apps.googleusercontent.com`).
   - *Note: This is the `serverClientId` used by Credential Manager in Android.*
3. Create an **Android OAuth Client ID**:
   - Application type: **Android**
   - Package name: `xyz.trackbook.app`
   - SHA-1 certificate fingerprint:
     - Run `./gradlew signingReport` in the `android/` directory to get your debug / release SHA-1 fingerprint.

### Step B: Supabase Dashboard Setup
1. Open [Supabase Dashboard](https://supabase.com/dashboard) -> Your Project -> **Authentication** -> **Providers** -> **Google**.
2. Enable Google authentication.
3. Enter your **Google Client ID** (Web Client ID) and **Google Client Secret**.
4. In **Authorized Client IDs** (under Google provider settings), ensure your Web Client ID is listed.
5. Save changes.

---

## 3. Files in the Android & Web Codebase

1. **`android/app/src/main/java/xyz/trackbook/app/TrackBookBridge.kt`**:
   - Implements native bridge methods `signInWithGoogle()`, `nativeGoogleSignIn()`, `isGoogleAuthSupported()`.
   - Uses `androidx.credentials.CredentialManager` and `GetGoogleIdOption`.
   - Generates cryptographically secure raw & hashed nonces.
   - Handles user cancellation (`GetCredentialCancellationException`) smoothly without errors.
   - Dispatches JSON result to `window.onNativeGoogleSignInResult`.

2. **`android/app/src/main/java/xyz/trackbook/app/MainActivity.kt`**:
   - Binds `TrackBookBridge` across interfaces: `TrackBookAndroid`, `Android`, `TrackBookNative`, and `AndroidBridge`.
   - Enables DOM storage, database persistence, and third-party cookies for seamless session persistence.

3. **`android/app/build.gradle.kts`**:
   - Contains `androidx.credentials:credentials:1.5.0-rc01`, `androidx.credentials:credentials-play-services-auth:1.5.0-rc01`, and `com.google.android.libraries.identity.googleid:googleid:1.1.1`.

4. **`src/services/nativeGoogleAuthService.ts`**:
   - `isNativeGoogleAuthAvailable()`: Checks if native Android bridge is available.
   - `performNativeGoogleSignIn()`: Connects with native bridge and calls `supabase.auth.signInWithIdToken()`.
   - `handleUniversalGoogleLogin()`: Intelligently switches between native Credential Manager (on Android) and standard Supabase Web OAuth (on web browsers), preventing "bridge not available" errors.

5. **`src/components/Auth.tsx`**, **`src/components/DesktopSignIn.tsx`**, **`src/components/DesktopSignUp.tsx`**:
   - Google authentication buttons seamlessly call `handleUniversalGoogleLogin`.

---

## 4. Building & Running the Android App

```bash
# 1. Navigate to android directory
cd android

# 2. Check signing SHA-1 fingerprint
./gradlew signingReport

# 3. Build the debug APK
./gradlew assembleDebug

# 4. The output APK will be located at:
# android/app/build/outputs/apk/debug/app-debug.apk

# 5. Install onto connected Android device or emulator:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
