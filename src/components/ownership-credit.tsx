import logoAsset from "@/assets/single-cell-films-logo.png.asset.json";
import reelAsset from "@/assets/single-cell-films-reel.png.asset.json";

const COMPANY_NAME = "Single Cell Films LTD";
const OWNER_NAME = "Fiona Graham";
const COPYRIGHT_YEAR = "2026";
const COMPANY_LOGO = logoAsset.url;
const COMPANY_MARK = reelAsset.url;

type OwnershipCreditProps = {
  compact?: boolean;
};

export function OwnershipCredit({ compact = false }: OwnershipCreditProps) {
  const copyright = `© ${COPYRIGHT_YEAR} ${OWNER_NAME} · ${COMPANY_NAME}`;

  if (compact) {
    return (
      <span className="ownership-credit ownership-compact" title="Copyright and ownership">
        <img className="ownership-logo-sm" src={COMPANY_MARK} alt="" aria-hidden="true" />
        {copyright}
      </span>
    );
  }

  return (
    <section className="ownership-credit" aria-labelledby="ownership-title">
      <span className="ownership-label" id="ownership-title">
        Copyright &amp; ownership
      </span>
      <div className="ownership-body">
        <img className="ownership-logo" src={COMPANY_LOGO} alt={`${COMPANY_NAME} logo`} />
        <div className="ownership-text">
          <p className="ownership-company">{COMPANY_NAME}</p>
          <p>
            {copyright}. All rights reserved.
          </p>
          <p>
            ptzIP is owned by {OWNER_NAME}, {COMPANY_NAME}.
          </p>
        </div>
      </div>
    </section>
  );
}
