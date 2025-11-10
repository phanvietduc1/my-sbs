#import "CustomWebViewManager.h"
#import "CustomWebView.h"
#import <React/RCTUIManager.h>

@implementation CustomWebViewManager

RCT_EXPORT_MODULE(RNCWebView)

- (UIView *)view
{
    CustomWebView *webView = [CustomWebView new];
    return webView;
}

@end