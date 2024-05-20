import {GenericLoadStep, InjectionManager} from "./Injection/InjectionManager";
import {getMwApi} from "./Utilities/MediaWikiApi";

console.debug('loaded');

// @ts-ignore
globalThis.getMwApi = getMwApi;

const manager = new InjectionManager();
manager.on(GenericLoadStep.DocumentLoad, () => {
    console.debug('Document loaded');
});
manager.on(GenericLoadStep.MediaWikiStartup, () => {
    const api = getMwApi();
    console.debug(api.config.values.wgTitle);
});
manager.onEditForm((form) => {
    console.debug('form hook');
});

manager.startAgents();