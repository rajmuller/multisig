export type Multisig = {
  version: "0.1.0";
  name: "multisig";
  instructions: [
    {
      name: "initializeNewMultisigWallet";
      accounts: [
        {
          name: "multisigWalletAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "payer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "walletIdx";
          type: "u64";
        },
        {
          name: "owners";
          type: {
            vec: "publicKey";
          };
        },
        {
          name: "threshold";
          type: "u64";
        }
      ];
    },
    {
      name: "proposeTransaction";
      accounts: [
        {
          name: "transactionAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "multisigWalletAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "proposer";
          isMut: true;
          isSigner: true;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        },
        {
          name: "rent";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [
        {
          name: "to";
          type: "publicKey";
        },
        {
          name: "amount";
          type: "u64";
        }
      ];
    },
    {
      name: "approveTransaction";
      accounts: [
        {
          name: "multisigWalletAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "transactionAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "approver";
          isMut: true;
          isSigner: true;
        }
      ];
      args: [];
    },
    {
      name: "executeTransaction";
      accounts: [
        {
          name: "multisigWalletAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "transactionAccount";
          isMut: true;
          isSigner: false;
        },
        {
          name: "recipient";
          isMut: true;
          isSigner: false;
        },
        {
          name: "systemProgram";
          isMut: false;
          isSigner: false;
        }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "multisigWalletState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "idx";
            type: "u64";
          },
          {
            name: "owners";
            type: {
              vec: "publicKey";
            };
          },
          {
            name: "threshold";
            type: "u64";
          },
          {
            name: "proposalCounter";
            type: "u64";
          }
        ];
      };
    },
    {
      name: "transactionState";
      type: {
        kind: "struct";
        fields: [
          {
            name: "multisigWalletAddress";
            type: "publicKey";
          },
          {
            name: "proposalId";
            type: "u64";
          },
          {
            name: "to";
            type: "publicKey";
          },
          {
            name: "amount";
            type: "u64";
          },
          {
            name: "approvers";
            type: {
              vec: "bool";
            };
          },
          {
            name: "didExecute";
            type: "bool";
          }
        ];
      };
    }
  ];
  errors: [
    {
      code: 6000;
      name: "InvalidOwner";
      msg: "The given owner is not part of this wallet.";
    },
    {
      code: 6001;
      name: "InvalidOwnersLen";
      msg: "Owners length must be non zero.";
    },
    {
      code: 6002;
      name: "NotEnoughSigners";
      msg: "Not enough owners signed this transaction.";
    },
    {
      code: 6003;
      name: "AlreadyExecuted";
      msg: "The given transaction has already been executed.";
    },
    {
      code: 6004;
      name: "InvalidThreshold";
      msg: "Threshold must be less than or equal to the number of owners.";
    },
    {
      code: 6005;
      name: "UniqueOwners";
      msg: "Owners must be unique.";
    },
    {
      code: 6006;
      name: "NotEnoughBalance";
      msg: "Not enough balance on the multisig wallet.";
    }
  ];
};

export const IDL: Multisig = {
  version: "0.1.0",
  name: "multisig",
  instructions: [
    {
      name: "initializeNewMultisigWallet",
      accounts: [
        {
          name: "multisigWalletAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "payer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "walletIdx",
          type: "u64",
        },
        {
          name: "owners",
          type: {
            vec: "publicKey",
          },
        },
        {
          name: "threshold",
          type: "u64",
        },
      ],
    },
    {
      name: "proposeTransaction",
      accounts: [
        {
          name: "transactionAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "multisigWalletAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "proposer",
          isMut: true,
          isSigner: true,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
        {
          name: "rent",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: "to",
          type: "publicKey",
        },
        {
          name: "amount",
          type: "u64",
        },
      ],
    },
    {
      name: "approveTransaction",
      accounts: [
        {
          name: "multisigWalletAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "transactionAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "approver",
          isMut: true,
          isSigner: true,
        },
      ],
      args: [],
    },
    {
      name: "executeTransaction",
      accounts: [
        {
          name: "multisigWalletAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "transactionAccount",
          isMut: true,
          isSigner: false,
        },
        {
          name: "recipient",
          isMut: true,
          isSigner: false,
        },
        {
          name: "systemProgram",
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "multisigWalletState",
      type: {
        kind: "struct",
        fields: [
          {
            name: "idx",
            type: "u64",
          },
          {
            name: "owners",
            type: {
              vec: "publicKey",
            },
          },
          {
            name: "threshold",
            type: "u64",
          },
          {
            name: "proposalCounter",
            type: "u64",
          },
        ],
      },
    },
    {
      name: "transactionState",
      type: {
        kind: "struct",
        fields: [
          {
            name: "multisigWalletAddress",
            type: "publicKey",
          },
          {
            name: "proposalId",
            type: "u64",
          },
          {
            name: "to",
            type: "publicKey",
          },
          {
            name: "amount",
            type: "u64",
          },
          {
            name: "approvers",
            type: {
              vec: "bool",
            },
          },
          {
            name: "didExecute",
            type: "bool",
          },
        ],
      },
    },
  ],
  errors: [
    {
      code: 6000,
      name: "InvalidOwner",
      msg: "The given owner is not part of this wallet.",
    },
    {
      code: 6001,
      name: "InvalidOwnersLen",
      msg: "Owners length must be non zero.",
    },
    {
      code: 6002,
      name: "NotEnoughSigners",
      msg: "Not enough owners signed this transaction.",
    },
    {
      code: 6003,
      name: "AlreadyExecuted",
      msg: "The given transaction has already been executed.",
    },
    {
      code: 6004,
      name: "InvalidThreshold",
      msg: "Threshold must be less than or equal to the number of owners.",
    },
    {
      code: 6005,
      name: "UniqueOwners",
      msg: "Owners must be unique.",
    },
    {
      code: 6006,
      name: "NotEnoughBalance",
      msg: "Not enough balance on the multisig wallet.",
    },
  ],
};
