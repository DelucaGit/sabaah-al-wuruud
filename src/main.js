import './styles/base.css';
import { applyAppearance } from './ui/theme.js';
import { startReminderSync } from './app/reminder-sync.js';
import { start } from './router.js';
import { store } from './adapters/storage.js';

applyAppearance(store.get().settings);
store.subscribe((state) => applyAppearance(state.settings));
startReminderSync();
start(document.getElementById('app'));
