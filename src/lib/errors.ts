export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const notFound = (what = "Ressource") => new AppError("NOT_FOUND", `${what} introuvable`, 404);
export const forbidden = (msg = "Accès refusé") => new AppError("FORBIDDEN", msg, 403);
export const unauthorized = () => new AppError("UNAUTHORIZED", "Connexion requise", 401);
