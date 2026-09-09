declare global {
  interface Window {
    PhotoCreative?: {
      record: (entry: Record<string, unknown>) => Record<string, unknown>;
      showTrace: () => void;
    };
  }
}
export const recordRequest = (entry: Record<string, unknown>) => window.PhotoCreative?.record(entry);
export const showRequestTrace = () => window.PhotoCreative?.showTrace();
