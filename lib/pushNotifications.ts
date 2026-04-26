import { storageService } from '../services/storageService';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

export const registerDriverPushNotifications = async (driverId: string) => {
  if (!driverId || typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

  const config = await storageService.getPushPublicKey();
  if (!config?.enabled || !config.publicKey) return;

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.register('/sw.js');
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  await storageService.savePushSubscription(driverId, subscription.toJSON());
};
