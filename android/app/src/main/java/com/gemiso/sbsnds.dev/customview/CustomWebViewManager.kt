package com.gemiso.sbsnds.dev.customview

import android.webkit.WebView
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ThemedReactContext
import com.reactnativecommunity.webview.RNCWebViewManager
import com.reactnativecommunity.webview.RNCWebViewWrapper

class CustomWebViewManager(reactContext : ReactApplicationContext) : RNCWebViewManager() {

    override fun createViewInstance(reactContext: ThemedReactContext): RNCWebViewWrapper {
        val viewWrapper = super.createViewInstance(reactContext)
        val activity = reactContext.currentActivity
            ?: throw IllegalStateException("No current Activity!")
        viewWrapper.webView.webChromeClient = CustomWebChromeClient(viewWrapper.webView,activity)
        return viewWrapper
    }
    override fun getName(): String = "RNCWebView"

}