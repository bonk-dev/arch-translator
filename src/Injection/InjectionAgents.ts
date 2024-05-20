export class DocumentLoadAgent {
    start() {
        return new Promise<void>(resolve => {
            window.addEventListener('load', () => {
                resolve();
            });
        })
    }
}

export class StartupLoadAgent {
    private _observer: MutationObserver|null = null;

    start(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.type !== 'childList'
                        || mutation.addedNodes.length <= 0
                        || mutation.target.nodeName !== 'HEAD'
                        || mutation.addedNodes[0].nodeName !== 'SCRIPT') continue;

                    const scriptElement = mutation.addedNodes[0] as HTMLScriptElement;
                    if (scriptElement.src.length <= 0) continue;

                    const srcUrl = new URL(scriptElement.src);
                    const modules = srcUrl.searchParams.get('modules');
                    if (modules === 'startup') {
                        scriptElement.addEventListener('load', () => {
                            resolve();
                        });
                        scriptElement.addEventListener('error', (e) => {
                            reject(e);
                        });

                        this._observer?.disconnect();
                    }
                }
            });
            this._observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }
}