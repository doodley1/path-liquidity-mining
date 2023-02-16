import { task } from "hardhat/config";

import { LiquidityMiningManager, TimeLockNonTransferablePool, View } from "../../typechain";
import sleep from "../../utils/sleep";
import { constants, utils } from "ethers";
import { parseEther } from "@ethersproject/units";
import { captureRejectionSymbol } from "events";

const PATH = "0x79EAad66077b2Cbe0175dB8aeb759a5aD669d568"; //change
const NFT = "0x67f0260254FB3Cee97dA18077927888Ed72D1f17" //change
// const LP = "0x87051936Dc0669460951d612fBbe93Df88942229"; //change
const multisig = "0x37672dDa85f3cB8dA4098bAAc5D84E00960Cb081"; //change
const source = "0x37672dDa85f3cB8dA4098bAAc5D84E00960Cb081"; //change
const ONE_YEAR = 60 * 60 * 24 * 365;
const FIVE_YEAR = 60 * 60 * 24 * 365 * 5;
const MAX_BONUS = parseEther("7");
// const FOUR_MONTHS = 60 * 60 * 24 * 7 * 17;


// allow NFT to transfer to contract
// set onlyGov to liquidityminingmanager
// set onlygov to timelockpool


const CURVE = [
    parseEther("0"),
    parseEther("0.65"),
    parseEther("1.5"),
    parseEther("3"),
    parseEther("5"),
    parseEther("7")
]

const escrowCURVE = [
    parseEther("0"),
    parseEther("0")
]

task("deploy-liquidity-mining")
    .addFlag("verify")
    .setAction(async(taskArgs, { run, ethers }) => {
    const signers = await ethers.getSigners();
    // const liquidityMiningManager:LiquidityMiningManager = await run("deploy-liquidity-mining-manager", {
    //     rewardToken: PATH,
    //     rewardSource: source, //multi sig is where the rewards will be stored. 
    //     verify: taskArgs.verify
    // });

    // await liquidityMiningManager.deployed();

    const escrowPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
        name: "Escrowed Path v2",
        symbol: "EPATHv2",
        depositToken: PATH,
        depositPosition: NFT,
        rewardToken: PATH, //leaves possibility for xSushi like payouts on staked MC
        escrowPool: constants.AddressZero,
        escrowPortion: "0", //rewards from pool itself are not locked
        escrowDuration: "0", // no rewards escrowed so 0 escrow duration
        maxBonus: "0", // no bonus needed for longer locking durations
        maxLockDuration: (ONE_YEAR * 10).toString(), // Can be used to lock up to 10 years
        curve: escrowCURVE,
        verify: taskArgs.verify
    });

    await escrowPool.deployed();

    const mcPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
        name: "Staked Path v2",
        symbol: "SPATH v2",
        depositToken: PATH, // users stake MC tokens
        depositPosition: NFT,
        rewardToken: PATH, // rewards is MC token
        escrowPool: escrowPool.address, // Rewards are locked in the escrow pool
        escrowPortion: "1", // 100% is locked
        escrowDuration: ONE_YEAR.toString(), // locked for 1 year
        maxBonus: MAX_BONUS, // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
        maxLockDuration: FIVE_YEAR.toString(),
        curve: CURVE,        // Users can lock up to 1 year
        verify: taskArgs.verify
    });

    await mcPool.deployed();

    // no LP pool
    // const mcLPPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
    //     name: "Staked Path Uniswap LP",
    //     symbol: "SPATHULP",
    //     depositToken: LP, // users stake LP tokens
    //     rewardToken: PATH, // rewards is MC token
    //     escrowPool: escrowPool.address, // Rewards are locked in the escrow pool
    //     escrowPortion: "1", // 100% is locked
    //     escrowDuration: ONE_YEAR.toString(), // locked for 1 year
    //     maxBonus: "1", // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
    //     maxLockDuration: FOUR_MONTHS.toString(), // Users can lock up to 4 months
    //     verify: taskArgs.verify
    // });

    // await mcLPPool.deployed();

    // const view:View = await run("deploy-view", {
    //     liquidityMiningManager: liquidityMiningManager.address,
    //     escrowPool: escrowPool.address,
    //     verify: taskArgs.verify
    // });


    // assign gov role to deployer
    const GOV_ROLE = await mcPool.GOV_ROLE();
    // const REWARD_DISTRIBUTOR_ROLE = await liquidityMiningManager.REWARD_DISTRIBUTOR_ROLE();
    // const DEFAULT_ADMIN_ROLE = await liquidityMiningManager.DEFAULT_ADMIN_ROLE();
    // (await (await liquidityMiningManager.grantRole(GOV_ROLE, signers[0].address)).wait(3));
    // (await (await liquidityMiningManager.grantRole(REWARD_DISTRIBUTOR_ROLE, signers[0].address)).wait(3));

    // Add pools
    // console.log("Adding PATH Pool");
    // await (await liquidityMiningManager.addPool(mcPool.address, utils.parseEther("1"))).wait(3);
    // console.log("Adding PATH LP Pool");
    // await (await liquidityMiningManager.addPool(mcLPPool.address, utils.parseEther("0.7"))).wait(3);

    // Assign GOV, DISTRIBUTOR and DEFAULT_ADMIN roles to multisig
    // console.log("setting lmm roles");
    // // renounce gov role from deployer
    // console.log("renouncing gov role");
    // await (await liquidityMiningManager.renounceRole(GOV_ROLE, signers[0].address)).wait(3);
    // console.log("renouncing distributor role");
    // await (await liquidityMiningManager.renounceRole(REWARD_DISTRIBUTOR_ROLE, signers[0].address)).wait(3);
    // console.log("Assigning GOV_ROLE");
    // await (await liquidityMiningManager.grantRole(GOV_ROLE, multisig)).wait(3);
    // console.log("Assigning REWARD_DISTRIBUTOR_ROLE");
    // await (await liquidityMiningManager.grantRole(REWARD_DISTRIBUTOR_ROLE, multisig)).wait(3);
    // console.log("Assigning DEFAULT_ADMIN_ROLE");
    // await (await liquidityMiningManager.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);

    // console.log("Assigning DEFAULT_ADMIN roles on pools");
    // await (await escrowPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);
    await (await mcPool.grantRole(GOV_ROLE, signers[0].address)).wait(3);
    // await (await mcLPPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);

    console.log("DONE");

    console.table({
        // liquidityMiningManager: liquidityMiningManager.address,
        escrowPool: escrowPool.address,
        mcPool: mcPool.address,
        // mcLPPool: mcLPPool.address,
        // view: view.address
    });

    console.log("CHECK IF EVERYTHING IS CORRECTLY SETUP AND THEN RENOUNCE THE DEFAULT_ADMIN_ROLE and pools ON THE liquidityMiningManager CONTRACT FROM THE DEPLOYER ADDRESS");
    console.log("❤⭕");
});