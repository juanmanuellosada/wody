import type { GymKind } from "@prisma/client";

export function vocab(kind: GymKind): {
  workoutWord: string;
  workoutWordPlural: string;
  recordWord: string;
  placeWord: string;
  placeWordCapitalized: string;
} {
  if (kind === "BOX") {
    return {
      workoutWord: "WOD",
      workoutWordPlural: "WODs",
      recordWord: "RM",
      placeWord: "box",
      placeWordCapitalized: "Box",
    };
  }
  return {
    workoutWord: "rutina",
    workoutWordPlural: "rutinas",
    recordWord: "PR",
    placeWord: "gimnasio",
    placeWordCapitalized: "Gimnasio",
  };
}
