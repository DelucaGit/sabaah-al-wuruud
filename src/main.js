import './styles/base.css';
import { applyTheme } from './ui/theme.js';
import { startReminderSync } from './app/reminder-sync.js';
import { start } from './router.js';

applyTheme('system');
startReminderSync();
start(document.getElementById('app'));
