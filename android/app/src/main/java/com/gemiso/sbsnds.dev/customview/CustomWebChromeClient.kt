package com.gemiso.sbsnds.dev.customview

import android.app.Activity
import android.graphics.Color
import android.view.View
import android.webkit.WebChromeClient.CustomViewCallback
import android.widget.FrameLayout
import com.reactnativecommunity.webview.RNCWebChromeClient
import com.reactnativecommunity.webview.RNCWebView

class CustomWebChromeClient(webView: RNCWebView,private val activity: Activity) : RNCWebChromeClient(webView) {

    private var customView: View? = null
    private var customViewCallback: CustomViewCallback? = null
    private var fullscreenContainer: FrameLayout? = null

    override fun onShowCustomView(view: View, callback: CustomViewCallback) {
        if (customView != null) {
            callback.onCustomViewHidden()
            return
        }
        customView = view
        customViewCallback = callback

        // Create full-screen container
        fullscreenContainer = FrameLayout(activity).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
            addView(view)
        }
        // Add to decorView for full screen
        (activity.window.decorView as FrameLayout)
            .addView(fullscreenContainer)
    }

    override fun onHideCustomView() {
        fullscreenContainer?.let { container ->
            (activity.window.decorView as FrameLayout).removeView(container)
        }
        customViewCallback?.onCustomViewHidden()
        customView = null
        fullscreenContainer = null
    }
}