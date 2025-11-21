import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';

let _prepared = false;
const CHANNEL_ID = 'download_v2';
const PROGRESS_NOTI_ID = 'download_progress'; 

function generateNotificationId(): string {
  return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function ensurePrepared() {
  if (_prepared) return;

  // Request notification permission on both platforms (Android 13+ requires it)
  await notifee.requestPermission();

  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'File downloads',
      importance: AndroidImportance.DEFAULT,
    });
  }

  _prepared = true;
}

export const NotificationManager = {
  createDownloadSession(): string {
    return generateNotificationId();
  },

  /** Show an indeterminate "preparing" download notification */
  async showPreparing(filename: string, index?: number, total?: number, notificationId?: string) {
    await ensurePrepared();

    const prefix = index && total ? `(${index}/${total}) ` : '';
    const notiId = notificationId || PROGRESS_NOTI_ID;

    await notifee.displayNotification({
      id: notiId,
      title: `${prefix}Preparing download`,
      body: `File: ${filename || 'unknown...'}`,
      android: {
        channelId: CHANNEL_ID,
        onlyAlertOnce: true,
        smallIcon: 'ic_notification',
        // indeterminate progress while preparing
        progress: { indeterminate: true },
        ongoing: true,
        showTimestamp: true,
      },
      ios: {
        // iOS will show a simple banner/list entry
        foregroundPresentationOptions: {
          banner: true,
          list: true,
          sound: false,
        },
      },
    });

    return notiId;
  },

  /** Update a percentage progress (Android only) */
  async updateProgress(filename: string, progressPercent: number, notificationId?: string) {
    await ensurePrepared();

    const notiId = notificationId || PROGRESS_NOTI_ID;

    await notifee.displayNotification({
      id: notiId,
      title: `Downloading`,
      body: `File: ${filename}`,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        onlyAlertOnce: true,
        progress: {
          max: 100,
          current: Math.max(0, Math.min(100, Math.floor(progressPercent))),
        },
        ongoing: true,
      },
    });
  },

  /** Show success and attach an action to open the file (Android) */
  async showSuccess(filename: string, filePath: string, notificationId?: string) {
    await ensurePrepared();

    const notiId = notificationId || PROGRESS_NOTI_ID;

    const isAndroidDownloads = filePath === '/Downloads' || filePath.includes('Downloads');
    const displayPath = isAndroidDownloads 
      ? 'Saved to Downloads folder' 
      : `Path:\n${filePath}`;

    await notifee.displayNotification({
      id: notiId,
      title: 'Download complete',
      body: `${filename}`,
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        style: { type: AndroidStyle.BIGTEXT, text: displayPath },
        ongoing: false,
        // Tapping the notification body will trigger the same action as the button
        pressAction: { id: 'open_file', launchActivity: 'default' },
        actions: [
          {
            title: 'View in Downloads',
            pressAction: { id: 'open_file', launchActivity: 'default' },
          },
        ],
      },
      data: { filePath, filename },
    });
  },

  /** Show a failure notification */
  async showError(filename?: string, message?: string, notificationId?: string) {
    await ensurePrepared();

    const notiId = notificationId || PROGRESS_NOTI_ID;

    await notifee.displayNotification({
      id: notiId,
      title: 'Download failed',
      body: message || `Could not download: ${filename || 'file'}`,
      android: {
        channelId: CHANNEL_ID,
        onlyAlertOnce: true,
        ongoing: false,
      },
      ios: {
        foregroundPresentationOptions: {
          banner: true,
          list: true,
          sound: true,
        },
      },
    });
  },

  /** Register a foreground handler for the "Open file" action */
  registerForegroundHandler(openFileByPath: (p?: string) => Promise<void> | void) {
    notifee.onForegroundEvent(async ({ type, detail }) => {
      try {
        const id = detail.pressAction?.id;
        const fp = detail.notification?.data?.filePath as string | undefined;

        if ((type === EventType.ACTION_PRESS && id === 'open_file') || type === EventType.PRESS) {
          await openFileByPath(fp);
        }
      } catch (e) {
        console.warn('Foreground handler error:', e);
      }
    });
  },
};
