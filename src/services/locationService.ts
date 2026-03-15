import * as Location from 'expo-location';
import { store } from '../redux/store';
import { updateLocation } from '../redux/slices/locationSlice';
import socketService from './socketService';

const LOCATION_TASK_NAME = 'background-location-task';

let TaskManager: any = null;
try {
  TaskManager = require('expo-task-manager');
} catch {
  TaskManager = null;
}

if (TaskManager?.defineTask) {
  TaskManager.defineTask(
    LOCATION_TASK_NAME,
    async ({ data, error }: { data?: unknown; error?: unknown }) => {
      if (error) {
        if (__DEV__) {
          console.error('Background location error:', error);
        }
        return;
      }

      if (!data) {
        return;
      }

      const payload = data as any;
      const locations: Location.LocationObject[] | undefined = payload?.locations;
      const location = Array.isArray(locations) ? locations[0] : undefined;

      if (!location) {
        return;
      }

      store.dispatch(
        updateLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy ?? undefined,
          heading: location.coords.heading ?? undefined,
          speed: location.coords.speed ?? undefined,
          timestamp: typeof location.timestamp === 'number' ? String(location.timestamp) : undefined,
        })
      );

      try {
        if (!socketService.isConnected()) {
          await socketService.connect();
        }
      } catch {
      }

      const state = store.getState() as any;
      const user = state?.auth?.user;
      const booking = state?.booking?.currentBooking;
      const isDriverOnline = Boolean(state?.driver?.isOnline);

      if (!user) {
        return;
      }

      const userType = String(user.userType || '');
      const isDriver = userType === 'DRIVER' || userType === 'BOTH';

      if (isDriver && isDriverOnline) {
        socketService.emit('driver:location-update', {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: typeof location.coords.speed === 'number' ? location.coords.speed : undefined,
          heading: typeof location.coords.heading === 'number' ? location.coords.heading : undefined,
          accuracy: typeof location.coords.accuracy === 'number' ? location.coords.accuracy : undefined,
          bookingId: booking?.id || undefined,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}
class LocationService {
  private isTracking: boolean = false;

  private hasTaskManager(): boolean {
    return Boolean(TaskManager?.defineTask && TaskManager?.isTaskDefinedAsync);
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        return false;
      }

      const state = store.getState() as any;
      const user = state?.auth?.user;
      const userType = String(user?.userType || '');
      const wantsBackground = userType === 'DRIVER' || userType === 'BOTH';

      if (!wantsBackground) {
        return true;
      }

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        return true;
      }

      return true;
    } catch (err) {
      if (__DEV__) {
        console.error('Error requesting location permissions:', err);
      }
      return false;
    }
  }

  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return loc;
    } catch (err) {
      if (__DEV__) {
        console.error('Error getting current location:', err);
      }
      return null;
    }
  }

  async startForegroundTracking(callback: (location: Location.LocationObject) => void) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (loc) => {
          callback(loc);

          store.dispatch(
            updateLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
              heading: loc.coords.heading ?? undefined,
              speed: loc.coords.speed ?? undefined,
              timestamp: typeof loc.timestamp === 'number' ? String(loc.timestamp) : undefined,
            })
          );

          try {
            if (!socketService.isConnected()) {
              await socketService.connect();
            }
          } catch {
          }

          const state = store.getState() as any;
          const booking = state?.booking?.currentBooking;
          if (booking?.id) {
            socketService.emit('customer:location-update', {
              bookingId: booking.id,
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: new Date().toISOString(),
            });
          }
        }
      );

      this.isTracking = true;
      return subscription;
    } catch (err) {
      if (__DEV__) {
        console.error('Error starting foreground tracking:', err);
      }
      this.isTracking = false;
      return null;
    }
  }

  async startBackgroundTracking(): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      if (!this.hasTaskManager()) {
        if (__DEV__) {
          console.error('expo-task-manager is not available; background tracking disabled');
        }
        return false;
      }

      const isTaskDefined = await TaskManager.isTaskDefinedAsync(LOCATION_TASK_NAME);
      if (!isTaskDefined) {
        if (__DEV__) {
          console.error('Background location task is not defined; background tracking disabled');
        }
        return false;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        this.isTracking = true;
        return true;
      }

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'MateDrive - You\'re Online',
          notificationBody: 'Location tracking is active while you\'re online',
          notificationColor: '#34C759',
        },
      });

      this.isTracking = true;
      return true;
    } catch (err) {
      if (__DEV__) {
        console.error('Error starting background tracking:', err);
      }
      this.isTracking = false;
      return false;
    }
  }

  async stopBackgroundTracking(): Promise<void> {
    try {
      if (!this.hasTaskManager()) {
        this.isTracking = false;
        return;
      }

      const isTaskDefined = await TaskManager.isTaskDefinedAsync(LOCATION_TASK_NAME);
      if (!isTaskDefined) {
        this.isTracking = false;
        return;
      }

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('Error stopping background tracking:', err);
      }
    } finally {
      this.isTracking = false;
    }
  }

  isActivelyTracking(): boolean {
    return this.isTracking;
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export default new LocationService();
