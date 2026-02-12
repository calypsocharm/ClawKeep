/* viewConfigService stub — ClawKeep fork doesn't use custom view configs */
const EMPTY_CONFIG = { label: '', icon: '', visible: true, order: 0 };

export const viewConfigService = {
    getAllConfigs(): Record<string, typeof EMPTY_CONFIG> { return {}; },
    getCustomViews(): any[] { return []; },
    resetConfig(_viewId: string) { },
    updateConfig(_viewId: string, _config: any) { },
};
