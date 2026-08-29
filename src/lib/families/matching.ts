export type FamilyMatchCandidate = {
  familyId: string;
  paymentIds: Array<string | null | undefined>;
  guardianEmails: Array<string | null | undefined>;
  guardianPhones: Array<string | null | undefined>;
};

export type FamilyMatchEvidence = {
  paymentId: string | null | undefined;
  guardianEmails: Array<string | null | undefined>;
  guardianPhones: Array<string | null | undefined>;
};

export type FamilyMatchDecision =
  | { kind: "create" }
  | {
      kind: "create_with_review";
      category: "possible_duplicate_family";
      candidateFamilyIds: string[];
    }
  | { kind: "reuse"; familyId: string }
  | {
      kind: "review";
      category: "shared_payment_family_conflict";
      candidateFamilyIds: string[];
    };

function normalizedValues(
  values: Array<string | null | undefined>,
  normalize: (value: string) => string,
): Set<string> {
  return new Set(
    values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .map(normalize)
      .filter(Boolean),
  );
}

function sortedFamilyIds(candidates: FamilyMatchCandidate[]): string[] {
  return [...new Set(candidates.map((candidate) => candidate.familyId))].sort();
}

export function decideFamilyMatch(
  evidence: FamilyMatchEvidence,
  candidates: FamilyMatchCandidate[],
): FamilyMatchDecision {
  const paymentId = evidence.paymentId?.trim();

  if (paymentId) {
    const paymentMatches = candidates.filter((candidate) =>
      candidate.paymentIds.some((value) => value?.trim() === paymentId),
    );
    const familyIds = sortedFamilyIds(paymentMatches);

    if (familyIds.length === 1) {
      return { kind: "reuse", familyId: familyIds[0] };
    }

    if (familyIds.length > 1) {
      return {
        kind: "review",
        category: "shared_payment_family_conflict",
        candidateFamilyIds: familyIds,
      };
    }
  }

  const emails = normalizedValues(evidence.guardianEmails, (value) =>
    value.toLocaleLowerCase("nb-NO"),
  );
  const phones = normalizedValues(evidence.guardianPhones, (value) =>
    value.replace(/[^0-9+]/g, ""),
  );
  const contactMatches = candidates.filter((candidate) => {
    const candidateEmails = normalizedValues(
      candidate.guardianEmails,
      (value) => value.toLocaleLowerCase("nb-NO"),
    );
    const candidatePhones = normalizedValues(
      candidate.guardianPhones,
      (value) => value.replace(/[^0-9+]/g, ""),
    );

    return (
      [...emails].some((email) => candidateEmails.has(email)) ||
      [...phones].some((phone) => candidatePhones.has(phone))
    );
  });
  const candidateFamilyIds = sortedFamilyIds(contactMatches);

  if (candidateFamilyIds.length > 0) {
    return {
      kind: "create_with_review",
      category: "possible_duplicate_family",
      candidateFamilyIds,
    };
  }

  return { kind: "create" };
}
