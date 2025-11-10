#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import "CustomWebViewManager.h"
@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"SBSNDSMobileApp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
   [[UIDevice currentDevice] beginGeneratingDeviceOrientationNotifications];
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}
- (UIInterfaceOrientationMask)application:(UIApplication *)application 
  supportedInterfaceOrientationsForWindow:(UIWindow *)window
{
  return UIInterfaceOrientationMaskAll;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
