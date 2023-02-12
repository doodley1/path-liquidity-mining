import { parseEther } from "ethers/lib/utils";
import { task } from "hardhat/config";
import { TimeLockNonTransferablePool__factory } from "../../typechain";
import sleep from "../../utils/sleep";

const VERIFY_DELAY = 30000;



const PATH = "0x79EAad66077b2Cbe0175dB8aeb759a5aD669d568"; //change
const NFT = "0xc5076e79C472D96DE42C23C33F8ac42bb94AB925" //change
// const LP = "0x87051936Dc0669460951d612fBbe93Df88942229"; //change
const multisig = "0x37672dDa85f3cB8dA4098bAAc5D84E00960Cb081"; //change
const source = "0x37672dDa85f3cB8dA4098bAAc5D84E00960Cb081"; //change
const ONE_YEAR = 60 * 60 * 24 * 365;
const FIVE_YEAR = 60 * 60 * 24 * 365 * 5;
// const FOUR_MONTHS = 60 * 60 * 24 * 7 * 17;
const MAX_BONUS = parseEther("5");

import { constants, utils } from "ethers";

const CURVE = [
    parseEther("0"),
    parseEther("0.65"),
    parseEther("1.5"),
    parseEther("3"),
    parseEther("5")
]

const escrowCURVE = [
    parseEther("0"),
    parseEther("0")
]

task("deploy-time-lock-non-transferable-pool")
    .addFlag("verify")
    .setAction(async(taskArgs, { ethers, run }) => {
        const signers = await ethers.getSigners();

        console.log("Deploying TimeLockNonTransferablePool");
        const timeLockNonTransferablePool = await (new TimeLockNonTransferablePool__factory(signers[0]).deploy(
            "Staked Path v2",
            "SPATH v2",
            PATH, // users stake MC tokens
            NFT,
            PATH, // rewards is MC token
            "0x7bAbBa7328FD7f2c2B0f9f90080c259B4cb092E4", // Rewards are locked in the escrow pool
            "1", // 100% is locked
            ONE_YEAR.toString(), // locked for 1 year
            MAX_BONUS, // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
            FIVE_YEAR.toString(),
            CURVE
        ));
        console.log(`TimeLockNonTransferablePool deployed at: ${timeLockNonTransferablePool.address}`);

        if(taskArgs.verify) {
            console.log("Verifying TimeLockNonTransferablePool, can take some time")
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: timeLockNonTransferablePool.address,
                network: "mumbai",
                constructorArguments: [
                    "Staked Path v2",
                    "SPATH v2",
                    PATH, // users stake MC tokens
                    NFT,
                    PATH, // rewards is MC token
                    "0x7bAbBa7328FD7f2c2B0f9f90080c259B4cb092E4", // Rewards are locked in the escrow pool
                    "1", // 100% is locked
                    ONE_YEAR.toString(), // locked for 1 year
                    MAX_BONUS, // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
                    FIVE_YEAR.toString(),
                    CURVE
                ]
            });
        }
        console.log("done");

        return timeLockNonTransferablePool;
});



// .addParam("name", "Name of the staking pool")
// .addParam("symbol", "Symbol of the staking pool")
// .addParam("depositToken", "Token which users deposit")
// .addParam("depositPosition", "Position NFT contract")
// .addParam("rewardToken", "Token users will receive as reward")
// .addParam("escrowPool", "Pool used to escrow rewards")
// .addParam("escrowPortion", "Portion being escrowed, 1 == 100%")
// .addParam("escrowDuration", "How long tokens will be escrowed")
// .addParam("maxBonus", "Maximum bonus for locking longer, 1 == 100% bonus")
// .addParam("maxLockDuration", "After how long the bonus is maxed out, in seconds")
// .addParam("curve", "Curve to be added")
// .addFlag("verify")
// .setAction(async(taskArgs, { ethers, run }) => {
//     const signers = await ethers.getSigners();

//     console.log("Deploying TimeLockNonTransferablePool");
//     const timeLockNonTransferablePool = await (new TimeLockNonTransferablePool__factory(signers[0]).deploy(
//         taskArgs.name,
//         taskArgs.symbol,
//         taskArgs.depositToken,
//         taskArgs.depositPosition,
//         taskArgs.rewardToken,
//         taskArgs.escrowPool,
//         parseEther(taskArgs.escrowPortion),
//         taskArgs.escrowDuration,
//         parseEther(taskArgs.maxBonus),
//         taskArgs.maxLockDuration,
//         taskArgs.curve
//     ));
//     console.log(`TimeLockNonTransferablePool deployed at: ${timeLockNonTransferablePool.address}`);

//     if(taskArgs.verify) {
//         console.log("Verifying TimeLockNonTransferablePool, can take some time")
//         await sleep(VERIFY_DELAY);
//         await run("verify:verify", {
//             address: timeLockNonTransferablePool.address,
//             network: "mumbai",
//             constructorArguments: [
//                 taskArgs.name,
//                 taskArgs.symbol,
//                 taskArgs.depositToken,
//                 taskArgs.rewardToken,
//                 taskArgs.escrowPool,
//                 parseEther(taskArgs.escrowPortion),
//                 taskArgs.escrowDuration,
//                 parseEther(taskArgs.maxBonus),
//                 taskArgs.maxLockDuration
//             ]
//         });
//     }
//     console.log("done");

//     return timeLockNonTransferablePool;