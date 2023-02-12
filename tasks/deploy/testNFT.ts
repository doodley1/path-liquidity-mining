import { task } from "hardhat/config";
import { StakingPositions__factory } from "../../typechain";
import sleep from "../../utils/sleep";

const VERIFY_DELAY = 30000;

task("deploy-test-nft")
    .addFlag("verify")
    .setAction(async(taskArgs, { ethers, run }) => {
        const signers = await ethers.getSigners();

        console.log("Deploying TestNFT");
        const testNFTContract = await (new StakingPositions__factory(signers[0])).deploy();
        console.log(`testNFTContract deployed at ${testNFTContract.address}`);

        if(taskArgs.verify) {
            console.log("Verifying testNFTContract, can take some time")
            await sleep(VERIFY_DELAY);
            await run("verify:verify", {
                address: testNFTContract.address
            });
        }
        console.log("done");
});