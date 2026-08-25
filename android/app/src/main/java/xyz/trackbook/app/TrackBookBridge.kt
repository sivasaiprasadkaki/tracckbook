package xyz.trackbook.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.fragment.app.FragmentActivity
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Native Android JavaScript Bridge for TrackBook
 * 
 * Provides:
 * 1. Native In-App Google Sign-In via Android Credential Manager (No Chrome Browser Redirects)
 * 2. Hardware-backed Biometric Authentication (BiometricPrompt)
 * 3. Android Keystore Encrypted TPIN Storage
 * 4. Native App Lifecycle Controls
 */
class TrackBookBridge(
    private val activity: FragmentActivity,
    private val webView: WebView,
    private val googleWebClientId: String
) {
    private val tag = "TrackBookBridge"
    private val mainHandler = Handler(Looper.getMainLooper())
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    private val credentialManager = CredentialManager.create(activity)

    // =========================================================================
    // 1. NATIVE IN-APP GOOGLE SIGN-IN (Credential Manager)
    // =========================================================================

    @JavascriptInterface
    fun isGoogleAuthSupported(): Boolean {
        return true
    }

    @JavascriptInterface
    fun signInWithGoogle(optionsJson: String? = null): String {
        Log.d(tag, "Native signInWithGoogle triggered from WebView")

        coroutineScope.launch {
            try {
                // Generate secure nonce for token exchange validation
                val rawNonce = generateSecureNonce()
                val hashedNonce = hashNonce(rawNonce)

                val googleIdOption = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(googleWebClientId)
                    .setAutoSelectEnabled(false)
                    .setNonce(hashedNonce)
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                Log.d(tag, "Invoking Android Credential Manager Bottom Sheet...")
                val result: GetCredentialResponse = credentialManager.getCredential(
                    request = request,
                    context = activity
                )

                handleCredentialResponse(result, rawNonce)
            } catch (e: GetCredentialCancellationException) {
                Log.w(tag, "User cancelled Google Sign-In", e)
                sendGoogleAuthResult(
                    success = false,
                    cancelled = true,
                    error = "Google Sign-In was cancelled by user."
                )
            } catch (e: GetCredentialException) {
                Log.e(tag, "Credential Manager error: ${e.message}", e)
                sendGoogleAuthResult(
                    success = false,
                    error = e.message ?: "Authentication error"
                )
            } catch (e: Exception) {
                Log.e(tag, "Unexpected Google Sign-In error: ${e.message}", e)
                sendGoogleAuthResult(
                    success = false,
                    error = e.message ?: "An unexpected error occurred during Google sign-in."
                )
            }
        }

        val pendingResponse = JSONObject().apply {
            put("status", "pending")
            put("message", "Google account picker displayed")
        }
        return pendingResponse.toString()
    }

    private fun handleCredentialResponse(response: GetCredentialResponse, rawNonce: String) {
        val credential = response.credential
        if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            try {
                val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                val idToken = googleIdTokenCredential.idToken
                val email = googleIdTokenCredential.id
                val displayName = googleIdTokenCredential.displayName
                val photoUrl = googleIdTokenCredential.profilePictureUri?.toString()

                Log.d(tag, "Google Sign-In Success! Received ID Token for account: $email")

                sendGoogleAuthResult(
                    success = true,
                    idToken = idToken,
                    nonce = rawNonce,
                    email = email,
                    displayName = displayName,
                    photoUrl = photoUrl
                )
            } catch (e: Exception) {
                Log.e(tag, "Failed to parse Google ID token credential", e)
                sendGoogleAuthResult(
                    success = false,
                    error = "Failed to parse Google credential: ${e.message}"
                )
            }
        } else {
            Log.e(tag, "Unexpected credential type returned: ${credential::class.java.name}")
            sendGoogleAuthResult(
                success = false,
                error = "Unexpected credential format received."
            )
        }
    }

    private fun sendGoogleAuthResult(
        success: Boolean,
        idToken: String? = null,
        nonce: String? = null,
        email: String? = null,
        displayName: String? = null,
        photoUrl: String? = null,
        error: String? = null,
        cancelled: Boolean = false
    ) {
        val json = JSONObject().apply {
            put("success", success)
            if (idToken != null) put("idToken", idToken)
            if (nonce != null) put("nonce", nonce)
            if (email != null) put("email", email)
            if (displayName != null) put("displayName", displayName)
            if (photoUrl != null) put("photoUrl", photoUrl)
            if (error != null) put("error", error)
            if (cancelled) put("cancelled", true)
        }

        val jsonString = json.toString()
        mainHandler.post {
            // Send to window.onNativeGoogleSignInResult
            val script = """
                if (typeof window.onNativeGoogleSignInResult === 'function') {
                    window.onNativeGoogleSignInResult($jsonString);
                } else if (${success} && typeof window.onNativeGoogleSignInSuccess === 'function') {
                    window.onNativeGoogleSignInSuccess('${idToken ?: ""}', '${nonce ?: ""}');
                } else if (!${success} && typeof window.onNativeGoogleSignInFailure === 'function') {
                    window.onNativeGoogleSignInFailure('${error ?: "Failed"}');
                }
            """.trimIndent()

            webView.evaluateJavascript(script, null)
        }
    }

    // =========================================================================
    // 2. BIOMETRIC PROMPT (FINGERPRINT / FACE UNLOCK)
    // =========================================================================

    @JavascriptInterface
    fun isBiometricSupported(): Boolean {
        val biometricManager = BiometricManager.from(activity)
        val canAuthenticate = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK
        )
        return canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS
    }

    @JavascriptInterface
    fun isBiometricEnabled(): Boolean {
        val prefs = activity.getSharedPreferences("trackbook_prefs", Context.MODE_PRIVATE)
        return prefs.getBoolean("biometric_enabled", false)
    }

    @JavascriptInterface
    fun enableBiometric(): String {
        val result = JSONObject()
        if (!isBiometricSupported()) {
            result.put("success", false)
            result.put("error", "Biometric authentication is not supported or not enrolled on this device.")
            return result.toString()
        }

        mainHandler.post {
            showBiometricPrompt(
                title = "Enable Fingerprint Unlock",
                subtitle = "Verify your fingerprint to enable quick login for TrackBook",
                onSuccess = {
                    val prefs = activity.getSharedPreferences("trackbook_prefs", Context.MODE_PRIVATE)
                    prefs.edit().putBoolean("biometric_enabled", true).apply()
                    notifyBiometricResult(true)
                },
                onError = { err ->
                    notifyBiometricResult(false, err)
                }
            )
        }

        result.put("status", "pending")
        return result.toString()
    }

    @JavascriptInterface
    fun disableBiometric(): Boolean {
        val prefs = activity.getSharedPreferences("trackbook_prefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("biometric_enabled", false).apply()
        return true
    }

    @JavascriptInterface
    fun openBiometricSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS)
            activity.startActivity(intent)
        } catch (e: Exception) {
            Log.e(tag, "Could not open security settings", e)
        }
    }

    private fun showBiometricPrompt(
        title: String,
        subtitle: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        val executor = ContextCompat.getMainExecutor(activity)
        val prompt = BiometricPrompt(
            activity,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    onSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    onError(errString.toString())
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    // Prompt handles retry internally
                }
            }
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Cancel")
            .build()

        prompt.authenticate(promptInfo)
    }

    private fun notifyBiometricResult(success: Boolean, error: String? = null) {
        mainHandler.post {
            val script = """
                if (typeof window.onBiometricResult === 'function') {
                    window.onBiometricResult(${success}, ${if (error != null) "'$error'" else "null"});
                }
            """.trimIndent()
            webView.evaluateJavascript(script, null)
        }
    }

    // =========================================================================
    // 3. HARDWARE-BACKED KEYSTORE TPIN STORAGE
    // =========================================================================

    private val keyAlias = "TrackBookSecureKey"
    private val keyStoreType = "AndroidKeyStore"

    @JavascriptInterface
    fun saveSecureMpin(userId: String, hash: String): Boolean {
        return try {
            val secretKey = getOrCreateSecretKey()
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)
            val iv = cipher.iv
            val encryptedBytes = cipher.doFinal(hash.toByteArray(Charsets.UTF_8))

            val combined = ByteArray(iv.size + encryptedBytes.size)
            System.arraycopy(iv, 0, combined, 0, iv.size)
            System.arraycopy(encryptedBytes, 0, combined, iv.size, encryptedBytes.size)

            val base64Data = Base64.encodeToString(combined, Base64.NO_WRAP)
            val prefs = activity.getSharedPreferences("trackbook_mpin_store", Context.MODE_PRIVATE)
            prefs.edit().putString("mpin_$userId", base64Data).apply()
            true
        } catch (e: Exception) {
            Log.e(tag, "saveSecureMpin error", e)
            false
        }
    }

    @JavascriptInterface
    fun getSecureMpin(userId: String): String? {
        return try {
            val prefs = activity.getSharedPreferences("trackbook_mpin_store", Context.MODE_PRIVATE)
            val base64Data = prefs.getString("mpin_$userId", null) ?: return null

            val combined = Base64.decode(base64Data, Base64.NO_WRAP)
            val iv = combined.copyOfRange(0, 12)
            val encryptedBytes = combined.copyOfRange(12, combined.size)

            val secretKey = getOrCreateSecretKey()
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

            val decrypted = cipher.doFinal(encryptedBytes)
            String(decrypted, Charsets.UTF_8)
        } catch (e: Exception) {
            Log.e(tag, "getSecureMpin error", e)
            null
        }
    }

    @JavascriptInterface
    fun hasSecureMpin(userId: String): Boolean {
        val prefs = activity.getSharedPreferences("trackbook_mpin_store", Context.MODE_PRIVATE)
        return prefs.contains("mpin_$userId")
    }

    @JavascriptInterface
    fun removeSecureMpin(userId: String): Boolean {
        val prefs = activity.getSharedPreferences("trackbook_mpin_store", Context.MODE_PRIVATE)
        prefs.edit().remove("mpin_$userId").apply()
        return true
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(keyStoreType).apply { load(null) }
        if (keyStore.containsAlias(keyAlias)) {
            val entry = keyStore.getEntry(keyAlias, null) as KeyStore.SecretKeyEntry
            return entry.secretKey
        }

        val keyGenerator = KeyGenerator.getInstance(
            android.security.keystore.KeyProperties.KEY_ALGORITHM_AES,
            keyStoreType
        )
        val keyGenSpec = android.security.keystore.KeyGenParameterSpec.Builder(
            keyAlias,
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()

        keyGenerator.init(keyGenSpec)
        return keyGenerator.generateKey()
    }

    // =========================================================================
    // 4. APP CONTROLS & ENVIRONMENT
    // =========================================================================

    @JavascriptInterface
    fun isNativeApp(): Boolean {
        return true
    }

    @JavascriptInterface
    fun getPlatform(): String {
        return "android"
    }

    @JavascriptInterface
    fun exitApp() {
        activity.finishAffinity()
    }

    // =========================================================================
    // CRYPTO HELPERS
    // =========================================================================

    private fun generateSecureNonce(): String {
        val random = SecureRandom()
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun hashNonce(rawNonce: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(rawNonce.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
