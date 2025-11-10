#import "CustomWebView.h"
#import <React/RCTUtils.h>

@implementation CustomWebView

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        [self setupWebView];
    }
    return self;
}

- (void)setupWebView
{
    // Set the WKUIDelegate to handle fullscreen
    self.webView.UIDelegate = self;
    
    // Enable media playback
    self.webView.configuration.allowsInlineMediaPlayback = YES;
    self.webView.configuration.mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone;
}

#pragma mark - WKUIDelegate

- (void)webView:(WKWebView *)webView
    runJavaScriptAlertPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame
    completionHandler:(void (^)(void))completionHandler
{
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Alert"
                                                                   message:message
                                                            preferredStyle:UIAlertControllerStyleAlert];
    
    UIAlertAction *okAction = [UIAlertAction actionWithTitle:@"OK"
                                                       style:UIAlertActionStyleDefault
                                                     handler:^(UIAlertAction *action) {
                                                         completionHandler();
                                                     }];
    [alert addAction:okAction];
    
    UIViewController *rootViewController = RCTKeyWindow().rootViewController;
    [rootViewController presentViewController:alert animated:YES completion:nil];
}

- (void)webView:(WKWebView *)webView
    runJavaScriptConfirmPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame
    completionHandler:(void (^)(BOOL))completionHandler
{
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Confirm"
                                                                   message:message
                                                            preferredStyle:UIAlertControllerStyleAlert];
    
    UIAlertAction *okAction = [UIAlertAction actionWithTitle:@"OK"
                                                       style:UIAlertActionStyleDefault
                                                     handler:^(UIAlertAction *action) {
                                                         completionHandler(YES);
                                                     }];
    
    UIAlertAction *cancelAction = [UIAlertAction actionWithTitle:@"Cancel"
                                                           style:UIAlertActionStyleCancel
                                                         handler:^(UIAlertAction *action) {
                                                             completionHandler(NO);
                                                         }];
    
    [alert addAction:okAction];
    [alert addAction:cancelAction];
    
    UIViewController *rootViewController = RCTKeyWindow().rootViewController;
    [rootViewController presentViewController:alert animated:YES completion:nil];
}

#pragma mark - Fullscreen Video Support

- (void)webView:(WKWebView *)webView
    didStartProvisionalNavigation:(WKNavigation *)navigation
{
    [super webView:webView didStartProvisionalNavigation:navigation];
}

- (void)webView:(WKWebView *)webView
    didFinishNavigation:(WKNavigation *)navigation
{
    [super webView:webView didFinishNavigation:navigation];
    
    // Inject JavaScript to handle fullscreen requests
    NSString *js = @"document.addEventListener('fullscreenchange', function() {"
                   @"  if (document.fullscreenElement) {"
                   @"    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ENTER_FULLSCREEN'}));"
                   @"  } else {"
                   @"    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'EXIT_FULLSCREEN'}));"
                   @"  }"
                   @"});"
                   @"document.addEventListener('webkitfullscreenchange', function() {"
                   @"  if (document.webkitFullscreenElement) {"
                   @"    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ENTER_FULLSCREEN'}));"
                   @"  } else {"
                   @"    window.ReactNativeWebView.postMessage(JSON.stringify({type: 'EXIT_FULLSCREEN'}));"
                   @"  }"
                   @"});";
    
    [webView evaluateJavaScript:js completionHandler:nil];
}

#pragma mark - Handle Fullscreen Messages from JavaScript

- (void)handleFullscreenEnter
{
    UIViewController *rootViewController = RCTKeyWindow().rootViewController;
    
    // Create fullscreen view controller
    self.fullscreenViewController = [[UIViewController alloc] init];
    self.fullscreenViewController.view.backgroundColor = [UIColor blackColor];
    self.fullscreenViewController.modalPresentationStyle = UIModalPresentationFullScreen;
    
    // Move WebView to fullscreen controller
    [self.webView removeFromSuperview];
    [self.fullscreenViewController.view addSubview:self.webView];
    
    // Set WebView constraints to fill the screen
    self.webView.translatesAutoresizingMaskIntoConstraints = NO;
    [NSLayoutConstraint activateConstraints:@[
        [self.webView.topAnchor constraintEqualToAnchor:self.fullscreenViewController.view.topAnchor],
        [self.webView.bottomAnchor constraintEqualToAnchor:self.fullscreenViewController.view.bottomAnchor],
        [self.webView.leadingAnchor constraintEqualToAnchor:self.fullscreenViewController.view.leadingAnchor],
        [self.webView.trailingAnchor constraintEqualToAnchor:self.fullscreenViewController.view.trailingAnchor]
    ]];
    
    // Present fullscreen
    [rootViewController presentViewController:self.fullscreenViewController
                                     animated:YES
                                   completion:nil];
}

- (void)handleFullscreenExit
{
    if (self.fullscreenViewController) {
        // Move WebView back to original container
        [self.webView removeFromSuperview];
        [self addSubview:self.webView];
        
        // Reset WebView constraints
        self.webView.translatesAutoresizingMaskIntoConstraints = NO;
        [NSLayoutConstraint activateConstraints:@[
            [self.webView.topAnchor constraintEqualToAnchor:self.topAnchor],
            [self.webView.bottomAnchor constraintEqualToAnchor:self.bottomAnchor],
            [self.webView.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
            [self.webView.trailingAnchor constraintEqualToAnchor:self.trailingAnchor]
        ]];
        
        // Dismiss fullscreen
        [self.fullscreenViewController dismissViewControllerAnimated:YES completion:^{
            self.fullscreenViewController = nil;
        }];
    }
}

@end