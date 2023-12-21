//this will be depricated once inquirer is implemented, so probably before it is ever used
const title = ' ▄▄· ▄▄▌   ▄▄▄· ▄▄▄  ▪  ▄▄▄▄▄ ▄· ▄▌\n▐█ ▌▪██•  ▐█ ▀█ ▀▄ █·██ •██  ▐█▪██▌\n██ ▄▄██▪  ▄█▀▀█ ▐▀▀▄ ▐█· ▐█.▪▐█▌▐█▪\n▐███▌▐█▌▐▌▐█ ▪▐▌▐█•█▌▐█▌ ▐█▌· ▐█▀·.\n·▀▀▀ .▀▀▀  ▀  ▀ .▀  ▀▀▀▀ ▀▀▀   ▀ • \n'

export function menu_title() {
    for (let i = 0; i < title.length; i++) {
        process.stdout.write(title[i]);
    }
}

export function menu_snipe_options() {
    console.log('\t\t- If inputs are validated snipe will be sent');
    console.log('\t\t  Be aware of price impact');
}

export function menu_sell_option() {
    console.log('\t\t- Supply will be sold if inputs are correct');
    console.log('\t\t  Be aware of price impact');
}

export function menu_guide() {
    console.log('under construction')
}

export function main_menu() {
    console.log('\t{1} - Snipe Mode');
    console.log('\t{2} - Settings');
    console.log('\t{3} - Exit');
    console.log("\n");
}

export function menu_snipe() {
    console.log('\t{1} - Snipe');
    console.log('\t{2} - Exit Position');
    console.log('\t{3} - Usage');
    console.log('\t{4} - Back');
    console.log("\n");
}

export function menu_settings() {
    console.log('\t[1] - Change RPC');
    console.log('\t[2] - Change Webhook');
    console.log('\t[3] - Change Slippage');
    console.log('\t[4] - Change Wallet');
    console.log('\t[5] - Show Current Settings');
    console.log('\t[6] - Back');
    console.log("\n");
}

const default_export = {
    title
} 

export default default_export;

