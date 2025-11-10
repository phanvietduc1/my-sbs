import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType,
} from '@notifee/react-native';
import { getMessages } from '../constants/Messages';

let _prepared = false;
const CHANNEL_ID = 'download_v2';
const PROGRESS_NOTI_ID = 'download_progress'; // fixed id so we can update the same notification

async function ensurePrepared() {
  if (_prepared) return;

  // Request notification permission on both platforms (Android 13+ requires it)
  await notifee.requestPermission();

  if (Platform.OS === 'android') {
    const messages = getMessages();
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: messages.notification.channelName,
      importance: AndroidImportance.DEFAULT,
    });
  }

  _prepared = true;
}

export const NotificationManager = {
  /** Show an indeterminate "preparing" download notification */
  async showPreparing(filename: string, index?: number, total?: number) {
    await ensurePrepared();

    const messages = getMessages();

    await notifee.displayNotification({
      id: PROGRESS_NOTI_ID,
      title: messages.notification.preparingDownload(index, total),
      body: messages.notification.fileDownload(filename || messages.notification.unknownFile),
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
  },

  /** Update a percentage progress (Android only) */
  async updateProgress(filename: string, progressPercent: number) {
    await ensurePrepared();

    const messages = getMessages();

    await notifee.displayNotification({
      id: PROGRESS_NOTI_ID,
      title: messages.notification.downloading,
      body: messages.notification.fileDownload(filename),
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
  async showSuccess(filename: string, filePath: string) {
    await ensurePrepared();

    const messages = getMessages();

    await notifee.displayNotification({
      id: PROGRESS_NOTI_ID,
      title: messages.notification.downloadComplete,
      body: messages.notification.savedFile(filename),
      android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_notification',
        style: { type: AndroidStyle.BIGTEXT, text: `Path:\n${filePath}` },
        ongoing: false,
        // Tapping the notification body will trigger the same action as the button
        pressAction: { id: 'open_file', launchActivity: 'default' },
        actions: [
          {
            title: messages.notification.openFile,
            pressAction: { id: 'open_file', launchActivity: 'default' },
          },
        ],
      },
      data: { filePath, filename },
    });
  },

  /** Show a failure notification */
  async showError(filename?: string, message?: string) {
    await ensurePrepared();
    const messages = getMessages();
    await notifee.displayNotification({
      id: PROGRESS_NOTI_ID,
      title: messages.notification.downloadFailed,
      body: message || messages.notification.couldNotDownload(filename),
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
