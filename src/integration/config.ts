export type IntegrationConfig = {
  version: 1;
  gpuBudget: number;
  retireBatch: 5 | 10;
  segmentSize: 3 | 5 | 20;
  enabled: boolean;
  cinematic: boolean;
  entrance: boolean;
  lineup: boolean;
  materialize: boolean;
  followSeconds: number;
  entranceDance: string;
  backgroundDance: string;
  artMode: "BASE" | "CONCERT";
  motion: "OFF" | "SUAVE" | "DINAMICO";
  featured: 10 | 20 | 30;
  intensity: number;
  fixed: boolean;
  ledWall: boolean;
  stagePolish: boolean;
  likeDance: boolean;
  groupDance: boolean;
  idleDance: boolean;
  backgroundNames: "FULL" | "COMPACT" | "OFF";
  profilePhotos: boolean;
  visibleCapacity: 5 | 6 | 8 | 10;
  groupLayout: 'ROWS' | 'ARC';
};
export const integrationDefaults: IntegrationConfig = {
  version: 1,
  gpuBudget: 60,
  retireBatch: 5,
  segmentSize: 3,
  enabled: true,
  cinematic: true,
  entrance: true,
  lineup: true,
  materialize: false,
  followSeconds: 7,
  entranceDance: "MixamoBoxingLoop",
  backgroundDance: "AUTO",
  artMode: "CONCERT",
  motion: "SUAVE",
  featured: 10,
  intensity: 0.6,
  fixed: false,
  ledWall: true,
  stagePolish: true,
  likeDance: true,
  groupDance: true,
  idleDance: true,
  backgroundNames: "FULL",
  profilePhotos: true,
  visibleCapacity: 5,
  groupLayout: 'ROWS',
};
export function integrationConfig(raw: unknown): IntegrationConfig {
  const v = (
    raw && typeof raw === "object" ? raw : {}
  ) as Partial<IntegrationConfig>;
  return {
    ...integrationDefaults,
    gpuBudget: [20,40,60,80,100].includes(v.gpuBudget!) ? v.gpuBudget! : 60,
    retireBatch: v.retireBatch===10 ? 10 : 5,
    segmentSize: [3,5,20].includes(v.segmentSize!) ? v.segmentSize! : 3,
    enabled: typeof v.enabled === "boolean" ? v.enabled : true,
    cinematic: v.cinematic !== false,
    entrance: v.entrance !== false,
    lineup: v.lineup !== false,
    materialize: v.materialize === true,
    followSeconds: [3.5,5,7].includes(v.followSeconds!) ? v.followSeconds! : 7,
    entranceDance: typeof v.entranceDance === "string" && /^[A-Za-z0-9]{1,64}$/.test(v.entranceDance) ? v.entranceDance : "MixamoBoxingLoop",
    backgroundDance: typeof v.backgroundDance === "string" && /^[A-Za-z0-9]{1,64}$/.test(v.backgroundDance) ? v.backgroundDance : "AUTO",
    artMode: v.artMode === "BASE" ? "BASE" : "CONCERT",
    motion: ["OFF", "SUAVE", "DINAMICO"].includes(v.motion!)
      ? v.motion!
      : "SUAVE",
    featured: [10, 20, 30].includes(v.featured!) ? v.featured! : 10,
    intensity: Number.isFinite(v.intensity)
      ? Math.max(0, Math.min(1, v.intensity!))
      : 0.6,
    fixed: v.fixed === true,
    ledWall: v.ledWall !== false,
    stagePolish: v.stagePolish !== false,
    likeDance: v.likeDance !== false,
    groupDance: v.groupDance !== false,
    idleDance: v.idleDance !== false,
    backgroundNames: ["FULL","COMPACT","OFF"].includes(v.backgroundNames!) ? v.backgroundNames! : "FULL",
    profilePhotos: v.profilePhotos !== false,
    visibleCapacity: [5,6,8,10].includes(v.visibleCapacity!) ? v.visibleCapacity! : 5,
    groupLayout: v.groupLayout==='ARC' ? 'ARC' : 'ROWS',
  };
}
export function loadIntegration() {
  try {
    return integrationConfig(
      JSON.parse(localStorage.getItem("LiveDance.integration.rowshow.v1") || "{}"),
    );
  } catch {
    return { ...integrationDefaults };
  }
}
