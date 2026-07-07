export type CompanyAiLocationCandidateStatus =
  | "READY"
  | "CONFIRMATION_REQUIRED"
  | "NEEDS_DETAILS"
  | "DUPLICATE"
  | "FAILED";

export type CompanyAiLocationCandidate = {
  input: string;
  title: string | null;
  address: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  precision: string | null;
  status: CompanyAiLocationCandidateStatus;
  note: string | null;
  mapPreviewUrl: string | null;
  openTime: string | null;
  closeTime: string | null;
  workingDays: number[] | null;
};

export type CompanyAiLocationsDraft = {
  source: "message" | "website";
  candidates: CompanyAiLocationCandidate[];
  reviewUrl: string | null;
  note: string | null;
};
