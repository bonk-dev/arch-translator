import {DocumentLoadAgent, StartupLoadAgent} from "./InjectionAgents";
import {getMwApi} from "../Utilities/MediaWikiApi";

export enum GenericLoadStep {
    /**
     * Fired on document's load event
     */
    DocumentLoad = 0,

    /**
     * Fired when the startup module gets loaded (which means the 'mw' API is active)
     */
    MediaWikiStartup = 1
}
enum SpecialLoadSteps {
    JQueryEditForm = 2
}

type EditFormCallback = (editFormJQuery: JQuery) => any;
type GenericCallbackInfo = {
    fired: boolean
    callbacks: Array<Function>
};
type EditFormCallbackInfo =
    |
    {
        fired: false
        callbacks: Array<EditFormCallback>
        jqueryElement: null
    }
    |
    {
        fired: true
        callbacks: Array<EditFormCallback>
        jqueryElement: JQuery
    };
type Callbacks = {
    [GenericLoadStep.DocumentLoad]: GenericCallbackInfo
    [GenericLoadStep.MediaWikiStartup]: GenericCallbackInfo
    [SpecialLoadSteps.JQueryEditForm]: EditFormCallbackInfo
};

let mediaWikiHookFunction: any = null;
let onHookReady: Function|null = null;

/**
 * Handles all the loading steps like edit form initialization hooks, MediaWiki becoming available etc.
 */
export class InjectionManager {
    private _callbacks: Callbacks = {
        [GenericLoadStep.DocumentLoad]: {
            callbacks: [],
            fired: false
        },
        [GenericLoadStep.MediaWikiStartup]: {
            callbacks: [],
            fired: false
        },
        [SpecialLoadSteps.JQueryEditForm]: {
            callbacks: [],
            fired: false,
            jqueryElement: null
        },
    };
    private _agentsStarted = false;

    public startAgents() {
        onHookReady = () => {
            getMwApi().hook('wikipage.editform')
                .add((jQueryEditForm: JQuery) => {
                    this.fireEditForm(jQueryEditForm);
                });
        };

        if (this._agentsStarted) {
            throw new Error("Agents were already started");
        }
        this._agentsStarted = true;

        const loadAgent = new DocumentLoadAgent();
        loadAgent
            .start()
            .then(() => {
                this.fire(GenericLoadStep.DocumentLoad);
            });

        const startupAgent = new StartupLoadAgent();
        startupAgent.start()
            .then(() => {
                if (getMwApi().hook == null) {
                    console.debug('hook is null. Hijacking mw.hook');

                    // hijacking API properties is much easier than hooking the entire module loading system
                    // trust me
                    Object.defineProperty(getMwApi(), 'hook', {
                        get(): any {
                            return mediaWikiHookFunction;
                        },
                        set(v: any) {
                            mediaWikiHookFunction = v;
                            console.debug("mw.hook hijacked");

                            if (onHookReady != null) {
                                // TODO: I doubt anyone is going to use two injection managers at the same time anyways
                                onHookReady();
                            }
                        }
                    })
                }
                else {
                    console.warn('hook is not null')
                }
            });
    }

    public on(step: GenericLoadStep, callback: Function) {
        if (this._callbacks[step].fired) {
            callback();
        }
        else {
            this._callbacks[step].callbacks.push(callback);
        }
    }

    /**
     * Fired exclusively on edit pages. The manager will pass the JQuery editForm object as the first parameter.
     */
    public onEditForm(callback: EditFormCallback) {
        const info = this._callbacks[SpecialLoadSteps.JQueryEditForm];
        if (info.fired) {
            callback(info.jqueryElement);
        }
        else {
            info.callbacks.push(callback);
        }
    }

    public fire(step: GenericLoadStep) {
        const info = this._callbacks[step];
        for (const callback of info.callbacks) {
            callback();
        }
        info.fired = true;
    }

    public fireEditForm(jqueryEditForm: JQuery) {
        const info = this._callbacks[SpecialLoadSteps.JQueryEditForm];
        info.jqueryElement = jqueryEditForm;

        for (const callback of info.callbacks) {
            callback(jqueryEditForm);
        }

        info.fired = true;
    }
}