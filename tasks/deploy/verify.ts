import { task } from "hardhat/config";
import { parseEther } from "ethers/lib/utils";
import { LiquidityMiningManager, TimeLockNonTransferablePool, View } from "../../typechain";
import sleep from "../../utils/sleep";
import { constants, utils } from "ethers";
import { captureRejectionSymbol } from "events";

const PATH = "0x15e99d827c1D2Fc2b9b5312D1e71713c88110BdB"; //change
// const LP = "0x5689edeaa958d22b851ea8cc97dc99e5dcd9ec0c"; //change
// const multisig = "0xaa273E19e0281790116563C979d3b0AD49dD2FcA"; //change
const ONE_YEAR = 60 * 60 * 24 * 365;
const source = "0x37672dDa85f3cB8dA4098bAAc5D84E00960Cb081"; //change

const escrowAddress = "0xfe7574959C595D7a4f7a652F9eCAa420824447ED";
const stakeAddress = "0xca39B5294dfce03721c66F1e29c8e8B9769D05d2";
const viewAddress = "0x07fe1CA6cd45C2fABDa63ABc1bbdE8226Cdf2974";
const liquidityMiningManagerAddress = "0x57CbDb5e05E2d33129d4a39cB8B68c61E6159Bef";
const VERIFY_DELAY = 100000;

task("verify-liquidity-mining")
    .addFlag("verify")
    .setAction(async(taskArgs, { run, ethers }) => {
    const signers = await ethers.getSigners();
    // const liquidityMiningManager:LiquidityMiningManager = await run("deploy-liquidity-mining-manager", {
    //     rewardToken: PATH,
    //     rewardSource: multisig, //multi sig is where the rewards will be stored. 
    //     verify: taskArgs.verify
    // });

    // await liquidityMiningManager.deployed();

    console.log("Verifying TimeLockNonTransferablePool, can take some time")
    await run("verify:verify", {
        address: escrowAddress,
        network: "mumbai",
        constructorArguments: [
            "Escrowed Path",
            "EPATH",
            PATH,
            PATH,
            constants.AddressZero,
            parseEther("0"),
            "0",
            parseEther("0"),
            (ONE_YEAR * 10).toString()
        ]
    });
    console.log("done");

    // const escrowPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
    //     name: "Escrowed Path",
    //     symbol: "EPATH",
    //     depositToken: PATH,
    //     rewardToken: PATH, //leaves possibility for xSushi like payouts on staked MC
    //     escrowPool: constants.AddressZero,
    //     escrowPortion: "0", //rewards from pool itself are not locked
    //     escrowDuration: "0", // no rewards escrowed so 0 escrow duration
    //     maxBonus: "0", // no bonus needed for longer locking durations
    //     maxLockDuration: (ONE_YEAR * 10).toString(), // Can be used to lock up to 10 years
    //     verify: taskArgs.verify
    // });

    // await escrowPool.deployed();

    console.log("Verifying TimeLockNonTransferablePool, can take some time")
    await sleep(VERIFY_DELAY);
    await run("verify:verify", {
        address: stakeAddress,
        network: "mumbai",
        constructorArguments: [
            "Staked Path",
            "SPATH",
            PATH,
            PATH,
            escrowAddress,
            parseEther("1"),
            ONE_YEAR.toString(),
            parseEther("1"),
            ONE_YEAR.toString()
        ]
    });

    // console.log("Verifying View, can take some time")
    // // await sleep(VERIFY_DELAY);
    // await run("verify:verify", {
    //     address: viewAddress,
    //     network: "mumbai",
    //     constructorArguments: [
    //         liquidityMiningManagerAddress,
    //         escrowAddress
    //     ]
    // });

    // const mcPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
    //     name: "Staked Path",
    //     symbol: "SPATH",
    //     depositToken: PATH, // users stake MC tokens
    //     rewardToken: PATH, // rewards is MC token
    //     escrowPool: "0xB1E702Df1f8eA8447002Ac48212c8eACf5cC75F4", // Rewards are locked in the escrow pool
    //     escrowPortion: "1", // 100% is locked
    //     escrowDuration: ONE_YEAR.toString(), // locked for 1 year
    //     maxBonus: "1", // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
    //     maxLockDuration: ONE_YEAR.toString(), // Users can lock up to 1 year
    //     verify: taskArgs.verify
    // });

    // await mcPool.deployed();

    // const mcLPPool:TimeLockNonTransferablePool = await run("deploy-time-lock-non-transferable-pool", {
    //     name: "Staked Path Uniswap LP",
    //     symbol: "SPATHULP",
    //     depositToken: LP, // users stake LP tokens
    //     rewardToken: PATH, // rewards is MC token
    //     escrowPool: "0xfeF45ca3Ce06f127E089BeDf27b7613553ea1eeb", // Rewards are locked in the escrow pool
    //     escrowPortion: "1", // 100% is locked
    //     escrowDuration: ONE_YEAR.toString(), // locked for 1 year
    //     maxBonus: "1", // Bonus for longer locking is 1. When locking for longest duration you'll receive 2x vs no lock limit
    //     maxLockDuration: ONE_YEAR.toString(), // Users can lock up to 1 year
    //     verify: taskArgs.verify
    // });

    // await mcLPPool.deployed();

    // const view:View = await run("deploy-view", {
    //     liquidityMiningManager: "0x0093beA44e21DDf31f33EDfF14C1fE84988C75E6",
    //     escrowPool: "0xfeF45ca3Ce06f127E089BeDf27b7613553ea1eeb",
    //     verify: taskArgs.verify
    // });


    // assign gov role to deployer
    // const GOV_ROLE = await liquidityMiningManager.GOV_ROLE();
    // const REWARD_DISTRIBUTOR_ROLE = await liquidityMiningManager.REWARD_DISTRIBUTOR_ROLE();
    // const DEFAULT_ADMIN_ROLE = await liquidityMiningManager.DEFAULT_ADMIN_ROLE();
    // (await (await liquidityMiningManager.grantRole(GOV_ROLE, signers[0].address)).wait(3));
    // (await (await liquidityMiningManager.grantRole(REWARD_DISTRIBUTOR_ROLE, signers[0].address)).wait(3));

    // // Add pools
    // console.log("Adding PATH Pool");
    // await (await liquidityMiningManager.addPool(mcPool.address, utils.parseEther("0.3"))).wait(3);
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
    // await (await mcPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);
    // await (await mcLPPool.grantRole(DEFAULT_ADMIN_ROLE, multisig)).wait(3);

    console.log("DONE");

    // console.table({
    //     liquidityMiningManager: liquidityMiningManager.address,
    //     escrowPool: escrowPool.address,
    //     mcPool: mcPool.address,
    //     mcLPPool: mcLPPool.address,
    //     view: view.address
    // });

    // console.log("CHECK IF EVERYTHING IS CORRECTLY SETUP AND THEN RENOUNCE THE DEFAULT_ADMIN_ROLE and pools ON THE liquidityMiningManager CONTRACT FROM THE DEPLOYER ADDRESS");
    // console.log("❤⭕");
});