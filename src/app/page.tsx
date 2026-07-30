import { VaultShell } from "@/components/shell/VaultShell";
import { AuthGate } from "@/components/auth/AuthGate";

export default function Home() {
  return (
    <AuthGate>
      <VaultShell />
    </AuthGate>
  );
}
