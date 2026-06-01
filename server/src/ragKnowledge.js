export const RAG_KNOWLEDGE = [
  {
    id: "slowmist-sui-access-control",
    title: "Sui Move access control and authorization",
    source_url: "https://github.com/slowmist/Sui-MOVE-Smart-Contract-Auditing-Primer",
    source_type: "markdown",
    tier: 1,
    vuln_category: "access_control",
    language: "english",
    text:
      "Sui Move entry functions that mutate shared objects must explicitly verify caller authority. Common failures include accepting arbitrary shared registry objects, trusting user supplied addresses, missing capability checks, and allowing anyone to write audit, admin, mint, pause, or configuration records. Prefer capability objects, owner fields, or signed sender checks before state mutation.",
  },
  {
    id: "slowmist-sui-object-ownership",
    title: "Object ownership validation",
    source_url: "https://github.com/slowmist/Sui-MOVE-Smart-Contract-Auditing-Primer",
    source_type: "markdown",
    tier: 1,
    vuln_category: "object_management",
    language: "english",
    text:
      "Sui object security depends on ownership, shared object access, UID freshness, and transfer semantics. Audits should check that functions do not operate on unrelated objects, do not mix objects from different pools or markets, and validate that object owner, parent, or registry membership matches the intended package state.",
  },
  {
    id: "sui-docs-shared-objects",
    title: "Shared object concurrency and state invariants",
    source_url: "https://docs.sui.io/concepts/object-ownership/shared",
    source_type: "markdown",
    tier: 1,
    vuln_category: "shared_objects",
    language: "english",
    text:
      "Shared objects can be accessed by many transactions and must preserve invariants under public entry points. Review every public function that accepts a mutable shared object for missing permission checks, insufficient invariant validation, race-sensitive accounting, and unexpected state transitions across epochs or transaction orderings.",
  },
  {
    id: "move-book-abilities",
    title: "Move abilities and resource safety",
    source_url: "https://github.com/MystenLabs/move-book",
    source_type: "markdown",
    tier: 1,
    vuln_category: "resource_safety",
    language: "english",
    text:
      "Move abilities determine whether values can be copied, dropped, stored, or keyed. Security reviews should inspect structs with key, store, copy, or drop abilities, because excessive abilities can leak capabilities, allow unintended persistence, or weaken resource accounting guarantees.",
  },
  {
    id: "sui-framework-transfer",
    title: "Sui transfer and object transfer patterns",
    source_url: "https://github.com/MystenLabs/sui/tree/main/crates/sui-framework/packages",
    source_type: "move_code",
    tier: 1,
    vuln_category: "transfer",
    language: "move",
    text:
      "Transfer APIs are security boundaries. Audits should flag public functions that transfer owned objects, capabilities, treasury caps, admin caps, or registry-owned resources without authorization. Validate recipient derivation, object type, and whether public_transfer exposes a resource beyond the intended owner.",
  },
  {
    id: "hacken-move-checklist-arithmetic",
    title: "Move arithmetic, precision, and invariant checks",
    source_url: "https://hacken.io/discover/move-smart-contract-audit-checklist/",
    source_type: "html",
    tier: 1,
    vuln_category: "arithmetic",
    language: "english",
    text:
      "Arithmetic review should cover division before multiplication, rounding direction, underflow or overflow assumptions, unchecked casts, fee precision, reward accounting, and conservation of balances. Even with checked arithmetic, economic precision errors can create exploitable value leakage.",
  },
  {
    id: "sui-hot-potato-flashloan",
    title: "Hot potato and flash loan pattern risks",
    source_url: "https://github.com/MystenLabs/move-book",
    source_type: "markdown",
    tier: 2,
    vuln_category: "flash_loan",
    language: "english",
    text:
      "Hot potato values enforce that a caller returns or consumes a temporary resource before transaction end. Flash loan implementations should ensure the loan receipt cannot be forged, copied, dropped, or mismatched, and that repayment validates amount, asset type, pool identity, and fee before releasing state.",
  },
  {
    id: "sui-upgrade-risk",
    title: "Package upgrade and privileged capability risk",
    source_url: "https://docs.sui.io/concepts/sui-move-concepts/packages/upgrade",
    source_type: "markdown",
    tier: 1,
    vuln_category: "upgradeability",
    language: "english",
    text:
      "Upgradeable packages introduce governance and key-management risk. Check whether upgrade capabilities are held by a single wallet, transferred unexpectedly, exposed through public functions, or not documented. Critical shared objects should account for package version and migration compatibility.",
  },
  {
    id: "synthetic-capability-leakage",
    title: "Capability leakage vulnerability pattern",
    source_url: "synthetic://vulnerability-patterns/capability-leakage",
    source_type: "vulnerability_qa",
    tier: 3,
    vuln_category: "capability",
    language: "english",
    text:
      "Vulnerability: capability leakage. Bad pattern: a public function returns, transfers, stores, copies, or exposes an AdminCap, TreasuryCap, Witness, or privileged capability to an arbitrary caller. Good pattern: create capabilities once, transfer to a trusted owner during init, and require a borrowed capability reference for privileged actions.",
  },
  {
    id: "synthetic-unvalidated-severity",
    title: "Unvalidated enum-like input pattern",
    source_url: "synthetic://vulnerability-patterns/input-validation",
    source_type: "vulnerability_qa",
    tier: 3,
    vuln_category: "input_validation",
    language: "english",
    text:
      "Vulnerability: unvalidated enum-like input. Bad pattern: accepting free-form strings or integers for severity, role, status, asset type, or state without checking allowed values. Good pattern: use constrained constants, assert valid ranges, or model values as typed structs so invalid state cannot be recorded.",
  },
  {
    id: "synthetic-registry-spam",
    title: "Public registry spam and false attestations",
    source_url: "synthetic://vulnerability-patterns/registry-attestation",
    source_type: "vulnerability_qa",
    tier: 3,
    vuln_category: "access_control",
    language: "english",
    text:
      "Registry or attestation contracts must distinguish trusted submitters from arbitrary callers. If anyone can submit records for any package, attackers can create false attestations, spam history, or confuse users. Require auditor registration, owner-controlled allowlists, stake, or cryptographic proof before accepting public records.",
  },
];
