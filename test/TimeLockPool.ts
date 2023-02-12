import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } from "constants";
import { BigNumber, constants } from "ethers";
import hre from "hardhat";
import { TestToken__factory, TimeLockPool__factory,  TestNFT__factory} from "../typechain";
import { TestToken } from "../typechain";
import { TimeLockPool } from "../typechain/TimeLockPool";
import { TestNFT } from "../typechain";
import TimeTraveler from "../utils/TimeTraveler";

const ESCROW_DURATION = 60 * 60 * 24 * 365;
const ESCROW_PORTION = parseEther("0.77");
const MAX_BONUS = parseEther("5");
const MAX_LOCK_DURATION = 60 * 60 * 24 * 365 * 5;
const INITIAL_MINT = parseEther("1000000");

describe("TimeLockPool", function () {

    let deployer: SignerWithAddress;
    let account1: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let account4: SignerWithAddress;
    let account5: SignerWithAddress;
    let signers: SignerWithAddress[];

    let timeLockPool: TimeLockPool;
    let escrowPool: TimeLockPool;
    let depositToken: TestToken;
    let rewardToken: TestToken;
    let depositNFT: TestNFT;
    let depositNFT5: TestNFT;

    let timeLockPool4: TimeLockPool;
    let timeLockPool5: TimeLockPool;
    let timeLockPoolDeployer: TimeLockPool;

    let startTime = 1676584800;
    
    const timeTraveler = new TimeTraveler(hre.network.provider);
    const CURVE = [
        (0*1e18).toString(),
        (0.65*1e18).toString(),
        (1.5*1e18).toString(),
        (3*1e18).toString(),
        (5*1e18).toString()
    ]
    const escrowCURVE = [
        (0).toString(),
        (0).toString()
    ]

    before(async() => {
        [
            deployer,
            account1,
            account2,
            account3,
            account4,
            account5,
            ...signers
        ] = await hre.ethers.getSigners();

        const testTokenFactory = await new TestToken__factory(deployer);
        const testNFTFactory = await new TestNFT__factory(deployer);

        depositToken = await testTokenFactory.deploy("DPST", "Deposit Token");
        rewardToken = await testTokenFactory.deploy("RWRD", "Reward Token");
        depositNFT = await testNFTFactory.deploy();

        await depositToken.mint(account1.address, INITIAL_MINT);
        await rewardToken.mint(account1.address, INITIAL_MINT);
        await rewardToken.mint(deployer.address, INITIAL_MINT);
        
        await depositNFT.mintPosition(account4.address, parseEther("1000"), 1676220651)
        await depositNFT.mintPosition(account4.address, parseEther("1000"), 1776220651)
        await depositNFT.mintPosition(account5.address, parseEther("1000"), 1676584801)

        const timeLockPoolFactory = new TimeLockPool__factory(deployer);
        
        escrowPool = await timeLockPoolFactory.deploy(
            "ESCROW",
            "ESCRW",
            rewardToken.address,
            constants.AddressZero,
            constants.AddressZero,
            constants.AddressZero,
            0,
            0,
            0,
            ESCROW_DURATION,
            escrowCURVE
        );

        timeLockPool = await timeLockPoolFactory.deploy(
            "Staking Pool",
            "STK",
            depositToken.address,
            depositNFT.address,
            rewardToken.address,
            escrowPool.address,
            ESCROW_PORTION,
            ESCROW_DURATION,
            MAX_BONUS,
            MAX_LOCK_DURATION,
            CURVE
        );

        await rewardToken.approve(timeLockPool.address, constants.MaxUint256);
        const govRole = await timeLockPool.GOV_ROLE()
        await timeLockPool.grantRole(govRole, deployer.address);

        // connect account1 to all contracts
        timeLockPool = timeLockPool.connect(account1);
        escrowPool = escrowPool.connect(account1);
        depositToken = depositToken.connect(account1);
        rewardToken = rewardToken.connect(account1);
        depositNFT = depositNFT.connect(account4)
        depositNFT5 = depositNFT.connect(account5)
        timeLockPool4 = timeLockPool.connect(account4);
        timeLockPool5 = timeLockPool.connect(account5);
        timeLockPoolDeployer = timeLockPool.connect(deployer);
        
        await depositToken.approve(timeLockPool.address, constants.MaxUint256);
        await depositNFT.setApprovalForAll(timeLockPool.address, true);
        await depositNFT5.setApprovalForAll(timeLockPool.address, true);

        await timeTraveler.snapshot();
    })

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    })


    describe("deposit", async() => {

        const DEPOSIT_AMOUNT = parseEther("10");

        it("Depositing with no lock should lock it for 10 minutes to prevent flashloans", async() => {
            await timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
            const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();
            const deposit = await timeLockPool.depositsOf(account3.address, 0);
            const duration = await deposit.end.sub(deposit.start);
            expect(duration).to.eq(MIN_LOCK_DURATION);
        });

        it("Deposit with no lock", async() => {
            const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
            await timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
            const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

            const deposit = await timeLockPool.depositsOf(account3.address, 0);
            const depositCount = await timeLockPool.getDepositsOfLength(account3.address);
            const blockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
            const totalDeposit = await timeLockPool.getTotalDeposit(account3.address);
            const timeLockPoolBalance = await timeLockPool.balanceOf(account3.address)
            const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();

            const multiplier = await timeLockPool.getMultiplier(MIN_LOCK_DURATION);

            expect(deposit.amount).to.eq(DEPOSIT_AMOUNT);
            expect(deposit.start).to.eq(blockTimestamp);
            expect(deposit.end).to.eq(BigNumber.from(blockTimestamp).add(MIN_LOCK_DURATION));
            expect(depositCount).to.eq(1);
            expect(totalDeposit).to.eq(DEPOSIT_AMOUNT);
            expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(multiplier).div(constants.WeiPerEther));
            expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT));
        });
        it("Trying to lock for longer than max duration should lock for max duration", async() => {
            const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
            await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
            const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

            const deposit = await timeLockPool.depositsOf(account3.address, 0);
            const depositCount = await timeLockPool.getDepositsOfLength(account3.address);
            const blockTimestamp = (await hre.ethers.provider.getBlock("latest")).timestamp;
            const totalDeposit = await timeLockPool.getTotalDeposit(account3.address);
            const timeLockPoolBalance = await timeLockPool.balanceOf(account3.address);

            expect(deposit.amount).to.eq(DEPOSIT_AMOUNT);
            expect(deposit.start).to.eq(blockTimestamp);
            expect(deposit.end).to.eq(BigNumber.from(blockTimestamp).add(MAX_LOCK_DURATION));
            expect(depositCount).to.eq(1);
            expect(totalDeposit).to.eq(DEPOSIT_AMOUNT);
            expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(constants.WeiPerEther.add(MAX_BONUS)).div(constants.WeiPerEther));

            expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT));
        })
        it("Multiple deposits", async() => {
            const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
            await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
            const blockTimestamp1 = (await hre.ethers.provider.getBlock("latest")).timestamp;
            await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
            const blockTimestamp2 = (await hre.ethers.provider.getBlock("latest")).timestamp;
            const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);

            const deposits = await timeLockPool.getDepositsOf(account3.address);
            const totalDeposit = await timeLockPool.getTotalDeposit(account3.address);
            const timeLockPoolBalance = await timeLockPool.balanceOf(account3.address);

            expect(deposits[0].amount).to.eq(DEPOSIT_AMOUNT);
            expect(deposits[0].start).to.eq(blockTimestamp1);
            expect(deposits[0].end).to.eq(BigNumber.from(blockTimestamp1).add(MAX_LOCK_DURATION));

            expect(deposits[1].amount).to.eq(DEPOSIT_AMOUNT);
            expect(deposits[1].start).to.eq(blockTimestamp2);
            expect(deposits[1].end).to.eq(BigNumber.from(blockTimestamp2).add(MAX_LOCK_DURATION));

            expect(deposits.length).to.eq(2);
            expect(totalDeposit).to.eq(DEPOSIT_AMOUNT.mul(2));
            expect(timeLockPoolBalance).to.eq(DEPOSIT_AMOUNT.mul(2).mul(constants.WeiPerEther.add(MAX_BONUS)).div(constants.WeiPerEther));

            expect(depositTokenBalanceAfter).to.eq(depositTokenBalanceBefore.sub(DEPOSIT_AMOUNT.mul(2)));
        });
        it("Should fail when transfer fails", async() => {
            await depositToken.approve(timeLockPool.address, 0);
            await expect(timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address)).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
        });
    });
    describe("depositPosition", async() => {

        const nftAmount = parseEther("1000");

        it("Depositing NFT should fail with old time", async() => {
            await expect(timeLockPool4.depositPositions(0, 0, account4.address)).to.be.revertedWith("Cannot stake expired positions");
        });

        it("Depositing NFT", async() => {
            await timeLockPool4.depositPositions(1, 0, account4.address);

            const timeLockPoolBalance = await timeLockPool.balanceOf(account4.address)
            const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();

            const multiplier = await timeLockPool.getMultiplier(MIN_LOCK_DURATION);

            expect(timeLockPoolBalance).to.eq(nftAmount.mul(multiplier).div(constants.WeiPerEther));
        });
    describe("distributeAndBurnRewards", async() => {
        const nftAmount = parseEther("1000");
        const rewards = parseEther("1000");
        const DEPOSIT_AMOUNT = parseEther("10");

        it("Depositing NFT", async() => {
            timeTraveler.setNextBlockTimestamp(startTime-86400);
            await timeLockPool.deposit(DEPOSIT_AMOUNT, 0, account3.address);
            await timeLockPool5.depositPositions(2, 0, account5.address);
            const timeLockPoolBalance = await timeLockPool.balanceOf(account5.address);
            const MIN_LOCK_DURATION = await timeLockPool.MIN_LOCK_DURATION();
            const multiplier = await timeLockPool.getMultiplier(MIN_LOCK_DURATION);
            expect(timeLockPoolBalance).to.eq(nftAmount.mul(multiplier).div(constants.WeiPerEther));
            timeTraveler.setNextBlockTimestamp(startTime);
            await timeLockPoolDeployer.distributeRewards(rewards);
            const timeLockPoolBalanceAfter = await timeLockPool.balanceOf(account5.address);
            expect(timeLockPoolBalanceAfter).to.eq(parseEther("0"));
            });
        })
    });
    describe("withdraw", async() => {
        const DEPOSIT_AMOUNT = parseEther("176.378");

        beforeEach(async() => {
            await timeLockPool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address);
        });

        it("Withdraw before expiry should fail", async() => {
            await expect(timeLockPool.withdraw(0, account1.address)).to.be.revertedWith("TimeLockPool.withdraw: too soon");
        });

        it("Should work", async() => {
            await timeTraveler.increaseTime(MAX_LOCK_DURATION);
            await timeLockPool.withdraw(0, account3.address);

            const timeLockPoolBalance = await timeLockPool.balanceOf(account1.address);
            const totalDeposit = await timeLockPool.getTotalDeposit(account1.address);
            const depositTokenBalance = await depositToken.balanceOf(account3.address);

            expect(timeLockPoolBalance).to.eq(0);
            expect(totalDeposit).to.eq(0);
            expect(depositTokenBalance).to.eq(DEPOSIT_AMOUNT);
        });
    });  
});