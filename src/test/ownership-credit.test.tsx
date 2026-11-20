import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OwnershipCredit } from "@/components/ownership-credit";

const LOGO_SRC = "/__l5e/assets-v1/8c17a8f4-2e23-4736-81e1-b2a88417907d/single-cell-films-logo.png";
const MARK_SRC = "/__l5e/assets-v1/737b8675-a49a-4d7c-a3b5-8b94bfce27ca/single-cell-films-reel.png";

describe("Copyright and ownership credit", () => {
  it("credits Fiona Graham and Single Cell Films LTD in the full credit", () => {
    render(<OwnershipCredit />);

    const credit = screen.getByRole("region", { name: /copyright & ownership/i });

    expect(credit.textContent).toContain("Fiona Graham");
    expect(credit.textContent).toContain("Single Cell Films LTD");
    expect(credit.textContent).toContain("© 2026");
    expect(credit.textContent).toContain("All rights reserved");
    expect(screen.getByRole("img", { name: "Single Cell Films LTD logo" })).toHaveAttribute(
      "src",
      LOGO_SRC,
    );
  });

  it("names the company in the compact status-bar credit", () => {
    render(<OwnershipCredit compact />);

    const credit = screen.getByTitle("Copyright and ownership");

    expect(credit.textContent).toContain("Fiona Graham");
    expect(credit.textContent).toContain("Single Cell Films LTD");
    expect(credit.querySelector("img")).toHaveAttribute("src", MARK_SRC);
  });
});
