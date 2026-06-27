import { seasonOne } from "@/modules/content/season-1";
import { createCampaignMaps } from "@/modules/game-engine/campaign";

export const previewCapabilities = Object.freeze({
  authentication: false,
  persistence: false,
  ranking: false,
  scoreSubmission: false,
});

export const previewCampaignMaps = createCampaignMaps(
  "hostinger-preview-season-1",
  seasonOne.phases,
);

export const previewRunMap = previewCampaignMaps[0]!.map;
