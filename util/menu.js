import chalk from 'chalk';
import inquirer from 'inquirer';
import { show_config, update_rpc, update_wallet, return_config, update_webhook, update_zeta_long, update_tensor, update_zeta_short } from './config.js';
import { zeta_farmer } from '../modules/farmer/zeta.js';
import { farm_jup_dca, farm_jup_rotate, farm_jup_volume } from '../modules/farmer/jupiter.js';
import { start_tensor } from '../modules/farmer/tensor.js';
function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function render_farmer(){
  inquirer.prompt([
    {
      type: 'list',
      name: 'farm_mode',
      message: 'Select Mode [Enter to Select]',
      choices: [
        'Tensor', //not done
        'Jupiter', //not done
        'Zeta', //in testing
        'Back',
        new inquirer.Separator(),
      ],
    },
  ])
  .then(answers=> {
    if(answers.farm_mode === 'Tensor'){
        render_tensor();
    }
    if(answers.farm_mode === 'Jupiter'){
        render_jup();
    }
    if(answers.farm_mode === 'Zeta'){
      inquirer.prompt([
        {
        type: 'list',
        name: 'farm_asset',
        message: 'Select Mode [Enter to Select]',
        choices: [
          'APT', //not done
          'ARB', //not done
          'BNB',
          'BTC',
          'ETH',
          'SOL',
          'ONEMBONK',
          'JTO',
          'JUP',
          'TIA', //in testing
          'Back',
          new inquirer.Separator(),
          ],
        },
      ])
      .then((answers) => {
        if(answers.farm_asset === 'Back') {
          console.clear();
          render_menu();
        }
        else {
          let mode = answers.farm_asset;
          inquirer.prompt([
            {
              name: 'amount',
              message: 'Enter the total amount for longing and shorting [IN SOL]:'
            },
          ])
          .then(answers => {
            let amount = answers.amount;
            zeta_farmer(amount, mode);
          });
        }
      })
    }
    if(answers.farm_mode === 'Back'){
      render_menu();
    }
  })
}


/*

*/

function render_config(){
  inquirer.prompt([
    {
      type: 'list',
      name: 'config_settings',
      message: 'Select Option [Enter to Select]',
      choices: [
        'Show Config', //done
        'Edit Config', //in progress
        'Back', //soon
        new inquirer.Separator(),
      ],
    },
  ])
  .then(answers=> {
    if(answers.config_settings === 'Show Config'){
        show_config();
        sleep(5000).then(() =>{
          render_menu();
        });
    }
    if(answers.config_settings === 'Edit Config'){
      inquirer.prompt([
        {
          type: 'list',
          name: 'config_edit',
          message: 'Select Mode [Enter to Select]',
          choices: [
            'Edit Private Key', //done
            'Edit RPC', //in progress
            'Edit Webhook', //soon
            'Edit Zeta Longing Wallet',
            'Edit Zeta Shorting Wallet',
            'Edit Tensor API Key',
            'Back',
            new inquirer.Separator(),
          ],
        },
      ])
      .then(answers=> {
        if(answers.config_edit === 'Edit Private Key'){
          inquirer.prompt([
            {
              name: 'key',
              message: 'Enter New Private Key'
            },
          ])
          .then(answers => {
            if(!(update_wallet(answers.key))){
              console.log('Updated Wallet')
            }
            else {
              console.log('Failed to Update Wallet')
            }
            render_config();
          });
        }
        if(answers.config_edit === 'Edit RPC'){
          inquirer.prompt([
            {
              name: 'rpc',
              message: 'Enter New RPC'
            },
          ])
          .then(answers => {
            if(!(update_rpc(answers.rpc))){
              console.log('Updated RPC')
            }
            else {
              console.log('Failed to Update RPC')
            }
            render_config();
          });
        }
        if(answers.config_edit === 'Edit Webhook'){
          inquirer.prompt([
            {
              name: 'hook',
              message: 'Enter New Webhook'
            },
          ])
          .then(answers => {
            if(!(update_webhook(answers.hook))){
              console.log('Updated Webhook')
            }
            else {
              console.log('Failed to Update Webhook')
            }
            render_config();
          });
        }
        if(answers.config_edit === 'Edit Zeta Longing Wallet'){
          inquirer.prompt([
            {
              name: 'longwallet',
              message: 'Enter New Long Wallet PrivateKey'
            },
          ])
          .then(answers => {
            if(!(update_zeta_long(answers.longwallet))){
              console.log('Updated Zeta Long Wallet')
            }
            else {
              console.log('Failed to Update Long Wallet')
            }
            render_config();
          });
        }
        if(answers.config_edit === 'Edit Zeta Shorting Wallet'){
          inquirer.prompt([
            {
              name: 'shortwallet',
              message: 'Enter New Short Wallet PrivateKey'
            },
          ])
          .then(answers => {
            if(!(update_zeta_short(answers.shortwallet))){
              console.log('Updated Zeta Short Wallet')
            }
            else {
              console.log('Failed to Update Short Wallet')
            }
            render_config();
          });
        }
        if(answers.config_edit === 'Edit Tensor API Key'){
          inquirer.prompt([
            {
              name: 'tensor',
              message: 'Enter New Tensor API Key'
            },
          ])
          .then(answers => {
            if(!(update_tensor(answers.tensor))){
              console.log('Updated Tensor Key')
            }
            else {
              console.log('Failed to Update Tensor Key')
            }
            render_config();
          });
        }
        if(answers.config_edit === 'Back'){
          render_config();
        }
      })
    }
    if(answers.config_settings === 'Back'){
      render_menu();
  }
  })
}


function render_menu() {
    console.log(chalk.cyan(" CCCCC  lll                iii tt            \nCC    C lll   aa aa rr rr      tt    yy   yy \nCC      lll  aa aaa rrr  r iii tttt  yy   yy \nCC    C lll aa  aaa rr     iii tt     yyyyyy \n CCCCC  lll  aaa aa rr     iii  tttt      yy \n                                      yyyyy"))
    console.log("v1.3.7")
   
    inquirer.prompt([
      {
        type: 'list',
        name: 'module',
        message: 'Select Module [Enter to Select]',
        choices: [
          'Farmer', //not done
          'Config', //done
          new inquirer.Separator(),
        ],
      },
    ])
    .then((answers) => {
      if(answers.module === 'Farmer') {
        console.clear();
        console.log(chalk.cyan(" CCCCC  lll                iii tt            \nCC    C lll   aa aa rr rr      tt    yy   yy \nCC      lll  aa aaa rrr  r iii tttt  yy   yy \nCC    C lll aa  aaa rr     iii tt     yyyyyy \n CCCCC  lll  aaa aa rr     iii  tttt      yy \n                                      yyyyy"))
        console.log("v1.3.7")
        render_farmer();
      }
      if(answers.module === 'Sniper') {
        console.clear();
        console.log(chalk.cyan(" CCCCC  lll                iii tt            \nCC    C lll   aa aa rr rr      tt    yy   yy \nCC      lll  aa aaa rrr  r iii tttt  yy   yy \nCC    C lll aa  aaa rr     iii tt     yyyyyy \n CCCCC  lll  aaa aa rr     iii  tttt      yy \n                                      yyyyy"))
        console.log("v1.3.7")
        snipe_menu();
      }
      if(answers.module == 'Config'){
        console.clear();
        console.log(chalk.cyan(" CCCCC  lll                iii tt            \nCC    C lll   aa aa rr rr      tt    yy   yy \nCC      lll  aa aaa rrr  r iii tttt  yy   yy \nCC    C lll aa  aaa rr     iii tt     yyyyyy \n CCCCC  lll  aaa aa rr     iii  tttt      yy \n                                      yyyyy"))
        console.log("v1.3.7")
        render_config();
      }
    });
}


function render_jup() {
  inquirer.prompt([
    {
      type: 'list',
      name: 'jup_mode',
      message: 'Select Mode [Enter to Select]',
      choices: [
        'Volume', //done
        'DCA', //done
        'Cycle Farm',
        'Back',
        new inquirer.Separator(),
      ],
    },
  ])
  .then(answers=> {
    if(answers.jup_mode === 'Volume'){
      inquirer.prompt([
        {
          name: 'amount',
          message: 'Enter the total amount for volume generation [IN SOL]:'
        },
      ])
      .then(answers => {
        farm_jup_volume(answers.amount);
      });
    }
    if(answers.jup_mode === 'DCA'){
      inquirer.prompt([
        {
          name: 'amount',
          message: 'Enter the total amount for DCA [IN SOL]:'
        },
      ])
      .then(answers => {
        farm_jup_dca(answers.amount);
      });
    }
    if(answers.jup_mode === 'Cycle Farm'){
      inquirer.prompt([
        {
          name: 'amount',
          message: 'Enter the total amount for farming [IN SOL]:'
        },
      ])
      .then(answers => {
        farm_jup_rotate(answers.amount);
      });
    }
    if(answers.jup_mode === 'Back'){
      render_menu();
    }
  })
}


function render_tensor() {
  inquirer.prompt([
    {
      name: 'slug',
      message: 'Please enter the farming collection name as it appears on the tensor URL:'
    },
  ])
  .then(answers => {
    var slug = answers.slug
    inquirer.prompt([
      {
        name: 'total',
        message: 'Please enter the total number of positions to be open (half listing, half bids) as EVEN number:'
      },
    ])
    .then(answers => {
      var total = parseInt(answers.total);
      inquirer.prompt([
        {
          type: 'list',
          name: 'tensor_mode',
          message: 'Select Listing Mode [Enter to Select]',
          choices: [
            'ABOVE', //done
            'BELOW', //in progress
            new inquirer.Separator(),
          ],
        },
      ])
      .then(answers=> {
   
        var list_mode = answers.tensor_mode;
        inquirer.prompt([
          {
            name: 'bid_placement',
            message: 'Please enter the desired bid placement spot: (Where your bid will appear in orderbook):'
          },
        ])
        .then(answers=> {
          var bid_placement = answers.bid_placement;
          inquirer.prompt([
            {
              name: 'sleep',
              message: 'Enter the total amount of minutes between rebalances:'
            },
          ])
          .then(answers => {
            var sleep_min = answers.sleep;
              inquirer.prompt([
                {
                  name: 'pct_list',
                  message: 'Enter the amount as a float (0.00-0.99) to list above/below floor:'
                },
              ])
              .then(answers => {
                var pct_list = answers.pct_list
                start_tensor(slug, total, list_mode, sleep_min, bid_placement, pct_list)
              });
            });
          })
          });
        });
      })
     
};






export {render_menu, render_farmer};


/*


*/



