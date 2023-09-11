import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Token } from "../target/types/token";
import { SendTokens } from "../target/types/SendTokens";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { Metaplex } from "@metaplex-foundation/js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Transfer Tokens", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Create address for data account of the:
  const dataAccountToken = anchor.web3.Keypair.generate(); // Token program
  const dataAccountSendTokens = anchor.web3.Keypair.generate(); // SendTokens program

  const mintKeypair = anchor.web3.Keypair.generate();
  const deployerWallet = provider.wallet as anchor.Wallet;
  const connection = provider.connection;

  // Get the programs
  const programToken = anchor.workspace.Token as Program<Token>;
  const programSendTokens = anchor.workspace.SendTokens as Program<SendTokens>;

  // Token info
  const nftTitle = "Homer NFT";
  const nftSymbol = "HOMR";
  const nftUri =
    "https://raw.githubusercontent.com/solana-developers/program-examples/new-examples/tokens/tokens/.assets/nft.json";

  // Amount of additional lamports to fund the dataAccount with.
  const fundLamports = 1 * anchor.web3.LAMPORTS_PER_SOL;

  // Derive the PDA that will be used to initialize the dataAccount.
  const [dataAccountPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("newseed_pda")],
    programSendTokens.programId
  );
  /* ************************************
                    TESTS
 ************************************ */
  it("Is initialized!", async () => {
    // Creates data account for the Token program
    const tx = await programToken.methods
      .new()
      .accounts({ dataAccount: dataAccountToken.publicKey })
      .signers([dataAccountToken])
      .rpc();
    console.log("Your transaction signature", tx);

    // Creates PDA account for the SendTokens program
    const second_tx = await programSendTokens.methods
      .new([bump], new anchor.BN(fundLamports))
      .accounts({ dataAccount: dataAccountPDA })
      .rpc();
    console.log("Your transaction signature", second_tx);

    const accountInfo = await connection.getAccountInfo(dataAccountPDA);
    console.log("AccountInfo Lamports:", accountInfo.lamports);
  });

  it("Create an SPL Token!", async () => {
    const metaplex = Metaplex.make(connection);
    const metadataAddress = await metaplex
      .nfts()
      .pdas()
      .metadata({ mint: mintKeypair.publicKey });

    // Add your test here.
    const tx = await programToken.methods
      .createTokenMint(
        deployerWallet.publicKey, // payer
        mintKeypair.publicKey, // mint
        deployerWallet.publicKey, // mint authority
        deployerWallet.publicKey, // freeze authority
        metadataAddress, // metadata address
        9, // 0 decimals for NFT
        nftTitle, // NFT name
        nftSymbol, // NFT symbol
        nftUri // NFT URI
      )
      .accounts({ dataAccount: dataAccountToken.publicKey })
      .remainingAccounts([
        {
          pubkey: deployerWallet.publicKey,
          isWritable: true,
          isSigner: true,
        },
        { pubkey: mintKeypair.publicKey, isWritable: true, isSigner: true },
        {
          pubkey: new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"), // Metadata program id
          isWritable: false,
          isSigner: false,
        },
        { pubkey: metadataAddress, isWritable: true, isSigner: false },
        { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isWritable: false, isSigner: false },
      ])
      .signers([mintKeypair])
      .rpc({ skipPreflight: true });
    console.log("Your transaction signature", tx);
  });

  it("Mint some tokens to your wallet!", async () => {
    // Wallet's associated token account address for mint
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerWallet.payer, // payer
      mintKeypair.publicKey, // mint
      deployerWallet.publicKey, // owner
      true //set allowOwnerOffCurve to true so it can find the ATA for a PDA
    );

    const tx = await programToken.methods
      .mintTo(
        deployerWallet.publicKey, // payer
        tokenAccount.address, // associated token account address
        mintKeypair.publicKey, // mint
        deployerWallet.publicKey, // owner of token account
        new anchor.BN(150) // amount to mint
      )
      .accounts({ dataAccount: dataAccountToken.publicKey })
      .remainingAccounts([
        {
          pubkey: deployerWallet.publicKey,
          isWritable: true,
          isSigner: true,
        },
        { pubkey: tokenAccount.address, isWritable: true, isSigner: false },
        { pubkey: mintKeypair.publicKey, isWritable: true, isSigner: false },
        {
          pubkey: SystemProgram.programId,
          isWritable: false,
          isSigner: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isWritable: false,
          isSigner: false,
        },
      ])
      .rpc({ skipPreflight: true });
    console.log("Your transaction signature", tx);

    // Transfer from deployer to PDA

    const PDAtokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerWallet.payer, // payer
      mintKeypair.publicKey, // mint
      dataAccountPDA, // owner
      true
    );

    const second_tx = await programToken.methods
      .mintTo(
        deployerWallet.publicKey, // payer
        PDAtokenAccount.address, // associated token account address
        mintKeypair.publicKey, // mint
        dataAccountPDA, // owner of token account
        new anchor.BN(150) // amount to mint
      )
      .accounts({ dataAccount: dataAccountToken.publicKey })
      .remainingAccounts([
        {
          pubkey: deployerWallet.publicKey,
          isWritable: true,
          isSigner: true,
        },
        { pubkey: PDAtokenAccount.address, isWritable: true, isSigner: false },
        { pubkey: dataAccountPDA, isWritable: true, isSigner: false },
        { pubkey: mintKeypair.publicKey, isWritable: true, isSigner: false },
        {
          pubkey: SystemProgram.programId,
          isWritable: false,
          isSigner: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isWritable: false, isSigner: false },
        {
          pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
          isWritable: false,
          isSigner: false,
        },
      ])
      .rpc({ skipPreflight: true });
    console.log("Your transaction signature", tx);

    const account = await connection.getTokenAccountsByOwner(dataAccountPDA, {
      mint: mintKeypair.publicKey,
    });

    console.log("YO", account.value[0].pubkey.toString());
  });

  it("Transfer some tokens from PDA to wallet by triggering the 'transferTokensToUser' functions!", async () => {
    //Wallet's associated token account address for mint
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerWallet.payer, // payer
      mintKeypair.publicKey, // mint
      deployerWallet.publicKey // owner
    );

    const receipient = anchor.web3.Keypair.generate();
    const receipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      deployerWallet.payer, // payer
      mintKeypair.publicKey, // mint account
      receipient.publicKey // owner account
    );

    const tx = await programSendTokens.methods
      .transferTokensToUser(
        dataAccountToken.publicKey,
        dataAccountPDA,
        receipientTokenAccount.address,
        new anchor.BN(150)
      )
      .accounts({ dataAccount: dataAccountToken.publicKey })
      .remainingAccounts([
        {
          pubkey: deployerWallet.publicKey,
          isWritable: true,
          isSigner: true,
        },
        {
          pubkey: mintKeypair.publicKey,
          isWritable: false,
          isSigner: false,
        },
        {
          pubkey: dataAccountPDA,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: tokenAccount.address,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: receipientTokenAccount.address,
          isWritable: true,
          isSigner: false,
        },
      ])
      .rpc();
    console.log("Your transaction signature", tx);
  });
});
