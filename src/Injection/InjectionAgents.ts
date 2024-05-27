import {isMwApiReady} from "../Utilities/MediaWikiJsApi";

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
        if (isMwApiReady()) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            const checkScriptElement = (scriptElement: HTMLScriptElement) => {
                const srcUrl = new URL(scriptElement.src);
                const modules = srcUrl.searchParams.get('modules');
                if (modules === 'startup') {
                    scriptElement.addEventListener('load', () => {
                        this._observer?.disconnect();
                        resolve();
                    });
                    scriptElement.addEventListener('error', (e) => {
                        reject(e);
                    });
                }
            };

            const scripts = document.querySelectorAll('script[src]') as NodeListOf<HTMLScriptElement>;
            if (scripts.length > 0) {
                for (const script of scripts) {
                    checkScriptElement(script);
                }
            }

            this._observer = new MutationObserver(mutations => {
                for (const mutation of mutations) {
                    if (mutation.type !== 'childList'
                        || mutation.addedNodes.length <= 0
                        || mutation.target.nodeName !== 'HEAD'
                        || mutation.addedNodes[0].nodeName !== 'SCRIPT') continue;

                    const scriptElement = mutation.addedNodes[0] as HTMLScriptElement;
                    if (scriptElement.src.length <= 0) continue;

                    checkScriptElement(scriptElement)
                }
            });
            this._observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }
}