import type { GymKind } from "@prisma/client";

export type GymTerms = {
  kindWord: string;

  wod: string;
  wods: string;
  rm: string;
  rms: string;

  newWod: string;
  theWod: string;
  theWods: string;

  wodNotFound: string;
  wodSourceNotFound: string;
  wodContentEmptyError: string;
  rmNotFound: string;
  writeWodHere: string;

  rmPillarSublabel: string;
};

const BOX_TERMS: GymTerms = {
  kindWord: "box",

  wod: "WOD",
  wods: "WODs",
  rm: "RM",
  rms: "RMs",

  newWod: "Nuevo WOD",
  theWod: "el WOD",
  theWods: "los WODs",

  wodNotFound: "WOD no encontrado.",
  wodSourceNotFound: "WOD origen no encontrado.",
  wodContentEmptyError: "El contenido del WOD no puede estar vacio.",
  rmNotFound: "RM no encontrado.",
  writeWodHere: "Escribi el WOD aca...",

  rmPillarSublabel: "Registra tus rep max",
};

const GYM_TERMS: GymTerms = {
  kindWord: "gym",

  wod: "Rutina",
  wods: "Rutinas",
  rm: "PR",
  rms: "PRs",

  newWod: "Nueva Rutina",
  theWod: "la Rutina",
  theWods: "las Rutinas",

  wodNotFound: "Rutina no encontrada.",
  wodSourceNotFound: "Rutina origen no encontrada.",
  wodContentEmptyError: "El contenido de la Rutina no puede estar vacio.",
  rmNotFound: "PR no encontrado.",
  writeWodHere: "Escribi la Rutina aca...",

  rmPillarSublabel: "Registra tus PRs",
};

export function gymTerms(kind: GymKind): GymTerms {
  return kind === "BOX" ? BOX_TERMS : GYM_TERMS;
}
