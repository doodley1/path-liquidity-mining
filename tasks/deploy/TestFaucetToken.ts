import { task } from "hardhat/config";
import { StakingPositions__factory, TestFaucetToken__factory } from "../../typechain";
import sleep from "../../utils/sleep";

const VERIFY_DELAY = 30000;

task("deploy-test-faucet-token")
    .addFlag("verify")
    .setAction(async(taskArgs, { ethers, run }) => {
        const signers = await ethers.getSigners();

        console.log("Deploying TestNFT");
        // const testNFTContract = await (new StakingPositions__factory(signers[0])).deploy();
        // console.log(`testNFTContract deployed at ${testNFTContract.address}`);

        if(taskArgs.verify) {
            console.log("Verifying testNFTContract, can take some time")
            // await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: "0x67f0260254FB3Cee97dA18077927888Ed72D1f17",
                contract: "contracts/base/Positions.sol:StakingPositions"
            });
        }
        console.log("done");
});


// .addParam("name")
// .addParam("symbol")
// .addFlag("verify")
// .setAction(async(taskArgs, { ethers, run }) => {
//     const signers = await ethers.getSigners();

//     console.log("Deploying TestFaucetToken");
//     const testFaucetToken = await (new TestFaucetToken__factory(signers[0])).deploy(taskArgs.name, taskArgs.symbol);
//     console.log(`TestFaucetToken deployed at ${testFaucetToken.address}`);

//     if(taskArgs.verify) {
//         console.log("Verifying TestFaucetToken, can take some time")
//         await sleep(VERIFY_DELAY);
//         await run("verify:verify", {
//             address: testFaucetToken.address,
//             constructorArguments: [
//                 taskArgs.name,
//                 taskArgs.symbol
//             ]
//         });
//     }
//     console.log("done");