/** Remove search params from URL */
export function clearUrl(url: URL | string): string {
    url = new URL(url);
    url.search = "";
    return url.toString();
}

export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T | null> {
    const timeout = new Promise<null>((resolve) =>
        setTimeout(() => {
            resolve(null);
        }, ms),
    );
    return Promise.race([promise, timeout]);
}

export function onElementToOff<K extends keyof DocumentEventMap>(
    element: Document,
    type: K,
    selector: string,
    listener: (this: Document, ev: DocumentEventMap[K], delegateTarget: HTMLElement) => unknown,
    options?: AddEventListenerOptions,
) {
    element.on(type, selector, listener, options);

    return () => {
        element.off(type, selector, listener, options);
    };
}
