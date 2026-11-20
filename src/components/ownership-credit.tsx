type OwnershipCreditProps = {
  compact?: boolean;
};

export function OwnershipCredit({ compact = false }: OwnershipCreditProps) {
  if (compact) {
    return (
      <span className="ownership-credit ownership-compact" title="Copyright and ownership">
        © 2026 Fiona Graham · Owner
      </span>
    );
  }

  return (
    <section className="ownership-credit" aria-labelledby="ownership-title">
      <span className="ownership-label" id="ownership-title">
        Copyright &amp; ownership
      </span>
      <p>© 2026 Fiona Graham. All rights reserved.</p>
      <p>ptzIP is owned by Fiona Graham.</p>
    </section>
  );
}
