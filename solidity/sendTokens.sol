import "../libraries/system_instruction.sol";
import "solana";

// Interface to the token program.
tokenInterface constant tokenProgram = tokenInterface(address'7HPfSHmT2VUsHf6JA1UrEjXkgnBLSVn95wexLsNKWVRZ');
interface tokenInterface {
    function transferTokens(address from, address to, uint64 amount) external;
}

@program_id("Bozf7oMUxHqwPYsh7kLvNgJdBFFYVDDKvMKTYz7kGW8R")
contract sendTokens {

    @payer(payer)
    @seed("newseed_pda")
    constructor(@bump bytes1 bump, uint64 fundLamports) {
        // Independently derive the PDA address from the seeds, bump, and programId
        (address pda, bytes1 _bump) = try_find_program_address(["newseed_pda"], type(sendTokens).program_id);

        // Verify that the bump passed to the constructor matches the bump derived from the seeds and programId
        // This ensures that only the canonical pda address can be used to create the account (first bump that generates a valid pda address)
        require(bump == _bump, 'INVALID_BUMP');
        // Fund the pda account with additional lamports
        SystemInstruction.transfer(
            tx.accounts.payer.key, // from
            address(this), // to (the address of the account being created)
            fundLamports // amount of lamports to transfer
        );
    }

    // Transfer SOL from one account to another using CPI (Cross Program Invocation) to the System program
    function transferSolWithCpi(uint64 lamports) public {
        AccountInfo from = tx.accounts[0]; // first account must be an account owned by the program
        AccountInfo to = tx.accounts[1]; // second account must be the intended recipient

        print("From: {:}".format(from.key));
        print("To: {:}".format(to.key));

        from.lamports -= lamports;
        to.lamports += lamports;
    }


    // Transfer tokens from one token account to another via Cross Program Invocation to Token Program
    function transferTokensToUser(
        address dataAccount,
        address from,
        address to, // token account to transfer to
        uint64 amount // amount to transfer
    ) public {
        // The account required by the switchPower instruction.
        // This is the data account created by the token program (not this program), which stores the state of the switch.
        AccountMeta[1] metas = [
            AccountMeta({pubkey: dataAccount, is_writable: true, is_signer: false})
        ];


        // Invoke the switchPower instruction on the token program.
        tokenProgram.transferTokens{accounts: metas}(from, to, amount);
    }
}
