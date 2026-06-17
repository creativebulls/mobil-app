type HomeReselectListener = () => void;

const homeReselectListeners = new Set<HomeReselectListener>();

export function onHomeReselect(listener: HomeReselectListener): () => void {
  homeReselectListeners.add(listener);
  return () => homeReselectListeners.delete(listener);
}

export function emitHomeReselect() {
  homeReselectListeners.forEach((listener) => listener());
}
