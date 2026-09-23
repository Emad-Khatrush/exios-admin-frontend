// Accounts allowed to edit or delete wallet statements, must match STATEMENT_MANAGER_IDS in the API
export const STATEMENT_MANAGER_IDS = ['69deb74c4b5e921e7416ea11', '6aa99588ae35416174639238'];

export const canManageStatements = (account: any) => STATEMENT_MANAGER_IDS.includes(String(account?._id));
