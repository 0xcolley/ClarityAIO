# ClarityAIO

ClarityAIO is a Solana protocol farming suite designed to help you manage and optimize your trading, volume farming, and NFT marketplace activities. It integrates several key Solana protocols:

- **Jupiter**: A swap router for trading and volume farming using DCF, swap, and cycle strategies.
- **Zeta**: A perpetuals market configured to trade delta-neutral positions while generating volume.
- **Drift**: Another perpetuals market configured to trade delta-neutral positions while generating volume.
- **Tensor**: An NFT marketplace for automatic position rebalancing for both listings and bids to earn Tensor points.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Jupiter](#jupiter)
- [Zeta](#zeta)
- [Drift](#drift)
- [Tensor](#tensor)
- [Contributing](#contributing)
- [License](#license)

## Installation

To get started with ClarityAIO, clone the repository and install the necessary dependencies.

```bash
git clone https://github.com/0xcolley/ClarityAIO.git
cd ClarityAIO
npm install
```

## Usage

Once you have the dependencies installed, you can run the suite using the following commands:

```bash
node main.js
```

## Configuration

ClarityAIO requires a JSON configuration file to set up the various protocols. Below is an example configuration file:

```json
{
   "private_key": "",
   "main_rpc": "",
   "webhook_url": "",
   "farmer": {
      "long_wallet": "",
      "short_wallet": "",
      "tensor_api_key": ""
   }
}
```

### Configuration Details
private_key: Your private key for authentication.
main_rpc: The main RPC endpoint for the Solana network.
webhook_url: The URL for receiving webhook notifications.
farmer:
long_wallet: The wallet address used for long positions in both perpetual markets.
short_wallet: The wallet address used for short positions in both perpetual markets.
tensor_api_key: Your API key for Tensor.


## Jupiter
Jupiter is used for trading and volume farming. It uses the configurations from the JSON file to optimize swap routes and farming strategies.

## Zeta
Zeta is configured to trade delta-neutral positions in the perpetuals market. It uses the long_wallet and short_wallet addresses for managing positions.

## Drift
Drift is also configured to trade delta-neutral positions in the perpetuals market. It similarly uses the long_wallet and short_wallet addresses for managing positions.

## Tensor
Tensor is used for automatic position rebalancing in the NFT marketplace. It utilizes the tensor_api_key and rebalances listings and bids to earn Tensor points.
