import './styles/base.css';
import { applyTheme } from './ui/theme.js';
import { startReminderSync } from './app/reminder-sync.js';
import { start } from './router.js';
import { store } from './adapters/storage.js';

applyTheme(store.get().settings.theme);
startReminderSync();
start(document.getElementById('app'));
