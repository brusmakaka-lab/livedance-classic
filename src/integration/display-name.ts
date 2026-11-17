/** Presentation only: never rewrite participant identity, scoring or persistence. */
export function displayName(name: string | undefined, id: string): string {
 const text=name?.trim();
 if(!text || (text===id && /^(?:viewer-\d+|\d+)$/.test(id)))return "Participante";
 return text;
}
