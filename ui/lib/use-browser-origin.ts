import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;
const getServerSnapshot = () => null;
const getSnapshot = () => window.location.origin;

export const useBrowserOrigin = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
