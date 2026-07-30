// Tiny in-memory holder for the current signed-in user's vault id, set once
// by AuthGate after sign-in and read by the sync worker / attachment upload
// code. Not persisted — resolved fresh from the auth session on every load.
let currentVaultId: string | null = null;

export function setCurrentVaultId(id: string | null): void {
  currentVaultId = id;
}

export function getCurrentVaultId(): string | null {
  return currentVaultId;
}
