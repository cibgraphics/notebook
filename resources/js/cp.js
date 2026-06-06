import Index from './pages/Index.vue';
import Settings from './pages/Settings.vue';
import { installCollectionPanel } from './collection-panel';

Statamic.booting(() => {
    if (window.__notebookCpInstalled) return;

    window.__notebookCpInstalled = true;

    Statamic.$inertia.register('notebook::Index', Index);
    Statamic.$inertia.register('notebook::Settings', Settings);
    installCollectionPanel();
});
