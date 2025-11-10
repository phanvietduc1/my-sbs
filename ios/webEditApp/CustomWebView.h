#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import "react-native-webview/RNCWebView.h"

@interface CustomWebView : RNCWebView <WKUIDelegate>

@property (nonatomic, strong) UIView *customView;
@property (nonatomic, strong) UIViewController *fullscreenViewController;

@end