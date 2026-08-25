package xyz.trackbook.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

/**
 * Main Activity for TrackBook Android App
 * 
 * Features:
 * - Native In-App Google Sign-In (via TrackBookBridge & Android Credential Manager)
 * - Hardware BiometricPrompt & Keystore MPIN integration
 * - Camera, Gallery & File Picker WebChromeClient for receipts / documents
 * - Native Download Manager for CSV / PDF / Excel exports
 * - Hardware back-button history navigation
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    // Google Web Client ID (configured in Google Cloud Console & Supabase)
    // Replace with your Web Client ID from Google Cloud Console / Supabase Google Provider
    private val googleWebClientId = "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com"

    // App URL (production URL or local development server)
    private val defaultAppUrl = "https://trackbook.xyz"

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult

        val results: Array<Uri>? = when {
            result.resultCode == RESULT_OK && result.data != null -> {
                val data = result.data
                if (data?.clipData != null) {
                    val count = data.clipData!!.itemCount
                    Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                } else if (data?.data != null) {
                    arrayOf(data.data!!)
                } else {
                    null
                }
            }
            else -> null
        }

        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false
        Log.d("MainActivity", "Camera permission granted: $cameraGranted")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.trackbook_webview)
        progressBar = findViewById(R.id.loading_progress_bar)

        setupWebView()
        setupBackNavigation()
        requestAppPermissions()

        val targetUrl = intent?.dataString ?: defaultAppUrl
        webView.loadUrl(targetUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // Custom User Agent identifier so the Web App knows it is running in TrackBook Native Android
        val defaultUa = settings.userAgentString
        settings.userAgentString = "$defaultUa TrackBookAndroid/2.0 TrackBookNative"

        // Enable Cookies
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // Attach Native JavaScript Bridges
        val bridge = TrackBookBridge(this, webView, googleWebClientId)
        webView.addJavascriptInterface(bridge, "TrackBookAndroid")
        webView.addJavascriptInterface(bridge, "Android")
        webView.addJavascriptInterface(bridge, "TrackBookNative")

        // Setup Clients
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                // Keep app navigation inside WebView
                if (url.startsWith("https://trackbook.xyz") || 
                    url.startsWith("http://localhost") || 
                    url.startsWith("https://ais-")) {
                    return false
                }

                // Handle external links (WhatsApp, Phone, Mail)
                if (url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("whatsapp:") || url.startsWith("https://wa.me/")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        Log.e("MainActivity", "Failed to launch intent for: $url", e)
                    }
                }

                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }

            // File Chooser for Image/Receipt/Document uploads
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }

                try {
                    filePickerLauncher.launch(intent)
                } catch (e: Exception) {
                    Log.e("MainActivity", "Cannot open file chooser", e)
                    fileUploadCallback = null
                    return false
                }
                return true
            }
        }

        // Native Download Listener for PDF, Excel, and CSV Reports
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            try {
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimetype)
                    addRequestHeader("User-Agent", userAgent)
                    setDescription("Downloading TrackBook file...")
                    setTitle(url.substringAfterLast('/'))
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        url.substringAfterLast('/')
                    )
                }

                val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                Toast.makeText(this, "Downloading file...", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e("MainActivity", "Download failed", e)
                Toast.makeText(this, "Download failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val jsCode = """
                    (function() {
                        if (typeof window.TrackBookHandleHardwareBack === 'function') {
                            try {
                                return window.TrackBookHandleHardwareBack();
                            } catch (e) {
                                return 'HANDLED';
                            }
                        }
                        return 'HOME';
                    })()
                """.trimIndent()

                webView.evaluateJavascript(jsCode) { result ->
                    val cleanResult = result?.replace("\"", "")?.trim()
                    if (cleanResult == "HOME") {
                        showQuitDialog()
                    }
                    // If cleanResult is "HANDLED" (or anything else), React handled the back action internally
                }
            }
        })
    }

    private fun showQuitDialog() {
        AlertDialog.Builder(this)
            .setTitle("Exit App?")
            .setMessage("Do you want to exit the application?")
            .setPositiveButton("Exit") { _, _ ->
                finishAffinity()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }
        if (permissions.isNotEmpty()) {
            permissionLauncher.launch(permissions.toTypedArray())
        }
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
