import { useEffect, useCallback, useRef } from 'react';
import { VolumeManager } from 'react-native-volume-manager';

interface UseVolumeScrollProps {
  enabled: boolean;
  sensitivity: number;
  onScrollUp: () => void;
  onScrollDown: () => void;
}

export function useVolumeScroll({
  enabled,
  sensitivity,
  onScrollUp,
  onScrollDown,
}: UseVolumeScrollProps) {
  const lastVolumeRef = useRef<number | null>(null);
  const isHandlingRef = useRef(false);

  const handleVolumeChange = useCallback(
    async (newVolume: number) => {
      if (!enabled || isHandlingRef.current) return;
      
      const lastVolume = lastVolumeRef.current;
      
      if (lastVolume !== null) {
        const volumeDiff = newVolume - lastVolume;
        
        if (Math.abs(volumeDiff) > 0.001) {
          isHandlingRef.current = true;
          
          if (volumeDiff > 0) {
            onScrollDown();
          } else {
            onScrollUp();
          }
          
          try {
            await VolumeManager.setVolume(lastVolume, { showUI: false });
          } catch (e) {
          }
          
          setTimeout(() => {
            isHandlingRef.current = false;
          }, 100);
          
          return;
        }
      }
      
      lastVolumeRef.current = newVolume;
    },
    [enabled, onScrollUp, onScrollDown]
  );

  useEffect(() => {
    if (!enabled) return;

    let subscription: any = null;

    const setupListener = async () => {
      try {
        const { volume } = await VolumeManager.getVolume();
        lastVolumeRef.current = volume;
        
        subscription = VolumeManager.addVolumeListener((result) => {
          handleVolumeChange(result.volume);
        });
      } catch (e) {
      }
    };

    setupListener();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [enabled, handleVolumeChange]);

  const getScrollAmount = useCallback(() => {
    const minAmount = 100;
    const maxAmount = 400;
    const normalizedSensitivity = Math.max(10, Math.min(100, sensitivity));
    return minAmount + ((normalizedSensitivity - 10) / 90) * (maxAmount - minAmount);
  }, [sensitivity]);

  return { getScrollAmount };
}
