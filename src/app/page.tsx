import { VaultShell } from "@/components/shell/VaultShell";
import { VaultKeyGate } from "@/components/vaultkey/VaultKeyGate";

export default function Home() {
  return (
    <VaultKeyGate>
      <VaultShell />
    </VaultKeyGate>
  );
}
