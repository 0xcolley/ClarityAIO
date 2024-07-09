import { get_auth_response } from './util/auth.js';
import { render_menu, render_farmer } from './util/menu.js';

function sleep(ms = 0) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    console.clear();
    await get_auth_response();
})();

sleep(2500).then(() => {
    console.clear();
    render_menu();
})
